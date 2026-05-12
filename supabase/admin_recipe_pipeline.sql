-- ============================================================
-- Admin Recipe Pipeline Migration
-- Run in Supabase SQL Editor
--
-- Що робить:
--   1. Створює нову таблицю recipe_author_profiles
--   2. Додає нові колонки до існуючої таблиці recipes
--   3. Додає admin policies до recipe_ingredients_raw та recipe_tags
--   4. Додає admin INSERT policy до recipes
--   5. Створює функцію publish_scheduled_recipes()
--   6. Додає indexes
--
-- НЕ чіпає: tags, recipe_tags структуру, products, profiles
-- ============================================================

-- ============================================================
-- 1. recipe_author_profiles (нова таблиця)
-- ============================================================

CREATE TABLE IF NOT EXISTS recipe_author_profiles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name     TEXT        NOT NULL,
  slug             TEXT        UNIQUE NOT NULL,
  avatar           TEXT,
  bio              TEXT,
  country          TEXT,
  is_virtual       BOOLEAN     NOT NULL DEFAULT true,
  is_editorial     BOOLEAN     NOT NULL DEFAULT true,
  created_by_admin UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recipe_author_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_author_profiles" ON recipe_author_profiles;
CREATE POLICY "public_read_author_profiles"
  ON recipe_author_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins_manage_author_profiles" ON recipe_author_profiles;
CREATE POLICY "admins_manage_author_profiles"
  ON recipe_author_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- ============================================================
-- 2. Нові колонки в recipes (IF NOT EXISTS — безпечно)
-- ============================================================

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS author_profile_id UUID REFERENCES recipe_author_profiles(id),
  ADD COLUMN IF NOT EXISTS available_locales  TEXT[] DEFAULT ARRAY['ua'],
  ADD COLUMN IF NOT EXISTS publish_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cooking_method     TEXT,
  ADD COLUMN IF NOT EXISTS difficulty         TEXT,
  ADD COLUMN IF NOT EXISTS is_public          BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- 3. Admin policy для recipe_ingredients_raw
-- ============================================================

DROP POLICY IF EXISTS "admins_manage_recipe_ingredients_raw" ON recipe_ingredients_raw;
CREATE POLICY "admins_manage_recipe_ingredients_raw"
  ON recipe_ingredients_raw FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- ============================================================
-- 4. Admin policy для recipe_tags
-- ============================================================

DROP POLICY IF EXISTS "admins_manage_recipe_tags" ON recipe_tags;
CREATE POLICY "admins_manage_recipe_tags"
  ON recipe_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- ============================================================
-- 5. Admin INSERT policy для recipes
-- ============================================================

DROP POLICY IF EXISTS "admins_insert_recipes" ON recipes;
CREATE POLICY "admins_insert_recipes"
  ON recipes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- ============================================================
-- 6. Функція: автопублікація запланованих рецептів
-- ============================================================

CREATE OR REPLACE FUNCTION publish_scheduled_recipes()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  UPDATE recipes
  SET status = 'published'
  WHERE status = 'scheduled'
    AND publish_at IS NOT NULL
    AND publish_at <= now()
    AND deleted_at IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt;
END;
$$;

-- ============================================================
-- 7. Indexes (IF NOT EXISTS — безпечно)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_recipes_status_publish_at
  ON recipes(status, publish_at) WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_recipes_author_profile
  ON recipes(author_profile_id) WHERE author_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recipe_author_profiles_slug
  ON recipe_author_profiles(slug);
