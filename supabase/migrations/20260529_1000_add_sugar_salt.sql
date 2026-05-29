-- ============================================================
-- Add sugar / salt columns to product tables
-- 2026-05-29
--
-- Польські етикетки під вуглеводами дають "w tym cukry" (цукор)
-- та окремо "sól" (сіль). Зберігаємо обидва значення на 100 г.
-- Колонки nullable + default 0, щоб не ламати наявні записи.
-- ============================================================

ALTER TABLE scanned_products
  ADD COLUMN IF NOT EXISTS sugar numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salt  numeric DEFAULT 0;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sugar numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salt  numeric DEFAULT 0;
