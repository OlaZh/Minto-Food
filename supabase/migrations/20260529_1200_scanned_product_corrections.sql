-- ============================================================
-- Crowd-correction log for scanned (barcode) products
-- 2026-05-29
--
-- Ідея: правки КБЖУ в картці сканера НЕ змінюють спільну таблицю
-- scanned_products. Замість цього кожна персональна правка
-- (значення на 100 г, що відрізняються від канонічних) пишеться
-- сюди — по одному рядку на (barcode, user_id).
--
-- Це дає:
--  1) користувач бачить СВОЇ збережені цифри при наступному скані;
--  2) адмін бачить, коли кілька людей вносять однакову правку
--     (сигнал, що канонічні дані треба оновити).
-- ============================================================

CREATE TABLE IF NOT EXISTS scanned_product_corrections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode    text NOT NULL,
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kcal       numeric DEFAULT 0,
  protein    numeric DEFAULT 0,
  fat        numeric DEFAULT 0,
  carbs      numeric DEFAULT 0,
  fiber      numeric DEFAULT 0,
  sugar      numeric DEFAULT 0,
  salt       numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (barcode, user_id)
);

CREATE INDEX IF NOT EXISTS idx_spc_barcode ON scanned_product_corrections (barcode);
CREATE INDEX IF NOT EXISTS idx_spc_user    ON scanned_product_corrections (user_id);

-- ── RLS: кожен керує лише своїми правками ──────────────────────
ALTER TABLE scanned_product_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_select_corrections" ON scanned_product_corrections;
DROP POLICY IF EXISTS "own_insert_corrections" ON scanned_product_corrections;
DROP POLICY IF EXISTS "own_update_corrections" ON scanned_product_corrections;
DROP POLICY IF EXISTS "own_delete_corrections" ON scanned_product_corrections;

CREATE POLICY "own_select_corrections" ON scanned_product_corrections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own_insert_corrections" ON scanned_product_corrections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_update_corrections" ON scanned_product_corrections
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_delete_corrections" ON scanned_product_corrections
  FOR DELETE USING (auth.uid() = user_id);

-- ── Адмін-агрегація (анонімна, без user_id назовні) ────────────
-- Групуємо схожі правки в "кошики" (kcal до 5, макро до 0.5, сіль
-- до 0.1), рахуємо скільки РІЗНИХ людей запропонували те саме.
-- SECURITY DEFINER + перевірка is_admin усередині.
CREATE OR REPLACE FUNCTION get_scanned_correction_stats(min_votes int DEFAULT 2)
RETURNS TABLE (
  barcode            text,
  name               text,
  total_voters       bigint,
  votes              bigint,
  canon_kcal numeric, canon_protein numeric, canon_fat numeric,
  canon_carbs numeric, canon_fiber numeric, canon_sugar numeric, canon_salt numeric,
  sug_kcal numeric, sug_protein numeric, sug_fat numeric,
  sug_carbs numeric, sug_fiber numeric, sug_sugar numeric, sug_salt numeric,
  last_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH buckets AS (
    SELECT
      c.barcode,
      c.user_id,
      round(c.kcal / 5.0) * 5      AS b_kcal,
      round(c.protein * 2) / 2     AS b_protein,
      round(c.fat * 2) / 2         AS b_fat,
      round(c.carbs * 2) / 2       AS b_carbs,
      round(c.fiber * 2) / 2       AS b_fiber,
      round(c.sugar * 2) / 2       AS b_sugar,
      round(c.salt * 10) / 10      AS b_salt,
      c.updated_at
    FROM scanned_product_corrections c
  ),
  grouped AS (
    SELECT
      b.barcode,
      b.b_kcal, b.b_protein, b.b_fat, b.b_carbs, b.b_fiber, b.b_sugar, b.b_salt,
      count(DISTINCT b.user_id) AS votes,
      max(b.updated_at)         AS last_at
    FROM buckets b
    GROUP BY b.barcode, b.b_kcal, b.b_protein, b.b_fat, b.b_carbs, b.b_fiber, b.b_sugar, b.b_salt
  ),
  totals AS (
    SELECT c.barcode, count(DISTINCT c.user_id) AS total_voters
    FROM scanned_product_corrections c
    GROUP BY c.barcode
  )
  SELECT
    g.barcode,
    sp.name_ua,
    t.total_voters,
    g.votes,
    sp.kcal, sp.protein, sp.fat, sp.carbs, sp.fiber, sp.sugar, sp.salt,
    g.b_kcal, g.b_protein, g.b_fat, g.b_carbs, g.b_fiber, g.b_sugar, g.b_salt,
    g.last_at
  FROM grouped g
  JOIN totals t ON t.barcode = g.barcode
  LEFT JOIN scanned_products sp ON sp.barcode = g.barcode
  WHERE g.votes >= min_votes
  ORDER BY g.votes DESC, g.last_at DESC;
END;
$$;

-- ── Адмін-застосування правки до канону ────────────────────────
-- Оновлює scanned_products і прибирає правки по цьому штрихкоду
-- (вони стають неактуальними). SECURITY DEFINER + is_admin.
CREATE OR REPLACE FUNCTION apply_scanned_correction(
  p_barcode text,
  p_kcal numeric, p_protein numeric, p_fat numeric, p_carbs numeric,
  p_fiber numeric, p_sugar numeric, p_salt numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE scanned_products
  SET kcal = p_kcal, protein = p_protein, fat = p_fat, carbs = p_carbs,
      fiber = p_fiber, sugar = p_sugar, salt = p_salt,
      updated_at = now()
  WHERE barcode = p_barcode;

  DELETE FROM scanned_product_corrections WHERE barcode = p_barcode;
END;
$$;

-- ── Прибрати одну (помилкову) групу правок без зміни канону ─────
CREATE OR REPLACE FUNCTION dismiss_scanned_corrections(p_barcode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  DELETE FROM scanned_product_corrections WHERE barcode = p_barcode;
END;
$$;

REVOKE ALL ON FUNCTION get_scanned_correction_stats(int)  FROM public, anon;
REVOKE ALL ON FUNCTION apply_scanned_correction(text, numeric, numeric, numeric, numeric, numeric, numeric, numeric) FROM public, anon;
REVOKE ALL ON FUNCTION dismiss_scanned_corrections(text)  FROM public, anon;
GRANT EXECUTE ON FUNCTION get_scanned_correction_stats(int)  TO authenticated;
GRANT EXECUTE ON FUNCTION apply_scanned_correction(text, numeric, numeric, numeric, numeric, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_scanned_corrections(text)  TO authenticated;
