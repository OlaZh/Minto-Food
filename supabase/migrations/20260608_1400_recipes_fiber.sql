-- ============================================================
-- Add fiber to recipes
-- 2026-06-08
--
-- Frontend recipe save sends aggregate fiber together with
-- kcal/protein/fat/carbs. Some environments do not yet have
-- the `recipes.fiber` column, which causes PostgREST insert
-- failures with PGRST204.
-- ============================================================

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS fiber numeric DEFAULT 0;
