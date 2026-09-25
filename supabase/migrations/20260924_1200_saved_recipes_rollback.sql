-- Refuses to discard saved recipes, originals or Storage files. API-delete an empty bucket first.
BEGIN;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.recipes WHERE entry_type='saved') OR EXISTS(SELECT 1 FROM public.recipe_sources) THEN
    RAISE EXCEPTION 'Rollback stopped: saved recipes or private sources still exist';
  END IF;
  IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='recipe-sources') THEN
    RAISE EXCEPTION 'Rollback stopped: source files still exist';
  END IF;
  IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='recipe-sources') THEN
    RAISE EXCEPTION 'Rollback stopped: delete the empty recipe-sources bucket using Storage Dashboard/API';
  END IF;
END $$;
DROP POLICY recipe_sources_storage_read ON storage.objects;
DROP POLICY recipe_sources_storage_insert ON storage.objects;
DROP POLICY recipe_sources_storage_read_guard ON storage.objects;
DROP POLICY recipe_sources_storage_insert_guard ON storage.objects;
DROP POLICY recipe_sources_storage_update_guard ON storage.objects;
DROP POLICY recipe_sources_storage_delete_guard ON storage.objects;
DROP POLICY saved_recipes_owner_only ON public.recipes;
DROP TRIGGER guard_saved_recipe_book ON public.cookbook_recipes;
DROP FUNCTION public.guard_saved_recipe_book();
DROP TRIGGER guard_saved_recipe_type ON public.recipes;
DROP FUNCTION public.guard_saved_recipe_type();
DROP FUNCTION public.can_access_recipe_source_object(text);
DROP FUNCTION public.can_upload_recipe_source_object(text);
DROP FUNCTION public.prepare_recipe_source(uuid);
DROP FUNCTION public.save_saved_recipe(uuid,uuid,integer,text,text,jsonb,text,text[],integer);
DROP FUNCTION public.claim_recipe_source_cleanup(uuid);
DROP TABLE public.recipe_sources;
DROP FUNCTION public.retire_recipe_source();
ALTER TABLE public.recipes DROP CONSTRAINT recipes_saved_private_check;
ALTER TABLE public.recipes DROP CONSTRAINT recipes_entry_type_check;
ALTER TABLE public.recipes DROP COLUMN entry_type;
COMMIT;
