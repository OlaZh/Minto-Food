-- Read-only installation checks; does not upload/delete files or delete users.
SELECT
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'recipe-attachments' AND public = false) AS private_bucket,
  to_regclass('public.recipe_attachments') IS NOT NULL AS attachment_table,
  to_regclass('public.recipe_media_cleanup_jobs') IS NOT NULL AS cleanup_jobs,
  to_regclass('public.recipe_media_cleanup_files') IS NOT NULL AS cleanup_files,
  to_regprocedure('public.get_recipe_media(integer,boolean)') IS NOT NULL AS read_rpc,
  to_regprocedure('public.save_recipe_media(integer,uuid,jsonb)') IS NOT NULL AS save_rpc,
  to_regprocedure('public.review_recipe_media(integer,uuid,boolean,text)') IS NOT NULL AS review_rpc,
  to_regprocedure('public.recipe_media_cleanup_step(uuid,text,uuid,text)') IS NOT NULL AS cleanup_rpc;

SELECT
  has_function_privilege('service_role', 'public.hard_delete_user_data(uuid)', 'EXECUTE') AS service_can_prepare,
  NOT has_function_privilege('authenticated', 'public.hard_delete_user_data(uuid)', 'EXECUTE') AS users_cannot_prepare,
  NOT has_function_privilege('service_role', 'public.hard_delete_user_data_without_media(uuid)', 'EXECUTE') AS no_legacy_bypass,
  NOT has_function_privilege('anon', 'public.recipe_media_cleanup_step(uuid,text,uuid,text)', 'EXECUTE') AS guests_cannot_clean,
  NOT has_table_privilege('authenticated', 'public.recipe_media_cleanup_jobs', 'SELECT') AS queue_private,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.recipe_attachments'::regclass) AS attachments_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.recipe_media_cleanup_jobs'::regclass) AS jobs_rls;

SELECT
  count(*) FILTER (WHERE policyname = 'recipe_media_no_overwrite' AND permissive = 'RESTRICTIVE') = 1 AS immutable_files,
  count(*) FILTER (WHERE policyname = 'recipe_media_read_guard' AND permissive = 'RESTRICTIVE') = 1 AS guarded_read,
  count(*) FILTER (WHERE policyname = 'recipe_media_active_upload' AND permissive = 'RESTRICTIVE') = 1 AS guarded_upload
FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
