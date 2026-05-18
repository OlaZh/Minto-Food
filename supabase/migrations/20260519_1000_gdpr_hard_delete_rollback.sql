-- Rollback: GDPR Hard Delete
-- 2026-05-19

DROP FUNCTION IF EXISTS hard_delete_user_data(UUID);
