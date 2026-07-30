-- ============================================================
-- ROLLBACK: generic per-user API rate limiting
-- 2026-07-29
-- ============================================================

REVOKE ALL ON FUNCTION public.cleanup_api_rate_limits()
  FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.cleanup_api_rate_limits();

REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.check_rate_limit(uuid, text, integer, integer);

DROP TABLE IF EXISTS public.api_rate_limits;
