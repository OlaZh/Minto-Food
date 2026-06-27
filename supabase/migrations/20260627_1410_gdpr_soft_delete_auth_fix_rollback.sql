-- Rollback: restore previous soft_delete_user() auth check.
-- 2026-06-27

CREATE OR REPLACE FUNCTION public.soft_delete_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE profiles
  SET
    deletion_requested_at = now(),
    deletion_scheduled_for = now() + INTERVAL '30 days'
  WHERE id = p_user_id;

  INSERT INTO gdpr_requests (user_id, type, status)
  VALUES (p_user_id, 'delete', 'pending')
  ON CONFLICT DO NOTHING;
END;
$$;
