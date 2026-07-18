REVOKE ALL ON FUNCTION public.admin_search_users(text, integer) FROM authenticated;
DROP FUNCTION IF EXISTS public.admin_search_users(text, integer);

