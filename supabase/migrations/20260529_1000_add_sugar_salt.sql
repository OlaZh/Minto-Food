-- ============================================================
-- Add fiber / sugar / salt columns to product tables
-- 2026-05-29
--
-- scanned_products не мала колонок fiber/sugar/salt, тому ручне
-- збереження сканованого продукту падало з 400 ("Could not find
-- the 'fiber' column of 'scanned_products' in the schema cache").
--
-- Польські етикетки під вуглеводами дають "w tym cukry" (цукор)
-- та окремо "sól" (сіль). Зберігаємо на 100 г.
-- Колонки nullable + default 0, щоб не ламати наявні записи.
-- IF NOT EXISTS — безпечно повторно виконувати.
-- ============================================================

ALTER TABLE scanned_products
  ADD COLUMN IF NOT EXISTS fiber numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sugar numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salt  numeric DEFAULT 0;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS fiber numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sugar numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salt  numeric DEFAULT 0;
