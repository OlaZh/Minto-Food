-- ============================================================
-- Feature Flags
-- 2026-05-18
--
-- Що робить:
--   1. Таблиця feature_flags — глобальні прапори функціональності
--   2. RLS: тільки адміни пишуть, всі читають увімкнені
--   3. Indexes для швидкого lookup
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  key           TEXT        PRIMARY KEY,
  enabled       BOOLEAN     NOT NULL DEFAULT false,
  rollout_pct   SMALLINT    NOT NULL DEFAULT 100
    CHECK (rollout_pct BETWEEN 0 AND 100),
  target_users  UUID[]      DEFAULT '{}',
  description   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID        REFERENCES auth.users(id)
);

COMMENT ON TABLE feature_flags IS
  'Global feature flags. Toggled by admins without deploy.';
COMMENT ON COLUMN feature_flags.rollout_pct IS
  '0-100: відсоток юзерів, яким доступна фіча (для поступового rollout).';
COMMENT ON COLUMN feature_flags.target_users IS
  'Якщо не порожній — фіча ввімкнена тільки для цих user_id незалежно від rollout_pct.';

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Всі автентифіковані (і анон) читають тільки увімкнені флаги
DROP POLICY IF EXISTS "public_read_enabled_flags" ON feature_flags;
CREATE POLICY "public_read_enabled_flags"
  ON feature_flags FOR SELECT
  USING (enabled = true);

-- Адміни читають і змінюють все
DROP POLICY IF EXISTS "admins_all_feature_flags" ON feature_flags;
CREATE POLICY "admins_all_feature_flags"
  ON feature_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Seed: стартові флаги (всі вимкнені за замовчуванням)
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('social_features_enabled', false, 'Follow, public profiles, social proof на рецептах'),
  ('ai_scan_enabled',         false, 'AI scan рецептів зі скріншотів (Premium)'),
  ('paywall_enabled',         false, 'Paywall та монетизація'),
  ('new_onboarding',          false, 'Новий onboarding wizard для нових юзерів'),
  ('referral_enabled',        false, 'Referral program')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled
  ON feature_flags(key) WHERE enabled = true;
