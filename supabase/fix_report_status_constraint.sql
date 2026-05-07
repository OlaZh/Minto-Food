-- ============================================================
-- FIX: recipe_reports status constraint + resolved columns
-- Запустити в Supabase SQL Editor
-- ============================================================

-- 1. Видалити старий CHECK constraint на status (якщо не містить 'dismissed')
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'recipe_reports'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE recipe_reports DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

-- 2. Додати правильний CHECK constraint з усіма статусами
ALTER TABLE recipe_reports
  ADD CONSTRAINT recipe_reports_status_check
  CHECK (status IN ('pending', 'resolved', 'dismissed'));

-- 3. Додати resolved_by і resolved_at (якщо ще не існують)
ALTER TABLE recipe_reports
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
