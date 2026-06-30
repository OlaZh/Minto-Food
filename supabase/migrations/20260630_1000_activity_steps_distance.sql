-- ============================================================
-- Activity: кроки та дистанція як альтернатива хвилинам
-- 2026-06-30
--
-- Для ходьби природніше вводити кроки (10000), а для велосипеда —
-- кілометри, ніж час. Калорії рахуються з урахуванням ваги:
--   кроки × вага × 0.00057   (ходьба)
--   км    × вага × 0.5       (велосипед)
-- Хвилини лишаються опційними, тож послаблюємо CHECK на duration:
-- запис валідний, якщо є duration АБО steps АБО distance_km.
-- ============================================================

ALTER TABLE user_activities
  ADD COLUMN IF NOT EXISTS steps       integer,
  ADD COLUMN IF NOT EXISTS distance_km numeric(6, 2);

-- Раніше: duration > 0 NOT NULL. Тепер duration може бути 0/NULL,
-- якщо активність задана кроками чи кілометрами.
ALTER TABLE user_activities
  ALTER COLUMN duration DROP NOT NULL;

ALTER TABLE user_activities
  DROP CONSTRAINT IF EXISTS user_activities_duration_check;

ALTER TABLE user_activities
  ADD CONSTRAINT user_activities_metric_present_check
  CHECK (
    COALESCE(duration, 0) > 0
    OR COALESCE(steps, 0) > 0
    OR COALESCE(distance_km, 0) > 0
  );

ALTER TABLE user_activities
  ADD CONSTRAINT user_activities_steps_check       CHECK (steps IS NULL OR steps >= 0);

ALTER TABLE user_activities
  ADD CONSTRAINT user_activities_distance_km_check CHECK (distance_km IS NULL OR distance_km >= 0);
