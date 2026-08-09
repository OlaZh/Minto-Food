-- READ-ONLY verification after:
--   20260808_0900_lock_recipes_write_access.sql
--   20260809_1000_queue_all_recipes_for_moderation_and_fix_rls.sql

BEGIN TRANSACTION READ ONLY;

-- 1. Expected result: 735 pending/public + 15 pending/private, no other active
-- state and no soft-deleted rows in the accepted dataset.
SELECT
  status,
  is_public,
  (user_id IS NULL) AS has_no_user,
  (deleted_at IS NOT NULL) AS is_deleted,
  count(*) AS row_count
FROM public.recipes
GROUP BY status, is_public, (user_id IS NULL), (deleted_at IS NOT NULL)
ORDER BY is_deleted, status, is_public, has_no_user, row_count DESC;

SELECT
  count(*) FILTER (WHERE deleted_at IS NULL) AS active_rows,
  count(*) FILTER (
    WHERE deleted_at IS NULL
      AND status = 'pending'
      AND is_public IS TRUE
  ) AS pending_public,
  count(*) FILTER (
    WHERE deleted_at IS NULL
      AND status = 'pending'
      AND is_public IS FALSE
  ) AS pending_private,
  count(*) FILTER (
    WHERE deleted_at IS NULL
      AND status = 'published'
      AND is_public IS TRUE
  ) AS public_catalog_rows,
  count(*) FILTER (
    WHERE deleted_at IS NULL
      AND (
        status IS DISTINCT FROM 'pending'
        OR is_public IS NULL
      )
  ) AS unexpected_active_rows
FROM public.recipes;

-- 2. Expected SELECT policies: strict public + owner + admin only.
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'recipes'
ORDER BY cmd, policyname;

-- 3. Expected client grants:
--    anon = SELECT only;
--    authenticated = SELECT/INSERT/UPDATE/DELETE only.
SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'recipes'
  AND grantee IN ('anon', 'authenticated', 'service_role', 'postgres')
ORDER BY grantee, privilege_type;

-- 4. Compact pass/fail summary. Every boolean must be true.
SELECT
  (
    SELECT count(*) = 750
    FROM public.recipes
    WHERE deleted_at IS NULL
  ) AS active_count_ok,
  (
    SELECT count(*) = 735
    FROM public.recipes
    WHERE deleted_at IS NULL
      AND status = 'pending'
      AND is_public IS TRUE
  ) AS pending_public_ok,
  (
    SELECT count(*) = 15
    FROM public.recipes
    WHERE deleted_at IS NULL
      AND status = 'pending'
      AND is_public IS FALSE
  ) AS pending_private_ok,
  NOT has_table_privilege('anon', 'public.recipes', 'INSERT')
    AND NOT has_table_privilege('anon', 'public.recipes', 'UPDATE')
    AND NOT has_table_privilege('anon', 'public.recipes', 'DELETE')
    AND NOT has_table_privilege('anon', 'public.recipes', 'TRUNCATE')
    AND NOT has_table_privilege('anon', 'public.recipes', 'REFERENCES')
    AND NOT has_table_privilege('anon', 'public.recipes', 'TRIGGER')
    AS anon_grants_ok,
  (
    SELECT count(*) = 0
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipes'
      AND cmd = 'SELECT'
      AND 'public'::name = ANY (roles)
  ) AS no_public_select_policy,
  (
    SELECT count(*) = 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipes'
      AND cmd = 'SELECT'
      AND 'anon'::name = ANY (roles)
      AND policyname = 'recipes_public_select_strict'
  ) AS strict_anon_policy_ok;

ROLLBACK;
