-- ============================================================
-- ФАЗА 15: SEO — поля часу приготування та порцій для Schema.org
-- Запустити в Supabase SQL Editor
-- ============================================================

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS prep_time_min  SMALLINT,   -- час підготовки (хвилини)
  ADD COLUMN IF NOT EXISTS cook_time_min  SMALLINT,   -- час готування (хвилини)
  ADD COLUMN IF NOT EXISTS total_time_min SMALLINT,   -- загальний час (хвилини)
  ADD COLUMN IF NOT EXISTS recipe_yield   TEXT;       -- кількість порцій (напр. "4 порції")

-- Автоматичне оновлення total_time_min якщо не заповнено вручну
CREATE OR REPLACE FUNCTION trg_calc_total_time()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.total_time_min IS NULL AND NEW.prep_time_min IS NOT NULL AND NEW.cook_time_min IS NOT NULL THEN
    NEW.total_time_min := NEW.prep_time_min + NEW.cook_time_min;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recipe_total_time ON recipes;
CREATE TRIGGER trg_recipe_total_time
  BEFORE INSERT OR UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION trg_calc_total_time();
