-- Rollback: 20260518_1400_tags_taxonomy.sql
-- Деактивує всі нові теги (не видаляє — збережені посилання в recipe_tags).
-- Для повного відновлення використовуй Supabase backup.

UPDATE tags SET is_active = false;
