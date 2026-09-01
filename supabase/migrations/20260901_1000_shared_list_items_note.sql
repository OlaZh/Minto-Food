-- ============================================================
-- Спільний список: віддавати коментар до продукту (note)
-- 2026-09-01
--
-- get_shared_list_items не повертала si.note, хоча колонка
-- в shopping_items існує і власник списку її заповнює.
-- Через це друга людина відкривала спільний список без коментарів.
--
-- Тіло функції зберігається без змін (JOIN по share_token,
-- ORDER BY created_at) — додається лише колонка note.
-- RETURNS TABLE змінюється, тому потрібен DROP + CREATE:
-- CREATE OR REPLACE не вміє міняти тип повернення.
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
  note       text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT si.id, si.name, si.amount, si.unit, si.category, si.is_checked, si.note, si.created_at
  FROM shopping_items si
  JOIN shopping_lists sl ON sl.id = si.list_id
  WHERE sl.share_token = p_token
  ORDER BY si.created_at ASC;
$function$;

COMMENT ON FUNCTION public.get_shared_list_items(uuid) IS
  'Позиції спільного списку за share_token. Доступна анонімно: посилання і є ключем доступу.';

-- DROP зняв старі гранти — відновлюємо доступ для публічної сторінки шеру.
REVOKE ALL ON FUNCTION public.get_shared_list_items(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_list_items(uuid) TO anon, authenticated;
