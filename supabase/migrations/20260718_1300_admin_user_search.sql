-- Global admin-only user search by profile name or authentication email.
-- Email remains in auth.users and is exposed only through this guarded RPC.

CREATE OR REPLACE FUNCTION public.admin_search_users(
  p_query text,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  is_admin boolean,
  is_banned boolean,
  is_shadow_banned boolean,
  strikes integer,
  freeze_until timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_query text := lower(trim(COALESCE(p_query, '')));
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;

  IF v_query = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    profile.id,
    auth_user.email::text,
    profile.full_name::text,
    profile.is_admin,
    profile.is_banned,
    profile.is_shadow_banned,
    profile.strikes,
    profile.freeze_until,
    profile.created_at::timestamptz
  FROM auth.users auth_user
  JOIN public.profiles profile ON profile.id = auth_user.id
  WHERE strpos(lower(COALESCE(auth_user.email, '')), v_query) > 0
     OR strpos(lower(COALESCE(profile.full_name, '')), v_query) > 0
  ORDER BY
    CASE
      WHEN lower(COALESCE(auth_user.email, '')) = v_query THEN 0
      WHEN lower(COALESCE(profile.full_name, '')) = v_query THEN 1
      ELSE 2
    END,
    profile.full_name NULLS LAST,
    auth_user.email NULLS LAST
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_users(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_users(text, integer) TO authenticated;

