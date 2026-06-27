-- Allow logged-in users to call GDPR soft-delete through the client.
-- The function already validates that the caller is the same user or an admin.

REVOKE ALL ON FUNCTION public.soft_delete_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_user(UUID) TO service_role;
