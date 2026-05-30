-- ============================================================
-- User activities tracker
-- 2026-05-31
--
-- Історія фізичної активності (вкладка "Активність" у профілі).
-- Раніше зберігалась лише в localStorage → не синхронізувалась між
-- пристроями і зникала при чистці кешу. Тепер прив'язана до акаунта.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_activities (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type         text NOT NULL,
  label        text,
  icon         text,
  duration     integer NOT NULL CHECK (duration > 0),
  calories     integer NOT NULL CHECK (calories >= 0),
  performed_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Швидка вибірка історії користувача за датою
CREATE INDEX IF NOT EXISTS user_activities_user_perf_idx
  ON user_activities (user_id, performed_at DESC);

-- ─── RLS: кожен бачить і керує лише своїми записами ───
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_activities_select_own" ON user_activities;
DROP POLICY IF EXISTS "user_activities_insert_own" ON user_activities;
DROP POLICY IF EXISTS "user_activities_delete_own" ON user_activities;

CREATE POLICY "user_activities_select_own" ON user_activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_activities_insert_own" ON user_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_activities_delete_own" ON user_activities
  FOR DELETE USING (auth.uid() = user_id);
