-- ============================================================
-- At most one explicitly default cookbook per user
-- 2026-08-07
--
-- This migration never edits or deletes cookbooks. If historical data
-- already contains multiple is_default = true rows for one user, it stops
-- before creating the index so that cleanup can be reviewed separately.
-- ============================================================

DO $$
DECLARE
  duplicate_user_count BIGINT;
BEGIN
  SELECT count(*)
  INTO duplicate_user_count
  FROM (
    SELECT user_id
    FROM public.cookbooks
    WHERE is_default IS TRUE
    GROUP BY user_id
    HAVING count(*) > 1
  ) AS duplicate_defaults;

  IF duplicate_user_count > 0 THEN
    RAISE EXCEPTION
      'Cannot enforce one default cookbook: % user(s) currently have multiple default cookbooks',
      duplicate_user_count
      USING HINT = 'Review: SELECT user_id, count(*) FROM public.cookbooks WHERE is_default IS TRUE GROUP BY user_id HAVING count(*) > 1;';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cookbooks_one_default_per_user
  ON public.cookbooks (user_id)
  WHERE is_default IS TRUE;

COMMENT ON INDEX public.uq_cookbooks_one_default_per_user IS
  'Prevents concurrent creation of more than one explicitly default cookbook per user.';
