-- READ-ONLY preflight before moving every active recipe into admin moderation.
-- Safe to run in Supabase SQL Editor: this transaction cannot modify data.

BEGIN TRANSACTION READ ONLY;

-- 1. Exact target size and ownership split. The product decision for this
-- environment is that every active row is imported/test data and may be queued.
SELECT
  count(*) FILTER (WHERE deleted_at IS NULL) AS active_target_rows,
  count(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted_rows,
  count(*) FILTER (WHERE deleted_at IS NULL AND user_id IS NULL) AS active_without_user,
  count(*) FILTER (WHERE deleted_at IS NULL AND user_id IS NOT NULL) AS active_with_test_user
FROM public.recipes;

-- 2. Current state distribution that will be replaced by pending/public.
SELECT
  status,
  is_public,
  (user_id IS NULL) AS has_no_user,
  count(*) AS row_count
FROM public.recipes
WHERE deleted_at IS NULL
GROUP BY status, is_public, (user_id IS NULL)
ORDER BY row_count DESC, status, is_public, has_no_user;

-- 3. Hard blockers for the existing validate_public_recipe trigger.
-- The migration must abort unless both counts are zero.
SELECT
  count(*) FILTER (
    WHERE name_ua IS NULL OR btrim(name_ua) = ''
  ) AS missing_ua_name,
  count(*) FILTER (
    WHERE (ingredients IS NULL OR btrim(ingredients) = '')
      AND (steps IS NULL OR btrim(steps) = '')
  ) AS missing_ingredients_and_steps,
  count(*) FILTER (WHERE has_pending_update IS TRUE) AS staged_updates,
  count(*) FILTER (WHERE is_image_flagged IS TRUE) AS flagged_images
FROM public.recipes
WHERE deleted_at IS NULL;

-- 4. Samples of any blocking rows for correction before the migration.
SELECT
  id,
  name_ua,
  status,
  is_public,
  user_id,
  has_pending_update,
  CASE
    WHEN name_ua IS NULL OR btrim(name_ua) = '' THEN 'missing_name_ua'
    WHEN (ingredients IS NULL OR btrim(ingredients) = '')
      AND (steps IS NULL OR btrim(steps) = '') THEN 'missing_ingredients_and_steps'
    WHEN has_pending_update IS TRUE THEN 'has_pending_update'
    ELSE 'other'
  END AS blocker
FROM public.recipes
WHERE deleted_at IS NULL
  AND (
    name_ua IS NULL
    OR btrim(name_ua) = ''
    OR (
      (ingredients IS NULL OR btrim(ingredients) = '')
      AND (steps IS NULL OR btrim(steps) = '')
    )
    OR has_pending_update IS TRUE
  )
ORDER BY id
LIMIT 100;

-- 5. Confirm the accepted status values and active recipe triggers before any
-- write SQL is finalized/applied.
SELECT
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.recipes'::regclass
  AND contype = 'c'
ORDER BY conname;

SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'recipes'
ORDER BY trigger_name, event_manipulation;

-- 6. Visibility impact: immediately after the queue migration the expected
-- public catalog count is zero; each admin approval adds one published row.
SELECT
  count(*) FILTER (
    WHERE deleted_at IS NULL
      AND status = 'published'
      AND is_public IS TRUE
  ) AS public_before,
  0::bigint AS public_immediately_after,
  count(*) FILTER (WHERE deleted_at IS NULL) AS moderation_queue_after
FROM public.recipes;

ROLLBACK;
