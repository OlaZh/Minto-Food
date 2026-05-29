-- ============================================================
-- Align scanned_products / products columns with app code
-- 2026-05-29
--
-- scanned_products бракувало колонок, які код пише при збереженні
-- сканованого/ручного продукту. Через це INSERT падав з 400
-- ("Could not find the '<col>' column ... in the schema cache").
--
-- Польські етикетки під вуглеводами дають "w tym cukry" (цукор)
-- та окремо "sól" (сіль). Зберігаємо на 100 г.
-- IF NOT EXISTS — безпечно виконувати повторно.
--
-- Станом на 2026-05-29 у scanned_products уже були додані
-- fiber/sugar/salt; реально бракувало лише label_type.
-- ============================================================

ALTER TABLE scanned_products
  ADD COLUMN IF NOT EXISTS fiber      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sugar      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salt       numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS label_type text    DEFAULT 'EU';

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS fiber numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sugar numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salt  numeric DEFAULT 0;
