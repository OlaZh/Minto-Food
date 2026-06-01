-- ============================================================
-- Profile preferences moved out of browser localStorage
-- 2026-06-01
--
-- Stores UI/user clipboard state in profiles so the client can
-- stop persisting app data in localStorage.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ua',
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS unit_system text NOT NULL DEFAULT 'metric',
  ADD COLUMN IF NOT EXISTS copied_day jsonb,
  ADD COLUMN IF NOT EXISTS copied_week jsonb,
  ADD COLUMN IF NOT EXISTS welcome_seen_on date;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_language_check,
  DROP CONSTRAINT IF EXISTS profiles_theme_check,
  DROP CONSTRAINT IF EXISTS profiles_unit_system_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_language_check
    CHECK (language IN ('ua', 'en', 'pl')),
  ADD CONSTRAINT profiles_theme_check
    CHECK (theme IN ('light', 'dark')),
  ADD CONSTRAINT profiles_unit_system_check
    CHECK (unit_system IN ('metric', 'imperial'));
