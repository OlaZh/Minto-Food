-- ============================================================
-- ROLLBACK: спільний список без коментаря (note)
-- 2026-09-01
--
-- Повертає функцію до вигляду до міграції 20260901_1000.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_shared_list_items(uuid);

CREATE FUNCTION public.get_shared_list_items(p_token uuid)
RETURNS TABLE (
  id         bigint,
  name       text,
  amount     numeric,
  unit       text,
  category   text,
  is_checked boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT si.id, si.name, si.amount, si.unit, si.category, si.is_checked, si.created_at
  FROM shopping_items si
  JOIN shopping_lists sl ON sl.id = si.list_id
  WHERE sl.share_token = p_token
  ORDER BY si.created_at ASC;
$function$;

REVOKE ALL ON FUNCTION public.get_shared_list_items(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_list_items(uuid) TO anon, authenticated;
