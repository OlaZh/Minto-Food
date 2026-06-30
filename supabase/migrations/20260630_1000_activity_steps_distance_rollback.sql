-- Rollback: activity steps/distance
-- 2026-06-30
--
-- УВАГА: видаляє дані з колонок steps/distance_km і повертає
-- жорсткий NOT NULL/CHECK на duration. Записи з duration IS NULL
-- треба полагодити ПЕРЕД відкатом, інакше ALTER впаде.

ALTER TABLE user_activities
  DROP CONSTRAINT IF EXISTS user_activities_metric_present_check;

ALTER TABLE user_activities
  DROP CONSTRAINT IF EXISTS user_activities_steps_check;

ALTER TABLE user_activities
  DROP CONSTRAINT IF EXISTS user_activities_distance_km_check;

ALTER TABLE user_activities
  DROP COLUMN IF EXISTS steps,
  DROP COLUMN IF EXISTS distance_km;

-- Відновлюємо початковий контракт duration
UPDATE user_activities SET duration = 1 WHERE duration IS NULL OR duration <= 0;

ALTER TABLE user_activities
  ALTER COLUMN duration SET NOT NULL;

ALTER TABLE user_activities
  ADD CONSTRAINT user_activities_duration_check CHECK (duration > 0);
