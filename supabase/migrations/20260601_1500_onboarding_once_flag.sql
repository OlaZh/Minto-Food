-- ============================================================
-- Separate one-time onboarding state from daily welcome toast
-- 2026-06-01
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS welcome_intro_seen boolean NOT NULL DEFAULT false;
