-- ============================================================
-- Profile reminder preferences + account deletion cancellation
-- 2026-06-01
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS meal_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS water_reminders_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION cancel_soft_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE profiles
  SET
    deletion_requested_at = NULL,
    deletion_scheduled_for = NULL
  WHERE id = p_user_id;

  UPDATE gdpr_requests
  SET
    status = 'failed',
    completed_at = now(),
    notes = CASE
      WHEN notes IS NULL OR notes = '' THEN 'Cancelled by user before deletion deadline'
      ELSE notes || E'\nCancelled by user before deletion deadline'
    END
  WHERE user_id = p_user_id
    AND type = 'delete'
    AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_soft_delete_user(uuid) TO authenticated;
