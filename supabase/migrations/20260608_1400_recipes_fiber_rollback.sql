-- ============================================================
-- Rollback: remove fiber from recipes
-- 2026-06-08
-- ============================================================

ALTER TABLE recipes
  DROP COLUMN IF EXISTS fiber;
