-- ============================================================
-- Fix: Public read RLS for product detail tables
-- 2026-05-28
--
-- Таблиці мали RLS ON але жодної SELECT полісі →
-- product-guide.js отримував порожні масиви для всіх деталей.
-- ============================================================

DROP POLICY IF EXISTS "public_read_product_benefits"     ON product_benefits;
DROP POLICY IF EXISTS "public_read_product_harm"         ON product_harm;
DROP POLICY IF EXISTS "public_read_product_effects"      ON product_effects;
DROP POLICY IF EXISTS "public_read_product_myths"        ON product_myths_new;
DROP POLICY IF EXISTS "public_read_product_substitutes"  ON product_substitutes;
DROP POLICY IF EXISTS "public_read_product_combinations" ON product_combinations;

CREATE POLICY "public_read_product_benefits"     ON product_benefits    FOR SELECT USING (true);
CREATE POLICY "public_read_product_harm"         ON product_harm        FOR SELECT USING (true);
CREATE POLICY "public_read_product_effects"      ON product_effects     FOR SELECT USING (true);
CREATE POLICY "public_read_product_myths"        ON product_myths_new   FOR SELECT USING (true);
CREATE POLICY "public_read_product_substitutes"  ON product_substitutes FOR SELECT USING (true);
CREATE POLICY "public_read_product_combinations" ON product_combinations FOR SELECT USING (true);
