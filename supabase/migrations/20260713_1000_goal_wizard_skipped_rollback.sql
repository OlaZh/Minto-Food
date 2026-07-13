-- Rollback 20260713_1000_goal_wizard_skipped
ALTER TABLE profiles
  DROP COLUMN IF EXISTS goal_wizard_skipped;
