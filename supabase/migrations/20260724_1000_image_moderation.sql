-- Phase 18 — Image moderation for user-uploaded recipe photos.
--
-- UGC platform without image moderation invites NSFW spam. When a recipe photo
-- scores above the NSFW threshold, the recipe is auto-hidden from the public
-- (is_image_flagged = true) and lands in the admin queue tagged "auto-flagged",
-- where an admin can override the decision.
--
-- Design notes:
--  * `profiles.is_shadow_banned` already exists for *authors*. This adds a
--    per-*recipe* flag so a single bad photo hides one recipe, not the author.
--  * All writes to the moderation columns go through the SERVICE ROLE only:
--    /api/save-recipe scores the exact photo it is about to persist and writes
--    the recipe + score in one trusted step. A DB trigger strips these columns
--    from any *client* (authenticated/anon) write, so a crafted PostgREST
--    request cannot forge a "safe" score. Admins may clear a flag via the
--    override RPC (the trigger also lets admins through).

-- --- Per-recipe moderation columns -----------------------------------------
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS is_image_flagged  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_nsfw_score  NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS image_moderated_at TIMESTAMPTZ;

COMMENT ON COLUMN recipes.is_image_flagged IS
  'Set when the recipe photo failed automated moderation (NSFW score above threshold). Hides the recipe from public listings until an admin reviews.';
COMMENT ON COLUMN recipes.image_nsfw_score IS
  'Highest NSFW probability [0..1] returned by the image moderation provider for the current photo. NULL = not yet moderated / no photo.';

-- Fast lookup of flagged recipes for the admin queue.
CREATE INDEX IF NOT EXISTS idx_recipes_image_flagged
  ON recipes (image_moderated_at DESC)
  WHERE is_image_flagged = true;

-- --- Audit log --------------------------------------------------------------
-- Every automated decision is logged so an admin can audit / override, and so
-- we can tune the threshold later against real data.
CREATE TABLE IF NOT EXISTS image_moderation_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   INTEGER     REFERENCES recipes (id) ON DELETE CASCADE,  -- recipes.id is integer, not uuid
  user_id     UUID        REFERENCES auth.users (id) ON DELETE SET NULL,
  provider    TEXT        NOT NULL,                    -- 'sightengine' | 'stub' | ...
  nsfw_score  NUMERIC(4,3),
  decision    TEXT        NOT NULL CHECK (decision IN ('approved', 'flagged', 'error')),
  raw         JSONB,                                   -- trimmed provider response, for audit
  overridden_by uuid      REFERENCES auth.users (id) ON DELETE SET NULL,
  overridden_at timestamptz,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_moderation_log_recipe
  ON image_moderation_log (recipe_id);
CREATE INDEX IF NOT EXISTS idx_image_moderation_log_created
  ON image_moderation_log (created_at DESC);

ALTER TABLE image_moderation_log ENABLE ROW LEVEL SECURITY;

-- Only admins read the log directly; the service role (API) writes it.
REVOKE ALL ON TABLE image_moderation_log FROM public, anon, authenticated;

-- service_role bypasses RLS by default, but Supabase recommends granting the
-- needed table privileges explicitly (platform defaults for the role can
-- change). /api/save-recipe writes this table with the service key.
GRANT INSERT, SELECT ON TABLE image_moderation_log TO service_role;

DROP POLICY IF EXISTS "admin_read_image_moderation_log" ON image_moderation_log;
CREATE POLICY "admin_read_image_moderation_log"
  ON image_moderation_log
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
GRANT SELECT ON TABLE image_moderation_log TO authenticated;

-- --- Guard: clients must not set moderation fields themselves ----------------
-- Recipes are written from the browser with the authenticated key. This trigger
-- forces the moderation columns to safe defaults on any INSERT/UPDATE that is
-- NOT trusted, so a crafted PostgREST request cannot mark its own NSFW photo as
-- "not flagged" or forge a score.
--
-- Trusted writers that bypass the guard:
--   * service_role  — /api/save-recipe scores + writes in one step
--   * an admin      — override_image_flag() clears a flag after human review
CREATE OR REPLACE FUNCTION enforce_recipe_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
BEGIN
  -- service_role (the API) is trusted.
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- An authenticated admin is trusted (override flow). auth.uid() is reliable
  -- here because it derives from the same JWT.
  IF v_role = 'authenticated'
     AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_image_flagged   := false;
    NEW.image_nsfw_score   := NULL;
    NEW.image_moderated_at := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Preserve whatever the trusted server last wrote; ignore client attempts.
    NEW.is_image_flagged   := OLD.is_image_flagged;
    NEW.image_nsfw_score   := OLD.image_nsfw_score;
    NEW.image_moderated_at := OLD.image_moderated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_recipe_moderation ON recipes;
CREATE TRIGGER trg_enforce_recipe_moderation
  BEFORE INSERT OR UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION enforce_recipe_moderation_fields();

-- --- Admin override: clear (or re-apply) a flag after human review ----------
-- Called with an admin JWT (authenticated). The trigger above lets admins write
-- the moderation columns, so this UPDATE actually sticks. Verifies is_admin.
CREATE OR REPLACE FUNCTION override_image_flag(
  p_recipe_id integer,  -- recipes.id is integer
  p_flagged   boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE recipes
  SET is_image_flagged   = p_flagged,
      image_moderated_at = now()
  WHERE id = p_recipe_id;

  UPDATE image_moderation_log
  SET overridden_by = auth.uid(),
      overridden_at = now()
  WHERE recipe_id = p_recipe_id
    AND overridden_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION override_image_flag(integer, boolean)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION override_image_flag(integer, boolean) TO authenticated;

-- --- Atomic staged update of a PUBLISHED recipe -----------------------------
-- Editing a published recipe stages the moderated fields (image/steps/name) in
-- recipe_pending_updates instead of touching the live copy, so the published
-- recipe never changes without review. Doing the direct PATCH + pending INSERT
-- + flag PATCH as three REST calls is not atomic — a mid-way failure leaves the
-- row half-updated. This function performs all of it in ONE transaction.
--
-- Called by /api/save-recipe with the service role. p_direct = columns to write
-- to the live recipe now (e.g. is_public, nutrition); p_pending = the staged
-- moderated changes (may include the new image). If a new image is staged and
-- flagged, is_image_flagged is set on the live recipe so it enters the queue,
-- while the live recipe.image itself is left untouched.
CREATE OR REPLACE FUNCTION stage_recipe_update(
  p_recipe_id integer,
  p_user_id   uuid,
  p_direct    jsonb,
  p_pending   jsonb,
  p_image_flagged boolean DEFAULT false,
  p_image_score   numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT user_id INTO v_owner FROM recipes WHERE id = p_recipe_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'recipe not found'; END IF;
  IF v_owner <> p_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Direct columns (non-moderated) written to the live recipe now.
  IF p_direct IS NOT NULL AND p_direct <> '{}'::jsonb THEN
    UPDATE recipes SET
      name_ua      = COALESCE((p_direct->>'name_ua'), name_ua),
      kcal         = COALESCE((p_direct->>'kcal')::numeric, kcal),
      protein      = COALESCE((p_direct->>'protein')::numeric, protein),
      fat          = COALESCE((p_direct->>'fat')::numeric, fat),
      carbs        = COALESCE((p_direct->>'carbs')::numeric, carbs),
      fiber        = COALESCE((p_direct->>'fiber')::numeric, fiber),
      total_weight = COALESCE((p_direct->>'total_weight')::numeric, total_weight),
      category     = COALESCE((p_direct->>'category'), category),
      ingredients  = COALESCE((p_direct->>'ingredients'), ingredients),
      steps        = COALESCE((p_direct->>'steps'), steps),
      is_public    = COALESCE((p_direct->>'is_public')::boolean, is_public),
      status       = COALESCE((p_direct->>'status'), status)
    WHERE id = p_recipe_id;
  END IF;

  -- Stage moderated changes for review.
  IF p_pending IS NOT NULL AND p_pending <> '{}'::jsonb THEN
    INSERT INTO recipe_pending_updates (recipe_id, user_id, changes)
    VALUES (p_recipe_id, p_user_id, p_pending);

    UPDATE recipes
    SET has_pending_update = true,
        -- A staged NSFW photo flags the live recipe so it enters the queue,
        -- but the live recipe.image is NOT replaced (admin reviews the staged
        -- copy in recipe_pending_updates.changes.image).
        is_image_flagged   = CASE WHEN p_image_flagged THEN true ELSE is_image_flagged END,
        image_nsfw_score   = CASE WHEN p_pending ? 'image' THEN p_image_score ELSE image_nsfw_score END,
        image_moderated_at = CASE WHEN p_pending ? 'image' THEN now() ELSE image_moderated_at END
    WHERE id = p_recipe_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION stage_recipe_update(integer, uuid, jsonb, jsonb, boolean, numeric)
  FROM public, anon, authenticated;
-- SECURITY DEFINER still checks EXECUTE for the CALLING role; the service role
-- (the API) must be granted it explicitly, or the RPC fails permission denied.
GRANT EXECUTE ON FUNCTION stage_recipe_update(integer, uuid, jsonb, jsonb, boolean, numeric)
  TO service_role;

-- --- Atomic per-user moderation rate reservation ----------------------------
-- Counting log rows and then calling the provider is racy: N concurrent
-- requests all read the old count and all call the provider. This serialises
-- the check+reserve per user with a transaction-scoped advisory lock, so only
-- MODERATION_RATE_LIMIT provider calls per rolling hour are admitted even under
-- a burst. Returns true if a slot was reserved (caller may call the provider),
-- false if the user is over the limit (caller queues for manual review).
--
-- The reservation is a real log row (provider='reserved'); /api/save-recipe
-- rewrites it with the final decision after scoring. Reserved rows count toward
-- the limit so in-flight requests are visible to concurrent callers.
CREATE OR REPLACE FUNCTION reserve_moderation_slot(
  p_user_id uuid,
  p_limit   integer
)
RETURNS uuid   -- reservation id, or NULL if over the limit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_id    uuid;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Serialise this user's check+reserve. hashtextextended → bigint lock key.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT count(*) INTO v_count
  FROM image_moderation_log
  WHERE user_id = p_user_id
    AND created_at >= now() - interval '1 hour'
    AND provider NOT IN ('stub', 'rate_limited', 'skip', 'none', 'invalid');

  IF v_count >= p_limit THEN
    RETURN NULL;
  END IF;

  INSERT INTO image_moderation_log (user_id, provider, decision)
  VALUES (p_user_id, 'reserved', 'approved')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Finalise a reservation with the real decision after scoring.
CREATE OR REPLACE FUNCTION finalize_moderation_slot(
  p_reservation uuid,
  p_recipe_id   integer,
  p_provider    text,
  p_score       numeric,
  p_decision    text,
  p_raw         jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE image_moderation_log
  SET recipe_id  = p_recipe_id,
      provider   = p_provider,
      nsfw_score = p_score,
      decision   = p_decision,
      raw        = p_raw
  WHERE id = p_reservation;
END;
$$;

REVOKE ALL ON FUNCTION reserve_moderation_slot(uuid, integer)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_moderation_slot(uuid, integer)
  TO service_role;
REVOKE ALL ON FUNCTION finalize_moderation_slot(uuid, integer, text, numeric, text, jsonb)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION finalize_moderation_slot(uuid, integer, text, numeric, text, jsonb)
  TO service_role;

-- --- Admin: atomically APPLY all staged changes to a published recipe --------
-- "Схвалити" for a staged update: copy every staged field (image/name/steps)
-- into the live recipe, delete the pending rows, clear flags. ALL of it in ONE
-- transaction so an admin action can never half-apply. Product decision: approve
-- promotes ALL staged fields, not just the photo.
--
-- Returns the recipe id. Verifies the caller is an admin. The moderation-column
-- writes stick because the trigger lets admins through.
CREATE OR REPLACE FUNCTION apply_pending_update(p_recipe_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
  v_ids uuid[];
  r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Lock the recipe row FIRST — same lock order as stage_recipe_update — so a
  -- concurrent edit either finishes before us or waits until we're done. Without
  -- this, an edit that inserts a new pending row between our read and our DELETE
  -- would be silently discarded.
  PERFORM 1 FROM recipes WHERE id = p_recipe_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'recipe not found'; END IF;

  -- Snapshot exactly the pending rows we merge, so the final DELETE removes ONLY
  -- those (never a row inserted after this point). Merge oldest→newest so the
  -- newest staged value wins.
  SELECT array_agg(id ORDER BY created_at ASC) INTO v_ids
  FROM recipe_pending_updates
  WHERE recipe_id = p_recipe_id;

  FOR r IN
    SELECT changes FROM recipe_pending_updates
    WHERE recipe_id = p_recipe_id
    ORDER BY created_at ASC
  LOOP
    v_changes := v_changes || COALESCE(r.changes, '{}'::jsonb);
  END LOOP;

  -- Apply staged fields. status follows is_public: a public recipe becomes
  -- published; a recipe the author switched to private stays draft (applying an
  -- edit must NOT publish a now-private recipe — edge: published→private+staged).
  UPDATE recipes SET
    name_ua      = COALESCE((v_changes->>'name_ua'), name_ua),
    steps        = COALESCE((v_changes->>'steps'), steps),
    image        = CASE WHEN v_changes ? 'image' THEN (v_changes->>'image') ELSE image END,
    status             = CASE WHEN is_public THEN 'published' ELSE 'draft' END,
    is_image_flagged   = false,
    has_pending_update = false,
    image_moderated_at = CASE WHEN v_changes ? 'image' THEN now() ELSE image_moderated_at END
  WHERE id = p_recipe_id;

  -- Delete only the snapshotted rows.
  IF v_ids IS NOT NULL THEN
    DELETE FROM recipe_pending_updates WHERE id = ANY(v_ids);
  END IF;

  RETURN p_recipe_id;
END;
$$;

-- --- Admin: atomically DISCARD staged changes (keep the live recipe) ---------
-- "Відхилити" a staged update: drop the pending rows and clear the flag. The
-- published recipe is left exactly as it was — the author is not punished for a
-- rejected edit. ONE transaction.
CREATE OR REPLACE FUNCTION discard_pending_update(p_recipe_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Lock the recipe row FIRST — same lock order as stage_recipe_update /
  -- apply_pending_update — so we can't clear has_pending_update while a
  -- concurrent edit is mid-insert.
  PERFORM 1 FROM recipes WHERE id = p_recipe_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'recipe not found'; END IF;

  -- Snapshot the rows we discard, so we delete ONLY these (never one inserted
  -- after the lock is taken).
  SELECT array_agg(id) INTO v_ids
  FROM recipe_pending_updates
  WHERE recipe_id = p_recipe_id;

  IF v_ids IS NOT NULL THEN
    DELETE FROM recipe_pending_updates WHERE id = ANY(v_ids);
  END IF;

  -- Clear the flag. Also reset the staged-image moderation fields — after a
  -- discard the live photo is unchanged, so a score/time describing the REJECTED
  -- staged photo would be misleading.
  UPDATE recipes
  SET has_pending_update = false,
      is_image_flagged   = false,
      image_nsfw_score   = NULL,
      image_moderated_at = NULL
  WHERE id = p_recipe_id;

  RETURN p_recipe_id;
END;
$$;

REVOKE ALL ON FUNCTION apply_pending_update(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION apply_pending_update(integer) TO authenticated;
REVOKE ALL ON FUNCTION discard_pending_update(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION discard_pending_update(integer) TO authenticated;
