-- Rollback for 20260724_1000_image_moderation.sql

DROP FUNCTION IF EXISTS override_image_flag(integer, boolean);
DROP FUNCTION IF EXISTS stage_recipe_update(integer, uuid, jsonb, jsonb, boolean, numeric);
DROP FUNCTION IF EXISTS reserve_moderation_slot(uuid, integer);
DROP FUNCTION IF EXISTS finalize_moderation_slot(uuid, integer, text, numeric, text, jsonb);
DROP FUNCTION IF EXISTS apply_pending_update(integer);
DROP FUNCTION IF EXISTS discard_pending_update(integer);

DROP TRIGGER IF EXISTS trg_enforce_recipe_moderation ON recipes;
DROP FUNCTION IF EXISTS enforce_recipe_moderation_fields();

DROP TABLE IF EXISTS image_moderation_log;

DROP INDEX IF EXISTS idx_recipes_image_flagged;

ALTER TABLE recipes
  DROP COLUMN IF EXISTS is_image_flagged,
  DROP COLUMN IF EXISTS image_nsfw_score,
  DROP COLUMN IF EXISTS image_moderated_at;
