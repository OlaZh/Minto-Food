-- ============================================================
-- DB Audit — знайти мертві таблиці
-- 2026-05-18
--
-- НЕ запускати автоматично. Виконати вручну в Supabase SQL Editor
-- та зафіксувати результати у docs/migrations.md.
-- ============================================================

-- 1. Список всіх таблиць у public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Перевірити підозрілі таблиці (мертві чи дублікати)

-- profiles vs user_profiles
SELECT COUNT(*) AS profiles_count      FROM profiles;
SELECT COUNT(*) AS user_profiles_count FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'user_profiles';

-- Чи існує old_products?
SELECT COUNT(*) AS old_products_exists FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'old_products';

-- Чи існує recipetest?
SELECT COUNT(*) AS recipetest_exists FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'recipetest';

-- Чи є дубль cookbook_notes / cookbook_n...?
SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'cookbook%'
  ORDER BY table_name;

-- 3. Розмір таблиць (для оцінки що реально використовується)
SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  n_live_tup AS live_rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- 4. Таблиці без RLS (потенційна вразливість)
SELECT relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY relname;
