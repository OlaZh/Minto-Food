-- Rollback: 20260518_1300_gdpr.sql
DROP FUNCTION IF EXISTS soft_delete_user(UUID);
ALTER TABLE profiles
  DROP COLUMN IF EXISTS deletion_requested_at,
  DROP COLUMN IF EXISTS deletion_scheduled_for;
DROP TABLE IF EXISTS gdpr_requests;
