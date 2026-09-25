-- Roll back recipe attachments after reverting application code to b93af74.
-- The forward migration is retained unchanged as applied migration history.
--
-- Before running: back up the database; verify this on a staging copy.
-- Remove the EMPTY recipe-attachments bucket through Storage Dashboard/API.
-- This script refuses to discard attachments, files, or unfinished cleanup jobs.
-- If it stops, resolve the reported data condition before retrying; do not
-- bypass the guards or delete storage.objects/storage.buckets with SQL.
-- Existing recipes, nutrition, main photos, and pre-existing moderation RPCs
-- are preserved. No recipe/user deletion function is executed.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Serialize against recipe saves and uploads for the duration of the checks.
LOCK TABLE public.recipes, public.recipe_pending_updates IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.recipe_attachments IN ACCESS EXCLUSIVE MODE;
LOCK TABLE storage.buckets, storage.objects IN SHARE MODE;

DO $$
DECLARE
  v_count bigint;
  v_table text;
BEGIN
  SELECT count(*) INTO v_count FROM public.recipe_attachments;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Rollback stopped: % attachment records must be preserved or explicitly cleared first.', v_count;
  END IF;

  -- The first release had no cleanup tables; the later release added both.
  FOREACH v_table IN ARRAY ARRAY['recipe_media_cleanup_jobs', 'recipe_media_cleanup_files'] LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', v_table);
      EXECUTE format('SELECT count(*) FROM public.%I', v_table) INTO v_count;
      IF v_count > 0 THEN
        RAISE EXCEPTION 'Rollback stopped: % contains % unfinished cleanup records.', v_table, v_count;
      END IF;
      IF to_regprocedure('public.hard_delete_user_data_without_media(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Rollback stopped: cleanup schema exists but the original GDPR function is missing.';
      END IF;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id = 'recipe-attachments';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Rollback stopped: recipe-attachments contains % stored files. Preserve them before removing the feature.', v_count;
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'recipe-attachments') THEN
    RAISE EXCEPTION 'Rollback stopped: remove the empty recipe-attachments bucket using Storage Dashboard/API, then retry this complete script.';
  END IF;
  IF to_regprocedure('public.hard_delete_user_data(uuid)') IS NULL
    OR to_regprocedure('public.apply_pending_update(integer)') IS NULL
    OR to_regprocedure('public.discard_pending_update(integer)') IS NULL THEN
    RAISE EXCEPTION 'Rollback stopped: a pre-existing GDPR/moderation function is missing.';
  END IF;
END;
$$;

-- Remove only attachment keys from staged edits. Keep text/photo edits and
-- recalculate the pending flag only for recipes whose media entries changed.
CREATE TEMP TABLE rollback_recipe_media_affected ON COMMIT DROP AS
SELECT DISTINCT recipe_id FROM public.recipe_pending_updates
WHERE changes ? 'media_revision';

DELETE FROM public.recipe_pending_updates
WHERE changes ? 'media_revision' AND (changes - 'media_revision') = '{}'::jsonb;
UPDATE public.recipe_pending_updates SET changes = changes - 'media_revision'
WHERE changes ? 'media_revision';
UPDATE public.recipes r SET has_pending_update = EXISTS (
  SELECT 1 FROM public.recipe_pending_updates p WHERE p.recipe_id = r.id
)
WHERE r.id IN (SELECT recipe_id FROM rollback_recipe_media_affected);

-- Drop only policies introduced by the attachment migration. Other buckets'
-- existing policies are untouched; the feature bucket must already be absent.
DROP POLICY IF EXISTS recipe_media_active_upload ON storage.objects;
DROP POLICY IF EXISTS recipe_media_no_overwrite ON storage.objects;
DROP POLICY IF EXISTS recipe_media_upload_guard ON storage.objects;
DROP POLICY IF EXISTS recipe_media_read_guard ON storage.objects;
DROP POLICY IF EXISTS recipe_media_delete_guard ON storage.objects;
DROP POLICY IF EXISTS recipe_attachments_upload ON storage.objects;
DROP POLICY IF EXISTS recipe_attachments_read ON storage.objects;
DROP POLICY IF EXISTS recipe_attachments_delete_unused ON storage.objects;
DROP POLICY IF EXISTS recipe_attachments_read ON public.recipe_attachments;

DROP FUNCTION IF EXISTS public.recipe_media_cleanup_step(uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.recipe_media_upload_allowed();
DROP FUNCTION IF EXISTS public.save_private_recipe(integer, uuid, jsonb);
DROP FUNCTION IF EXISTS public.review_recipe_media(integer, uuid, boolean, text);
DROP FUNCTION IF EXISTS public.save_recipe_media(integer, uuid, jsonb);
DROP FUNCTION IF EXISTS public.get_recipe_media(integer, boolean);
DROP FUNCTION IF EXISTS public.can_read_recipe_media(integer, uuid);

-- Restore the original function body by renaming it back. The wrapper's
-- forward migration changed its search_path and grants; restore the baseline
-- configuration used by 20260729_1100_gdpr_hard_delete_v3.sql as well.
DO $$
BEGIN
  IF to_regprocedure('public.hard_delete_user_data_without_media(uuid)') IS NOT NULL THEN
    DROP FUNCTION public.hard_delete_user_data(uuid);
    ALTER FUNCTION public.hard_delete_user_data_without_media(uuid) RENAME TO hard_delete_user_data;
    ALTER FUNCTION public.hard_delete_user_data(uuid) RESET search_path;
    REVOKE ALL ON FUNCTION public.hard_delete_user_data(uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.hard_delete_user_data(uuid) TO service_role;
  END IF;
END;
$$;

DROP TABLE IF EXISTS public.recipe_media_cleanup_files;
DROP TABLE IF EXISTS public.recipe_media_cleanup_jobs;
DROP TABLE public.recipe_attachments;
DROP TRIGGER IF EXISTS guard_recipe_media_revision ON public.recipes;
DROP FUNCTION IF EXISTS public.guard_recipe_media_revision();
ALTER TABLE public.recipes DROP COLUMN media_revision;
ALTER TABLE public.recipes DROP COLUMN published_media_revision;

-- No CASCADE: an unexpected dependency aborts this entire transaction.
NOTIFY pgrst, 'reload schema';
COMMIT;

-- A successful run returns true for every column below.
SELECT
  to_regclass('public.recipe_attachments') IS NULL AS attachments_removed,
  to_regclass('public.recipe_media_cleanup_jobs') IS NULL AS cleanup_jobs_removed,
  to_regclass('public.recipe_media_cleanup_files') IS NULL AS cleanup_files_removed,
  NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'recipe-attachments') AS bucket_removed,
  NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'recipe-attachments') AS no_stored_files,
  NOT EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid = 'public.recipes'::regclass
      AND attname IN ('media_revision', 'published_media_revision') AND NOT attisdropped
  ) AS revision_columns_removed,
  to_regprocedure('public.get_recipe_media(integer,boolean)') IS NULL AS read_rpc_removed,
  to_regprocedure('public.save_recipe_media(integer,uuid,jsonb)') IS NULL AS save_rpc_removed,
  to_regprocedure('public.review_recipe_media(integer,uuid,boolean,text)') IS NULL AS review_rpc_removed,
  to_regprocedure('public.save_private_recipe(integer,uuid,jsonb)') IS NULL AS private_rpc_removed,
  to_regprocedure('public.recipe_media_cleanup_step(uuid,text,uuid,text)') IS NULL AS cleanup_rpc_removed,
  to_regprocedure('public.hard_delete_user_data_without_media(uuid)') IS NULL AS gdpr_wrapper_removed,
  has_function_privilege('service_role', 'public.hard_delete_user_data(uuid)', 'EXECUTE') AS gdpr_service_access,
  NOT has_function_privilege('anon', 'public.hard_delete_user_data(uuid)', 'EXECUTE') AS gdpr_guests_denied,
  NOT has_function_privilege('authenticated', 'public.hard_delete_user_data(uuid)', 'EXECUTE') AS gdpr_users_denied,
  to_regprocedure('public.apply_pending_update(integer)') IS NOT NULL AS existing_approval_preserved,
  to_regprocedure('public.discard_pending_update(integer)') IS NOT NULL AS existing_rejection_preserved;
