-- ============================================================
-- Admin security hardening + searchable user management
-- 2026-06-01
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_search_users(
  p_query text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  is_admin boolean,
  is_banned boolean,
  is_shadow_banned boolean,
  strikes integer,
  freeze_until timestamptz,
  created_at timestamptz,
  recipe_count bigint,
  last_active timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_query text := NULLIF(BTRIM(COALESCE(p_query, '')), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH matched_users AS (
    SELECT
      p.id,
      u.email::text AS email,
      p.full_name,
      p.is_admin,
      p.is_banned,
      p.is_shadow_banned,
      p.strikes,
      p.freeze_until,
      p.created_at
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE v_query IS NULL
      OR COALESCE(p.full_name, '') ILIKE '%' || v_query || '%'
      OR COALESCE(u.email::text, '') ILIKE '%' || v_query || '%'
      OR p.id::text ILIKE '%' || v_query || '%'
  ),
  recipe_counts AS (
    SELECT r.user_id, COUNT(*)::bigint AS recipe_count
    FROM public.recipes r
    WHERE r.deleted_at IS NULL
    GROUP BY r.user_id
  ),
  last_activity AS (
    SELECT m.user_id, MAX(m.created_at) AS last_active
    FROM public.meals m
    GROUP BY m.user_id
  ),
  enriched AS (
    SELECT
      mu.id,
      mu.email,
      mu.full_name,
      mu.is_admin,
      mu.is_banned,
      mu.is_shadow_banned,
      mu.strikes,
      mu.freeze_until,
      mu.created_at,
      COALESCE(rc.recipe_count, 0::bigint) AS recipe_count,
      la.last_active,
      COUNT(*) OVER ()::bigint AS total_count
    FROM matched_users mu
    LEFT JOIN recipe_counts rc ON rc.user_id = mu.id
    LEFT JOIN last_activity la ON la.user_id = mu.id
    ORDER BY mu.created_at DESC
    OFFSET v_offset
    LIMIT v_limit
  )
  SELECT
    enriched.id,
    enriched.email,
    enriched.full_name,
    enriched.is_admin,
    enriched.is_banned,
    enriched.is_shadow_banned,
    enriched.strikes,
    enriched.freeze_until,
    enriched.created_at,
    enriched.recipe_count,
    enriched.last_active,
    enriched.total_count
  FROM enriched;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_search_users(text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_admin(
  p_user_id uuid,
  p_is_admin boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_target_is_admin boolean;
  v_admin_count bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_actor_id AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT is_admin
  INTO v_target_is_admin
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF p_is_admin = false AND p_user_id = v_actor_id THEN
    RAISE EXCEPTION 'You cannot revoke your own admin access';
  END IF;

  IF p_is_admin = false AND v_target_is_admin = true THEN
    SELECT COUNT(*)::bigint
    INTO v_admin_count
    FROM public.profiles
    WHERE is_admin = true;

    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'You cannot revoke the last admin';
    END IF;
  END IF;

  UPDATE public.profiles
  SET is_admin = p_is_admin
  WHERE id = p_user_id;

  RETURN p_is_admin;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_admin(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_count_active_users_since(
  p_since timestamptz
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(DISTINCT m.user_id)::bigint
  INTO v_count
  FROM public.meals m
  WHERE m.created_at >= p_since
    AND m.user_id IS NOT NULL;

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_count_active_users_since(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_count_active_users_last_7d()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.admin_count_active_users_since(now() - interval '7 days');
$$;

GRANT EXECUTE ON FUNCTION public.admin_count_active_users_last_7d() TO authenticated;
