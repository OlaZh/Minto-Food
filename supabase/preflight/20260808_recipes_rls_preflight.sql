-- READ-ONLY preflight for:
--   migrations/20260808_0900_lock_recipes_write_access.sql
-- A separate pending/public SELECT migration is intentionally prepared only
-- after 20260808_all_recipes_to_moderation_preflight.sql is reviewed.
--
-- Run this file in Supabase SQL Editor BEFORE the migration.
-- It cannot change the database: PostgreSQL enforces READ ONLY for the entire
-- transaction. Save all result grids and review them before applying the fix.

BEGIN TRANSACTION READ ONLY;

-- 1. Exact live policy inventory. This is the source of truth that the local
-- repository cannot provide for policies previously created in Dashboard.
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

-- 2. Conflict summary for the prepared migration.
-- blocking_for_all must be 0. public_select_to_replace must be >= 1 because
-- the live leak proves that at least one public/anon read path exists.
SELECT
  count(*) FILTER (
    WHERE cmd = 'ALL'
      AND (
        'public'::name = ANY (roles)
        OR 'anon'::name = ANY (roles)
      )
  ) AS blocking_for_all,
  string_agg(policyname, ', ' ORDER BY policyname) FILTER (
    WHERE cmd = 'ALL'
      AND (
        'public'::name = ANY (roles)
        OR 'anon'::name = ANY (roles)
      )
  ) AS blocking_for_all_names,
  count(*) FILTER (
    WHERE cmd = 'SELECT'
      AND (
        'public'::name = ANY (roles)
        OR 'anon'::name = ANY (roles)
      )
  ) AS public_select_to_replace,
  string_agg(policyname, ', ' ORDER BY policyname) FILTER (
    WHERE cmd = 'SELECT'
      AND (
        'public'::name = ANY (roles)
        OR 'anon'::name = ANY (roles)
      )
  ) AS public_select_names
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'recipes';

-- 3. Required schema contract. All five rows must exist. The migration does
-- not add/alter columns, so a missing row means the migration must not run.
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'recipes'
  AND column_name IN ('id', 'user_id', 'status', 'is_public', 'deleted_at')
ORDER BY column_name;

-- 4. Current data distribution. This confirms the exact scope without
-- exposing recipe names, content, user ids, emails or any other PII.
SELECT
  status,
  is_public,
  (deleted_at IS NOT NULL) AS is_deleted,
  count(*) AS row_count
FROM public.recipes
GROUP BY status, is_public, (deleted_at IS NOT NULL)
ORDER BY row_count DESC, status, is_public;

-- 5. Existing table grants. The migration only ensures SELECT for anon and
-- authenticated; it must not remove any write grants.
SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'recipes'
ORDER BY grantee, privilege_type;

-- 6. Trigger inventory. The image-moderation trigger must remain present;
-- the SELECT-policy migration does not alter triggers.
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'recipes'
ORDER BY trigger_name, event_manipulation;

-- 7. RLS flags. rowsecurity_enabled must be true. FORCE RLS may be either
-- value because service_role/server behaviour is intentionally unchanged.
SELECT
  c.relrowsecurity AS rowsecurity_enabled,
  c.relforcerowsecurity AS force_rowsecurity_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'recipes';

COMMIT;
