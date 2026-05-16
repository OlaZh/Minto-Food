-- ============================================================
-- Private / Public Recipe Architecture
-- Запустити в Supabase SQL Editor
--
-- Що робить:
--   1. Змінює is_public DEFAULT true → false (нові рецепти приватні за замовчуванням)
--   2. Backfill: draft-рецепти → is_public = false (вони ніколи не були публічними)
--   3. Pending/published залишаються is_public = true (юзер свідомо опублікував)
-- ============================================================

-- 1. Змінити дефолт
ALTER TABLE recipes ALTER COLUMN is_public SET DEFAULT false;

-- 2. Backfill: draft-рецепти → приватні
UPDATE recipes
SET is_public = false
WHERE status = 'draft'
  AND deleted_at IS NULL;

-- 3. Переконатись, що published/pending залишились публічними
UPDATE recipes
SET is_public = true
WHERE status IN ('published', 'pending', 'scheduled')
  AND deleted_at IS NULL;
