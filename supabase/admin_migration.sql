-- ============================================================
-- ФАЗА 10.5: Адмінка — Центр модерації
-- Запустити в Supabase SQL Editor
-- ============================================================

-- 1. Колонки в profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;

-- 2. Колонки в recipe_reports
ALTER TABLE recipe_reports
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved', 'dismissed')),
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 3. Таблиця admin_actions (аудит)
CREATE TABLE IF NOT EXISTS admin_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID NOT NULL REFERENCES auth.users(id),
  target_table TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  action_type  TEXT NOT NULL,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS — recipe_reports
-- ============================================================

DROP POLICY IF EXISTS "admins_select_reports" ON recipe_reports;
CREATE POLICY "admins_select_reports"
  ON recipe_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "admins_update_reports" ON recipe_reports;
CREATE POLICY "admins_update_reports"
  ON recipe_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "admins_delete_reports" ON recipe_reports;
CREATE POLICY "admins_delete_reports"
  ON recipe_reports FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- ============================================================
-- RLS — recipes (додаткові для адмінів)
-- ============================================================

DROP POLICY IF EXISTS "admins_update_recipes" ON recipes;
CREATE POLICY "admins_update_recipes"
  ON recipes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "admins_delete_recipes" ON recipes;
CREATE POLICY "admins_delete_recipes"
  ON recipes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- ============================================================
-- RLS — products (модерація юзерських)
-- ============================================================

DROP POLICY IF EXISTS "admins_update_products" ON products;
CREATE POLICY "admins_update_products"
  ON products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "admins_delete_products" ON products;
CREATE POLICY "admins_delete_products"
  ON products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- ============================================================
-- RLS — profiles (адміни бачать всіх + можуть банити)
-- ============================================================

DROP POLICY IF EXISTS "admins_select_all_profiles" ON profiles;
CREATE POLICY "admins_select_all_profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid()
        AND p2.is_admin = true
    )
  );

DROP POLICY IF EXISTS "admins_update_profiles" ON profiles;
CREATE POLICY "admins_update_profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid()
        AND p2.is_admin = true
    )
  );

-- ============================================================
-- RLS — admin_actions (тільки адміни пишуть/читають)
-- ============================================================

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_actions" ON admin_actions;
CREATE POLICY "admins_select_actions"
  ON admin_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "admins_insert_actions" ON admin_actions;
CREATE POLICY "admins_insert_actions"
  ON admin_actions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- ============================================================
-- Встановити is_admin для себе (замінити YOUR_USER_ID)
-- ============================================================
-- UPDATE profiles SET is_admin = true WHERE id = 'YOUR_USER_ID';

-- ============================================================
-- Індекси
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_recipe_reports_status ON recipe_reports(status);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- ============================================================
-- ФАЗА 10.5 Додаток: pre-moderation + caring rejection notes
-- ============================================================

-- Нотатка модератора яку бачить тільки автор рецепту
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS moderation_note TEXT;

-- Статус 'pending' тепер валідний (якщо є CHECK constraint на status)
-- Якщо немає constraint — нічого робити не треба

-- ============================================================
-- ФАЗА 10.5 Додаток: pg_trgm дублі продуктів + merge
-- ============================================================

-- Увімкнути розширення
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Індекс для швидкого пошуку схожих назв
CREATE INDEX IF NOT EXISTS idx_products_name_ua_trgm ON products USING gin(name_ua gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_en_trgm ON products USING gin(name_en gin_trgm_ops);

-- Функція: знайти схожі (не-юзерські) продукти для заданого product_id
-- Повертає: id, name_ua, name_en, kcal, similarity
CREATE OR REPLACE FUNCTION find_similar_products(p_product_id INTEGER, p_threshold FLOAT DEFAULT 0.3)
RETURNS TABLE(id INTEGER, name_ua TEXT, name_en TEXT, kcal NUMERIC, similarity FLOAT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    p.id,
    p.name_ua,
    p.name_en,
    p.kcal,
    GREATEST(
      similarity(COALESCE(src.name_ua,''), COALESCE(p.name_ua,'')),
      similarity(COALESCE(src.name_en,''), COALESCE(p.name_en,''))
    ) AS similarity
  FROM products p
  CROSS JOIN (SELECT name_ua, name_en FROM products WHERE products.id = p_product_id) src
  WHERE p.id <> p_product_id
    AND p.user_id IS NULL
    AND GREATEST(
      similarity(COALESCE(src.name_ua,''), COALESCE(p.name_ua,'')),
      similarity(COALESCE(src.name_en,''), COALESCE(p.name_en,''))
    ) >= p_threshold
  ORDER BY similarity DESC
  LIMIT 10;
$$;

-- Функція: merge user product → target product
-- Переносить посилання в product_recipe, потім видаляє юзерський продукт
CREATE OR REPLACE FUNCTION merge_product(p_from_id INTEGER, p_to_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Перевірка: тільки адмін може виконувати merge
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Переносимо посилання в рецептах
  UPDATE product_recipe SET ingredient_id = p_to_id WHERE ingredient_id = p_from_id;

  -- Видаляємо оригінальний юзерський продукт
  DELETE FROM products WHERE id = p_from_id AND user_id IS NOT NULL;
END;
$$;
