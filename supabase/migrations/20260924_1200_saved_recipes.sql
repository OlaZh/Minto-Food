-- Saved recipes use the same recipes.id. Private originals never live in recipes.image.
-- Apply after 20260915_1000_recipe_attachments_rollback.sql.
BEGIN;

ALTER TABLE public.recipes ADD COLUMN entry_type text NOT NULL DEFAULT 'manual';
ALTER TABLE public.recipes ADD CONSTRAINT recipes_entry_type_check
  CHECK (entry_type IN ('manual', 'saved'));
ALTER TABLE public.recipes ADD CONSTRAINT recipes_saved_private_check
  CHECK (entry_type <> 'saved' OR (is_public IS FALSE AND status IS NOT DISTINCT FROM 'draft' AND coalesce(image, '') = ''));

CREATE TABLE public.recipe_sources (
  id uuid PRIMARY KEY,
  recipe_id integer UNIQUE REFERENCES public.recipes(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  source_url text NOT NULL DEFAULT '',
  files jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(files) = 'array'),
  cover_path text,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  cleanup_paths text[] NOT NULL DEFAULT '{}',
  cleanup_complete boolean NOT NULL DEFAULT false
);
CREATE INDEX recipe_sources_owner_idx ON public.recipe_sources(user_id);
ALTER TABLE public.recipe_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recipe_sources FROM anon, authenticated;
GRANT SELECT ON public.recipe_sources TO authenticated;
GRANT ALL ON public.recipe_sources TO service_role;
CREATE POLICY recipe_sources_owner_read ON public.recipe_sources FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND retired_at IS NULL);

-- A restrictive policy also protects saved rows from an existing admin/broad SELECT policy.
CREATE POLICY saved_recipes_owner_only ON public.recipes AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (entry_type <> 'saved' OR user_id = auth.uid());

CREATE FUNCTION public.guard_saved_recipe_book() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.recipes r JOIN public.cookbooks b ON b.id=NEW.cookbook_id
    WHERE r.id=NEW.recipe_id AND r.entry_type='saved' AND r.user_id IS DISTINCT FROM b.user_id) THEN
    RAISE EXCEPTION 'Saved recipes belong only in their owner''s books';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_saved_recipe_book() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_saved_recipe_book BEFORE INSERT OR UPDATE ON public.cookbook_recipes
  FOR EACH ROW EXECUTE FUNCTION public.guard_saved_recipe_book();

CREATE FUNCTION public.guard_saved_recipe_type() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.entry_type = 'saved') OR
     (TG_OP = 'UPDATE' AND NEW.entry_type IS DISTINCT FROM OLD.entry_type) THEN
    IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
       AND coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb->>'role' IS DISTINCT FROM 'service_role'
       AND current_user <> 'postgres' THEN
      RAISE EXCEPTION 'Use the recipe save API to change entry type';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_saved_recipe_type BEFORE INSERT OR UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.guard_saved_recipe_type();

-- Bucket creation/configuration is supported by Supabase migrations. File deletion is API-only.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recipe-sources', 'recipe-sources', false, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif',
        'video/mp4','video/webm','video/quicktime','video/ogg']);

CREATE FUNCTION public.can_access_recipe_source_object(p_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS(SELECT 1 FROM public.recipe_sources s
    JOIN public.profiles p ON p.id = s.user_id
    WHERE s.user_id = auth.uid() AND s.retired_at IS NULL AND p.deletion_scheduled_for IS NULL
      AND split_part(p_name, '/', 1) = s.user_id::text
      AND split_part(p_name, '/', 2) = s.id::text
      AND split_part(p_name, '/', 3) <> '' AND split_part(p_name, '/', 4) = ''
      AND NOT (p_name = ANY(s.cleanup_paths))
  )
$$;
REVOKE ALL ON FUNCTION public.can_access_recipe_source_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_recipe_source_object(text) TO anon, authenticated;
CREATE FUNCTION public.can_upload_recipe_source_object(p_name text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  -- Only INSERT takes a folder lock; reads remain compatible with read-only transactions.
  PERFORM 1 FROM public.recipe_sources s WHERE s.user_id=auth.uid()
    AND s.user_id::text=split_part(p_name,'/',1) AND s.id::text=split_part(p_name,'/',2)
    AND s.retired_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN public.can_access_recipe_source_object(p_name);
END $$;
REVOKE ALL ON FUNCTION public.can_upload_recipe_source_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_upload_recipe_source_object(text) TO anon, authenticated;
CREATE POLICY recipe_sources_storage_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recipe-sources' AND public.can_access_recipe_source_object(name));
CREATE POLICY recipe_sources_storage_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-sources' AND public.can_upload_recipe_source_object(name));
CREATE POLICY recipe_sources_storage_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (bucket_id <> 'recipe-sources' OR (auth.uid() IS NOT NULL AND public.can_access_recipe_source_object(name)));
CREATE POLICY recipe_sources_storage_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id <> 'recipe-sources' OR (auth.uid() IS NOT NULL AND public.can_upload_recipe_source_object(name)));
CREATE POLICY recipe_sources_storage_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (bucket_id <> 'recipe-sources') WITH CHECK (bucket_id <> 'recipe-sources');
CREATE POLICY recipe_sources_storage_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (bucket_id <> 'recipe-sources');

-- Reserve an owner-scoped upload folder. No recipe/book is created until Save.
CREATE FUNCTION public.prepare_recipe_source(p_id uuid) RETURNS public.recipe_sources
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE s public.recipe_sources;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND deletion_scheduled_for IS NULL) THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  INSERT INTO public.recipe_sources(id, user_id) VALUES(p_id, auth.uid()) ON CONFLICT DO NOTHING;
  SELECT * INTO s FROM public.recipe_sources WHERE id = p_id AND user_id = auth.uid() AND retired_at IS NULL;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Source unavailable'; END IF;
  RETURN s;
END $$;
REVOKE ALL ON FUNCTION public.prepare_recipe_source(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_recipe_source(uuid) TO authenticated;

CREATE FUNCTION public.save_saved_recipe(
  p_user_id uuid, p_source_id uuid, p_recipe_id integer, p_name text,
  p_url text, p_files jsonb, p_cover text, p_books text[], p_version integer
) RETURNS public.recipes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE s public.recipe_sources; r public.recipes; f jsonb; obj storage.objects; n integer;
BEGIN
  SELECT * INTO s FROM public.recipe_sources WHERE id = p_source_id AND user_id = p_user_id FOR UPDATE;
  IF s.id IS NULL OR s.retired_at IS NOT NULL THEN RAISE EXCEPTION 'source_unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_user_id AND deletion_scheduled_for IS NULL) THEN
    RAISE EXCEPTION 'source_unavailable';
  END IF;
  IF nullif(btrim(p_name), '') IS NULL THEN RAISE EXCEPTION 'name_required'; END IF;
  IF p_url IS NULL OR (p_url <> '' AND p_url !~* '^https?://[^[:space:]/]+') THEN RAISE EXCEPTION 'invalid_source_url'; END IF;
  IF jsonb_typeof(p_files) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_source_files'; END IF;
  IF p_recipe_id IS NOT NULL AND s.recipe_id IS DISTINCT FROM p_recipe_id THEN RAISE EXCEPTION 'source_unavailable'; END IF;
  -- A repeated create request after a lost response returns the very same recipe.
  IF s.recipe_id IS NOT NULL THEN
    SELECT * INTO r FROM public.recipes WHERE id=s.recipe_id AND user_id=p_user_id FOR UPDATE;
    IF r.id IS NULL THEN RAISE EXCEPTION 'source_unavailable'; END IF;
    IF p_recipe_id IS NULL THEN RETURN r; END IF;
    IF r.entry_type <> 'saved' THEN RAISE EXCEPTION 'already_converted'; END IF;
  END IF;
  IF s.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'source_conflict'; END IF;
  SELECT count(DISTINCT value->>'path') INTO n FROM jsonb_array_elements(p_files);
  IF n <> jsonb_array_length(p_files) THEN RAISE EXCEPTION 'invalid_source_files'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(p_files) LOOP
    IF split_part(f->>'path','/',1) IS DISTINCT FROM p_user_id::text
       OR split_part(f->>'path','/',2) IS DISTINCT FROM s.id::text
       OR f->>'path' = ANY(s.cleanup_paths) THEN RAISE EXCEPTION 'invalid_source_files'; END IF;
    SELECT * INTO obj FROM storage.objects WHERE bucket_id='recipe-sources' AND name=f->>'path';
    IF obj.id IS NULL OR obj.metadata->>'mimetype' IS DISTINCT FROM f->>'mime'
       OR (obj.metadata->>'size')::bigint IS DISTINCT FROM (f->>'size')::bigint
       OR coalesce((obj.metadata->>'size')::bigint,0) <= 0 THEN RAISE EXCEPTION 'invalid_source_files'; END IF;
    IF f->>'mime' = ANY(ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif']) THEN
      IF f->>'kind' IS DISTINCT FROM 'image' OR (obj.metadata->>'size')::bigint > 10485760 THEN RAISE EXCEPTION 'image_too_large'; END IF;
    ELSIF f->>'mime' = ANY(ARRAY['video/mp4','video/webm','video/quicktime','video/ogg']) THEN
      IF f->>'kind' IS DISTINCT FROM 'video' OR (obj.metadata->>'size')::bigint > 52428800 THEN RAISE EXCEPTION 'video_too_large'; END IF;
    ELSE RAISE EXCEPTION 'invalid_source_files'; END IF;
  END LOOP;
  IF p_cover IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_files) item WHERE item->>'path'=p_cover AND item->>'kind'='image') THEN
    RAISE EXCEPTION 'invalid_source_cover';
  END IF;
  IF coalesce(cardinality(p_books),0)=0 OR EXISTS (
    SELECT 1 FROM unnest(p_books) b WHERE NOT EXISTS (SELECT 1 FROM public.cookbooks WHERE id::text=b AND user_id=p_user_id)
  ) THEN RAISE EXCEPTION 'invalid_source_books'; END IF;
  IF s.recipe_id IS NULL THEN
    INSERT INTO public.recipes(user_id,name_ua,entry_type,is_public,status)
      VALUES(p_user_id,btrim(p_name),'saved',false,'draft') RETURNING * INTO r;
  ELSE
    UPDATE public.recipes SET name_ua=btrim(p_name) WHERE id=s.recipe_id RETURNING * INTO r;
  END IF;
  UPDATE public.recipe_sources SET recipe_id=r.id,source_url=p_url,files=p_files,cover_path=p_cover,version=version+1,cleanup_complete=false,
    cleanup_paths=cleanup_paths || ARRAY(SELECT old_file->>'path' FROM jsonb_array_elements(s.files) old_file
      WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_files) new_file WHERE new_file->>'path'=old_file->>'path'))
    WHERE id=s.id;
  INSERT INTO public.cookbook_recipes(cookbook_id,recipe_id)
    SELECT id,r.id FROM public.cookbooks WHERE id::text=ANY(p_books) AND user_id=p_user_id
    ON CONFLICT DO NOTHING;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.save_saved_recipe(uuid,uuid,integer,text,text,jsonb,text,text[],integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_saved_recipe(uuid,uuid,integer,text,text,jsonb,text,text[],integer) TO service_role;

-- Retain the source folder after recipe deletion until Storage API cleanup succeeds.
CREATE FUNCTION public.retire_recipe_source() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.recipe_id IS NOT NULL AND NEW.recipe_id IS NULL THEN NEW.retired_at=now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER retire_recipe_source BEFORE UPDATE ON public.recipe_sources
  FOR EACH ROW EXECUTE FUNCTION public.retire_recipe_source();

-- Claims abandoned drafts before listing files; claimed folders can no longer be uploaded/saved.
CREATE FUNCTION public.claim_recipe_source_cleanup(p_user_id uuid DEFAULT NULL)
RETURNS SETOF public.recipe_sources LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE s public.recipe_sources; abandoned text[];
BEGIN
  UPDATE public.recipe_sources SET retired_at=coalesce(retired_at,now())
  WHERE (p_user_id IS NOT NULL AND user_id=p_user_id AND EXISTS(
    SELECT 1 FROM public.profiles WHERE id=p_user_id AND deletion_scheduled_for<=now()))
    OR (p_user_id IS NULL AND recipe_id IS NULL AND created_at<now()-interval '24 hours');
  IF p_user_id IS NULL THEN
    -- An interrupted edit can upload files without committing a new manifest.
    -- Lock each source before claiming those paths so a concurrent save cannot reattach them.
    FOR s IN SELECT * FROM public.recipe_sources WHERE retired_at IS NULL AND recipe_id IS NOT NULL FOR UPDATE SKIP LOCKED LOOP
      SELECT array_agg(o.name) INTO abandoned FROM storage.objects o
      WHERE o.bucket_id='recipe-sources' AND split_part(o.name,'/',1)=s.user_id::text
        AND split_part(o.name,'/',2)=s.id::text AND o.created_at<now()-interval '24 hours'
        AND NOT (o.name=ANY(s.cleanup_paths))
        AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.files) item WHERE item->>'path'=o.name);
      IF cardinality(abandoned)>0 THEN
        UPDATE public.recipe_sources SET cleanup_paths=cleanup_paths||abandoned,cleanup_complete=false,version=version+1 WHERE id=s.id;
      END IF;
    END LOOP;
  END IF;
  RETURN QUERY SELECT * FROM public.recipe_sources
    WHERE (p_user_id IS NULL OR user_id=p_user_id) AND (retired_at IS NOT NULL OR (cardinality(cleanup_paths)>0 AND NOT cleanup_complete));
END $$;
REVOKE ALL ON FUNCTION public.claim_recipe_source_cleanup(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_recipe_source_cleanup(uuid) TO service_role;

COMMIT;
