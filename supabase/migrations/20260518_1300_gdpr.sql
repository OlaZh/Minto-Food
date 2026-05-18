-- ============================================================
-- GDPR Infrastructure
-- 2026-05-18
--
-- Що робить:
--   1. Таблиця gdpr_requests — лог всіх GDPR-запитів (compliance trail)
--   2. Soft delete для profiles (deleted_at + grace period)
--   3. Функція: soft_delete_user() — каскадне видалення з grace period
-- ============================================================

-- 1. GDPR requests log
CREATE TABLE IF NOT EXISTS gdpr_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id),
  type         TEXT        NOT NULL CHECK (type IN ('export', 'delete', 'rectification')),
  status       TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes        TEXT
);

COMMENT ON TABLE gdpr_requests IS
  'Compliance trail for GDPR requests (export, delete, rectification).';

ALTER TABLE gdpr_requests ENABLE ROW LEVEL SECURITY;

-- Юзер бачить тільки свої запити
DROP POLICY IF EXISTS "owner_select_gdpr_requests" ON gdpr_requests;
CREATE POLICY "owner_select_gdpr_requests"
  ON gdpr_requests FOR SELECT
  USING (user_id = auth.uid());

-- Юзер може створювати свої запити
DROP POLICY IF EXISTS "owner_insert_gdpr_requests" ON gdpr_requests;
CREATE POLICY "owner_insert_gdpr_requests"
  ON gdpr_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Адміни бачать всі
DROP POLICY IF EXISTS "admins_all_gdpr_requests" ON gdpr_requests;
CREATE POLICY "admins_all_gdpr_requests"
  ON gdpr_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user_id ON gdpr_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status  ON gdpr_requests(status) WHERE status = 'pending';

-- ============================================================
-- 2. Soft delete для profiles
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ;

COMMENT ON COLUMN profiles.deletion_requested_at  IS 'Коли юзер запросив видалення (GDPR).';
COMMENT ON COLUMN profiles.deletion_scheduled_for IS 'Hard delete не раніше цієї дати (30-денний grace period).';

-- ============================================================
-- 3. Функція soft_delete_user(p_user_id)
-- ============================================================

CREATE OR REPLACE FUNCTION soft_delete_user(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Перевірка: тільки сам юзер або адмін
  IF p_user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Позначаємо профіль для видалення (grace period 30 днів)
  UPDATE profiles
  SET
    deletion_requested_at  = now(),
    deletion_scheduled_for = now() + INTERVAL '30 days'
  WHERE id = p_user_id;

  -- Логуємо GDPR запит
  INSERT INTO gdpr_requests (user_id, type, status)
  VALUES (p_user_id, 'delete', 'pending')
  ON CONFLICT DO NOTHING;
END;
$$;
