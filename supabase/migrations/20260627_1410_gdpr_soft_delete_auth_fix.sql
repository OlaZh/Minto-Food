-- Harden soft_delete_user() against unauthenticated calls.
-- 2026-06-27

CREATE OR REPLACE FUNCTION public.soft_delete_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
BEGIN
  -- Only the account owner or an admin may schedule deletion.
  IF v_actor_id IS NULL OR (
    p_user_id <> v_actor_id
    AND NOT EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = v_actor_id
        AND is_admin = true
    )
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
