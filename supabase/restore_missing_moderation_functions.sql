-- Manual repair: install the five missing moderation functions.
-- Source: supabase/migrations/20260724_1000_image_moderation.sql
-- Function bodies, signatures and grant rules are preserved from that source.
-- Run the complete file in Supabase SQL Editor as postgres.
-- Creates functions only; does not call them or modify existing table data.
-- CREATE FUNCTION deliberately stops on an existing signature.
-- Any installation error rolls back the whole transaction.

BEGIN;

CREATE FUNCTION public.stage_recipe_update(
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

CREATE FUNCTION public.reserve_moderation_slot(
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

CREATE FUNCTION public.finalize_moderation_slot(
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

CREATE FUNCTION public.apply_pending_update(p_recipe_id integer)
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

CREATE FUNCTION public.discard_pending_update(p_recipe_id integer)
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

REVOKE ALL ON FUNCTION public.stage_recipe_update(integer, uuid, jsonb, jsonb, boolean, numeric)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage_recipe_update(integer, uuid, jsonb, jsonb, boolean, numeric)
  TO service_role;
REVOKE ALL ON FUNCTION public.reserve_moderation_slot(uuid, integer)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_moderation_slot(uuid, integer)
  TO service_role;
REVOKE ALL ON FUNCTION public.finalize_moderation_slot(uuid, integer, text, numeric, text, jsonb)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_moderation_slot(uuid, integer, text, numeric, text, jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION public.apply_pending_update(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_pending_update(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.discard_pending_update(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.discard_pending_update(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Read-only verification: expect five rows with result = OK.
WITH expected(signature, allowed_role, deny_authenticated) AS (
  VALUES
    ('public.stage_recipe_update(integer,uuid,jsonb,jsonb,boolean,numeric)', 'service_role', true),
    ('public.reserve_moderation_slot(uuid,integer)', 'service_role', true),
    ('public.finalize_moderation_slot(uuid,integer,text,numeric,text,jsonb)', 'service_role', true),
    ('public.apply_pending_update(integer)', 'authenticated', false),
    ('public.discard_pending_update(integer)', 'authenticated', false)
)
SELECT
  e.signature AS function_name,
  CASE
    WHEN p.oid IS NULL THEN 'MISSING'
    WHEN NOT has_function_privilege(e.allowed_role, p.oid, 'EXECUTE')
      OR has_function_privilege('anon', p.oid, 'EXECUTE')
      OR (e.deny_authenticated
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE'))
      THEN 'CHECK_PERMISSIONS'
    ELSE 'OK'
  END AS result
FROM expected e
LEFT JOIN pg_catalog.pg_proc p ON p.oid = to_regprocedure(e.signature)
ORDER BY e.signature;
