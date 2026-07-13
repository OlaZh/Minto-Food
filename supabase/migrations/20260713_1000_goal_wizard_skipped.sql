-- ============================================================
-- Прапор пропуску goal-setup wizard
-- 2026-07-13
--
-- Wizard параметрів тіла (onboarding-wizard.js) показувався при
-- кожному вході, доки user_profiles не заповнений, і не мав кнопки
-- «Пропустити». Тепер пропуск зберігається в акаунті — як
-- welcome_intro_seen — і їде за користувачем на будь-який пристрій
-- (localStorage свідомо НЕ використовуємо, див. урок cookie consent
-- у 20260602_1500_profile_cookie_consent.sql).
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS goal_wizard_skipped boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.goal_wizard_skipped IS 'Користувач пропустив goal-setup wizard; більше не показувати (заповнить у профілі)';

-- Примітка щодо RLS:
-- окремі політики не потрібні — колонка лежить у вже захищеній
-- таблиці profiles, де користувач читає/оновлює лише власний рядок
-- (auth.uid() = id).
