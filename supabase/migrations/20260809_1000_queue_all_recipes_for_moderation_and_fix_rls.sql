-- Queue every active recipe for manual moderation and close the confirmed
-- anonymous SELECT leak on public.recipes.
--
-- Approved product state (2026-08-09): all 750 active rows are imported/test
-- recipes, not real user content, and must be manually reviewed before they
-- become public again.
--
-- Required order:
--   1. 20260808_0900_lock_recipes_write_access.sql
--   2. this migration
--
-- Confirmed content preflight:
--   * 750 active, 0 soft-deleted;
--   * 735 satisfy the existing public-recipe trigger;
--   * 15 have neither legacy ingredients nor steps;
--   * 0 missing UA names, 0 staged updates, 0 flagged images.
--
-- Result:
--   * all 750 active rows have status='pending';
--   * 735 complete rows have is_public=true and can be approved;
--   * 15 incomplete rows stay is_public=false until corrected by an admin;
--   * anon sees zero recipes until admins publish them one by one.

BEGIN;

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_active bigint;
  v_deleted bigint;
  v_missing_name bigint;
  v_incomplete bigint;
  v_expected_incomplete bigint;
  v_staged bigint;
  v_flagged bigint;
  v_distribution_mismatches bigint;
  v_unreviewed_select text;
  v_public_write_policies integer;
  v_safe_write_policies integer;
  v_unreviewed_client_write integer;
BEGIN
  -- Stage 1 must already be installed. Abort before touching data if the live
  -- database still has anonymous write capabilities.
  SELECT count(*)
    INTO v_public_write_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'recipes'
    AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    AND (
      'public'::name = ANY (roles)
      OR 'anon'::name = ANY (roles)
    );

  IF v_public_write_policies <> 0
     OR has_table_privilege('anon', 'public.recipes', 'INSERT')
     OR has_table_privilege('anon', 'public.recipes', 'UPDATE')
     OR has_table_privilege('anon', 'public.recipes', 'DELETE')
     OR has_table_privilege('anon', 'public.recipes', 'TRUNCATE')
     OR has_table_privilege('anon', 'public.recipes', 'REFERENCES')
     OR has_table_privilege('anon', 'public.recipes', 'TRIGGER')
     OR has_table_privilege('authenticated', 'public.recipes', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.recipes', 'REFERENCES')
     OR has_table_privilege('authenticated', 'public.recipes', 'TRIGGER') THEN
    RAISE EXCEPTION
      'moderation reset stopped: apply 20260808_0900_lock_recipes_write_access.sql first';
  END IF;

  SELECT count(*)
    INTO v_safe_write_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'recipes'
    AND policyname IN (
      'recipes_owner_insert_own',
      'recipes_owner_update_own',
      'recipes_owner_delete_own',
      'recipes_admin_insert',
      'recipes_admin_update',
      'recipes_admin_delete'
    )
    AND roles = ARRAY['authenticated']::name[];

  SELECT count(*)
    INTO v_unreviewed_client_write
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'recipes'
    AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
    AND policyname NOT IN (
      'recipes_owner_insert_own',
      'recipes_owner_update_own',
      'recipes_owner_delete_own',
      'recipes_admin_insert',
      'recipes_admin_update',
      'recipes_admin_delete'
    );

  IF v_safe_write_policies <> 6 OR v_unreviewed_client_write <> 0 THEN
    RAISE EXCEPTION
      'moderation reset stopped: stage-1 write policies are not in the expected state (safe=%, unreviewed=%)',
      v_safe_write_policies,
      v_unreviewed_client_write;
  END IF;

  SELECT
    count(*) FILTER (WHERE deleted_at IS NULL),
    count(*) FILTER (WHERE deleted_at IS NOT NULL),
    count(*) FILTER (
      WHERE deleted_at IS NULL
        AND (name_ua IS NULL OR btrim(name_ua) = '')
    ),
    count(*) FILTER (
      WHERE deleted_at IS NULL
        AND (ingredients IS NULL OR btrim(ingredients) = '')
        AND (steps IS NULL OR btrim(steps) = '')
    ),
    count(*) FILTER (
      WHERE deleted_at IS NULL
        AND has_pending_update IS TRUE
    ),
    count(*) FILTER (
      WHERE deleted_at IS NULL
        AND is_image_flagged IS TRUE
    )
  INTO
    v_active,
    v_deleted,
    v_missing_name,
    v_incomplete,
    v_staged,
    v_flagged
  FROM public.recipes;

  IF v_active <> 750
     OR v_deleted <> 0
     OR v_missing_name <> 0
     OR v_incomplete <> 15
     OR v_staged <> 0
     OR v_flagged <> 0 THEN
    RAISE EXCEPTION
      'moderation reset stopped: data changed after preflight (active=%, deleted=%, missing_name=%, incomplete=%, staged=%, flagged=%)',
      v_active, v_deleted, v_missing_name, v_incomplete, v_staged, v_flagged;
  END IF;

  -- Confirm that the exact 15 reviewed blocker rows are still the only rows
  -- that cannot pass validate_public_recipe().
  SELECT count(*)
    INTO v_expected_incomplete
  FROM public.recipes
  WHERE deleted_at IS NULL
    AND id = ANY (ARRAY[249, 414, 866, 867, 868, 869, 870, 871, 872, 873, 874, 875, 876, 877, 878])
    AND (ingredients IS NULL OR btrim(ingredients) = '')
    AND (steps IS NULL OR btrim(steps) = '');

  IF v_expected_incomplete <> 15 THEN
    RAISE EXCEPTION
      'moderation reset stopped: expected blocker IDs changed (% of 15 still match)',
      v_expected_incomplete;
  END IF;

  -- Exact distribution from the accepted read-only preflight. Any intervening
  -- edit makes this migration stop and requires a fresh preflight.
  SELECT count(*)
    INTO v_distribution_mismatches
  FROM (
    VALUES
      ('pending'::text,   false, true,  479::bigint),
      ('published'::text, false, true,  127::bigint),
      ('published'::text, true,  true,  121::bigint),
      ('draft'::text,     false, false,  13::bigint),
      ('pending'::text,   true,  true,   10::bigint)
  ) AS expected(status, is_public, has_no_user, row_count)
  FULL JOIN (
    SELECT
      status,
      is_public,
      (user_id IS NULL) AS has_no_user,
      count(*) AS row_count
    FROM public.recipes
    WHERE deleted_at IS NULL
    GROUP BY status, is_public, (user_id IS NULL)
  ) AS actual
    USING (status, is_public, has_no_user, row_count)
  WHERE expected.status IS NULL OR actual.status IS NULL;

  IF v_distribution_mismatches <> 0 THEN
    RAISE EXCEPTION
      'moderation reset stopped: recipe status/public/owner distribution changed after preflight';
  END IF;

  SELECT string_agg(quote_ident(policyname), ', ' ORDER BY policyname)
    INTO v_unreviewed_select
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'recipes'
    AND cmd = 'SELECT'
    AND policyname NOT IN (
      'Anyone can read published recipes',
      'Public can read approved recipes',
      'Users can view published or own recipes',
      'public_read_published_recipes',
      'recipes_public_select_strict',
      'recipes_owner_select_own',
      'recipes_admin_select_all'
    );

  IF v_unreviewed_select IS NOT NULL THEN
    RAISE EXCEPTION
      'moderation reset stopped: unreviewed recipes SELECT policy/policies: %',
      v_unreviewed_select;
  END IF;
END;
$$;

-- The 15 incomplete rows remain private but are still in the moderation queue.
-- The trigger deliberately permits private rows so admins can repair them.
UPDATE public.recipes
SET
  status = 'pending',
  is_public = false
WHERE deleted_at IS NULL
  AND (ingredients IS NULL OR btrim(ingredients) = '')
  AND (steps IS NULL OR btrim(steps) = '')
  AND (
    status IS DISTINCT FROM 'pending'
    OR is_public IS DISTINCT FROM false
  );

-- Complete imported/test recipes become public submissions awaiting approval.
-- validate_public_recipe() remains enabled and validates every changed row.
UPDATE public.recipes
SET
  status = 'pending',
  is_public = true
WHERE deleted_at IS NULL
  AND name_ua IS NOT NULL
  AND btrim(name_ua) <> ''
  AND NOT (
    (ingredients IS NULL OR btrim(ingredients) = '')
    AND (steps IS NULL OR btrim(steps) = '')
  )
  AND (
    status IS DISTINCT FROM 'pending'
    OR is_public IS DISTINCT FROM true
  );

-- PostgreSQL ORs permissive policies. Every old broad SELECT policy must be
-- removed, otherwise pending/private rows would remain visible to anon.
DROP POLICY IF EXISTS "Anyone can read published recipes" ON public.recipes;
DROP POLICY IF EXISTS "Public can read approved recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can view published or own recipes" ON public.recipes;
DROP POLICY IF EXISTS "public_read_published_recipes" ON public.recipes;

DROP POLICY IF EXISTS "recipes_public_select_strict" ON public.recipes;
DROP POLICY IF EXISTS "recipes_owner_select_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_admin_select_all" ON public.recipes;

CREATE POLICY "recipes_public_select_strict"
  ON public.recipes
  FOR SELECT
  TO anon, authenticated
  USING (
    is_public IS TRUE
    AND status = 'published'
    AND deleted_at IS NULL
  );

CREATE POLICY "recipes_owner_select_own"
  ON public.recipes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "recipes_admin_select_all"
  ON public.recipes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin IS TRUE
    )
  );

GRANT SELECT ON TABLE public.recipes TO anon, authenticated;

DO $$
DECLARE
  v_active bigint;
  v_pending_public bigint;
  v_pending_private bigint;
  v_other_active bigint;
  v_anon_select_policies integer;
  v_public_select_policies integer;
BEGIN
  SELECT
    count(*) FILTER (WHERE deleted_at IS NULL),
    count(*) FILTER (
      WHERE deleted_at IS NULL
        AND status = 'pending'
        AND is_public IS TRUE
    ),
    count(*) FILTER (
      WHERE deleted_at IS NULL
        AND status = 'pending'
        AND is_public IS FALSE
    ),
    count(*) FILTER (
      WHERE deleted_at IS NULL
        AND (
          status IS DISTINCT FROM 'pending'
          OR is_public IS NULL
        )
    )
  INTO v_active, v_pending_public, v_pending_private, v_other_active
  FROM public.recipes;

  IF v_active <> 750
     OR v_pending_public <> 735
     OR v_pending_private <> 15
     OR v_other_active <> 0 THEN
    RAISE EXCEPTION
      'moderation reset postflight failed: active=%, pending_public=%, pending_private=%, other_active=%',
      v_active, v_pending_public, v_pending_private, v_other_active;
  END IF;

  SELECT count(*)
    INTO v_anon_select_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'recipes'
    AND cmd = 'SELECT'
    AND 'anon'::name = ANY (roles);

  SELECT count(*)
    INTO v_public_select_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'recipes'
    AND cmd = 'SELECT'
    AND 'public'::name = ANY (roles);

  IF v_anon_select_policies <> 1 OR v_public_select_policies <> 0 THEN
    RAISE EXCEPTION
      'moderation reset postflight failed: anon SELECT policies=%, PUBLIC SELECT policies=%',
      v_anon_select_policies,
      v_public_select_policies;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
