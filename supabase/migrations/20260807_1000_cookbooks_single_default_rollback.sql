-- ============================================================
-- ROLLBACK: allow multiple explicitly default cookbooks per user
-- 2026-08-07
--
-- The forward migration changes no rows, so rollback only removes the index.
-- ============================================================

DROP INDEX IF EXISTS public.uq_cookbooks_one_default_per_user;
