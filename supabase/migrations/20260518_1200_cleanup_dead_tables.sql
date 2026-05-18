-- ============================================================
-- Cleanup: Dead Tables
-- 2026-05-18
--
-- Що видаляємо і чому:
--   recipetest              — тестова таблиця (5 рядків), ніде не referenced
--   shopping_list           — порожній дублікат shopping_lists (0 рядків)
--   meals_backup_before_streaks — явний backup від streak-міграції (12 рядків)
--   cookbook_notes          — не referenced в JS/адмінці, app використовує cookbooks
--   cookbook_notebooks      — не referenced в JS/адмінці, app використовує cookbooks
--   product_similar         — порожня таблиця (0 рядків), без refів
--
-- НЕ чіпаємо:
--   subscription            — порожня, але зарезервована під Фазу 19 (монетизація)
--   messages_2026_05_*      — Supabase Realtime internal partitions, не чіпати
--   user_profiles           — активно використовується profile.js
--   profiles                — активно використовується auth/admin/RLS
-- ============================================================

DROP TABLE IF EXISTS recipetest;
DROP TABLE IF EXISTS shopping_list;
DROP TABLE IF EXISTS meals_backup_before_streaks;
DROP TABLE IF EXISTS cookbook_notes;
DROP TABLE IF EXISTS cookbook_notebooks;
DROP TABLE IF EXISTS product_similar;
DROP TABLE IF EXISTS old_products;  -- замінена новою products таблицею
