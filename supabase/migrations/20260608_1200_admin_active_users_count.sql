-- ============================================================
-- Admin dashboard: accurate active users count
-- 2026-06-08
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_active_users_count(p_since timestamptz)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin
    INTO v_is_admin
    FROM public.profiles
   WHERE id = auth.uid();

  IF COALESCE(v_is_admin, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN (
    SELECT COUNT(DISTINCT user_id)::bigint
      FROM public.meals
     WHERE created_at >= p_since
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_active_users_count(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_active_users_count(timestamptz) TO authenticated;
