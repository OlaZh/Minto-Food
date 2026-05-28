-- ============================================================
-- Fix: Missing public read RLS policies
-- 2026-05-28
--
-- Проблема: product_aliases, product_units, tags мали RLS ON
-- але жодної SELECT полісі → повертали 0 рядків для всіх юзерів.
--
-- Ефект багів:
--   - parse-food.js: alias search (крок 2) завжди порожній
--   - recipe-ingredients.js: кеш product_units порожній → шт = 100г
--   - add-recipe.js: теги не завантажувались
-- ============================================================

DROP POLICY IF EXISTS "public_read_product_aliases" ON product_aliases;
DROP POLICY IF EXISTS "public_read_product_units"   ON product_units;
DROP POLICY IF EXISTS "public_read_tags"            ON tags;

CREATE POLICY "public_read_product_aliases" ON product_aliases FOR SELECT USING (true);
CREATE POLICY "public_read_product_units"   ON product_units   FOR SELECT USING (true);
CREATE POLICY "public_read_tags"            ON tags            FOR SELECT USING (true);
