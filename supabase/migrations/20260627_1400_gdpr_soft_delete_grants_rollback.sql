-- Rollback: restore broad execute access for soft_delete_user.
-- 2026-06-27

REVOKE ALL ON FUNCTION public.soft_delete_user(UUID) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_user(UUID) TO PUBLIC, anon;
