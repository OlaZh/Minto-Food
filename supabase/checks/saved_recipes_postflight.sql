-- Read-only checks after 20260924_1200_saved_recipes.sql; every value should be true.
SELECT
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='recipes' AND column_name='entry_type') AS entry_type_installed,
  EXISTS(SELECT 1 FROM storage.buckets WHERE id='recipe-sources' AND NOT public AND file_size_limit=52428800) AS bucket_private,
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.recipe_sources'::regclass) AS sources_rls,
  NOT has_table_privilege('anon','public.recipe_sources','SELECT') AS guests_denied,
  has_table_privilege('authenticated','public.recipe_sources','SELECT') AS owner_read_enabled,
  NOT has_table_privilege('authenticated','public.recipe_sources','INSERT,UPDATE,DELETE') AS client_writes_denied,
  NOT has_function_privilege('authenticated','public.save_saved_recipe(uuid,uuid,integer,text,text,jsonb,text,text[],integer)','EXECUTE') AS save_rpc_private,
  has_function_privilege('service_role','public.save_saved_recipe(uuid,uuid,integer,text,text,jsonb,text,text[],integer)','EXECUTE') AS save_rpc_service,
  NOT has_function_privilege('authenticated','public.claim_recipe_source_cleanup(uuid)','EXECUTE') AS cleanup_rpc_private,
  NOT EXISTS(SELECT 1 FROM public.recipes WHERE entry_type='saved' AND (is_public IS DISTINCT FROM false OR status IS DISTINCT FROM 'draft' OR coalesce(image,'')<>'')) AS saved_entries_private,
  EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.recipe_sources'::regclass AND confrelid='public.profiles'::regclass AND confdeltype='r') AS cleanup_before_account_delete;
