-- Rollback: 20260518_1200_cleanup_dead_tables.sql
-- Відновлює структуру таблиць (без даних — дані не зберігались як важливі).
-- Якщо потрібно відновити дані — використовуй Supabase backup.

CREATE TABLE IF NOT EXISTS recipetest (LIKE recipes INCLUDING ALL);

CREATE TABLE IF NOT EXISTS shopping_list (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meals_backup_before_streaks (LIKE meals INCLUDING ALL);

CREATE TABLE IF NOT EXISTS cookbook_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cookbook_notebooks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_similar (
  id         SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);
