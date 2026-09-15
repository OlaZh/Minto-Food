-- Recipe attachments: immutable file paths and separately approved snapshots.
-- Apply in Supabase SQL Editor before deploying the UI. No existing data is rewritten.
BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-attachments', 'recipe-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;
-- Inherit the project's existing upload size limit; no new product quota is imposed.

ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS media_revision uuid;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS published_media_revision uuid;

-- Owners may update their recipes via REST, but cannot self-approve a snapshot.
-- These columns are written only inside the SECURITY DEFINER RPCs below.
CREATE FUNCTION public.guard_recipe_media_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.media_revision IS NOT NULL OR NEW.published_media_revision IS NOT NULL THEN
        RAISE EXCEPTION 'use_recipe_media_rpc' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.media_revision IS DISTINCT FROM OLD.media_revision
       OR NEW.published_media_revision IS DISTINCT FROM OLD.published_media_revision THEN
      RAISE EXCEPTION 'use_recipe_media_rpc' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_recipe_media_revision BEFORE INSERT OR UPDATE ON public.recipes
FOR EACH ROW EXECUTE FUNCTION public.guard_recipe_media_revision();

CREATE TABLE public.recipe_attachments (
  recipe_id integer NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  revision uuid NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  section text NOT NULL CHECK (section IN ('ingredients', 'steps', 'video')),
  kind text NOT NULL CHECK (kind IN ('image', 'video', 'link')),
  storage_path text,
  external_url text,
  filename text NOT NULL DEFAULT '',
  mime_type text,
  size_bytes bigint,
  PRIMARY KEY (recipe_id, revision, position),
  CHECK ((kind = 'link' AND storage_path IS NULL AND external_url IS NOT NULL AND external_url ~ '^https?://[^[:space:]]+$')
      OR (kind IN ('image', 'video') AND storage_path IS NOT NULL AND external_url IS NULL))
);
CREATE INDEX recipe_attachments_storage_path_idx ON public.recipe_attachments(storage_path);
ALTER TABLE public.recipe_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recipe_attachments FROM anon, authenticated;
GRANT SELECT ON public.recipe_attachments TO anon, authenticated;
GRANT ALL ON public.recipe_attachments TO service_role;

CREATE FUNCTION public.can_read_recipe_media(p_recipe_id integer, p_revision uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recipes r WHERE r.id = p_recipe_id AND r.deleted_at IS NULL AND (
      r.user_id = auth.uid()
      OR (r.is_public AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))
      OR (r.is_public AND r.status = 'published' AND r.published_media_revision = p_revision)
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_recipe_media(integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_recipe_media(integer, uuid) TO anon, authenticated;
CREATE POLICY recipe_attachments_read ON public.recipe_attachments FOR SELECT TO anon, authenticated
USING (public.can_read_recipe_media(recipe_id, revision));

CREATE POLICY recipe_attachments_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'recipe-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
-- No UPDATE policy: an approved file can never be overwritten in place.
CREATE POLICY recipe_attachments_read ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'recipe-attachments' AND (
  (storage.foldername(name))[1] = auth.uid()::text
  OR EXISTS (SELECT 1 FROM public.recipe_attachments a WHERE a.storage_path = name
    AND public.can_read_recipe_media(a.recipe_id, a.revision))
));
CREATE POLICY recipe_attachments_delete_unused ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'recipe-attachments' AND (storage.foldername(name))[1] = auth.uid()::text
  AND NOT EXISTS (SELECT 1 FROM public.recipe_attachments a WHERE a.storage_path = name));

-- Restrictive guards prevent any older, broad storage policy from granting
-- access to this new bucket or permitting an approved object's replacement.
CREATE POLICY recipe_media_no_overwrite ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
USING (bucket_id <> 'recipe-attachments') WITH CHECK (bucket_id <> 'recipe-attachments');
CREATE POLICY recipe_media_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id <> 'recipe-attachments' OR (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY recipe_media_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated
USING (bucket_id <> 'recipe-attachments' OR (storage.foldername(name))[1] = auth.uid()::text
  OR EXISTS (SELECT 1 FROM public.recipe_attachments a WHERE a.storage_path = name
    AND public.can_read_recipe_media(a.recipe_id, a.revision)));
CREATE POLICY recipe_media_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated
USING (bucket_id <> 'recipe-attachments' OR ((storage.foldername(name))[1] = auth.uid()::text
  AND NOT EXISTS (SELECT 1 FROM public.recipe_attachments a WHERE a.storage_path = name)));

CREATE FUNCTION public.get_recipe_media(p_recipe_id integer, p_review boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.recipes; v_revision uuid;
BEGIN
  SELECT * INTO r FROM public.recipes WHERE id = p_recipe_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'recipe_not_found'; END IF;
  IF p_review THEN
    IF NOT r.is_public OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin) THEN
      RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;
    v_revision := r.media_revision;
  ELSIF r.user_id = auth.uid() THEN v_revision := r.media_revision;
  ELSIF r.is_public AND r.status = 'published' THEN v_revision := r.published_media_revision;
  ELSE RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('revision', v_revision, 'items', COALESCE((
    SELECT jsonb_agg(to_jsonb(a) ORDER BY a.position) FROM public.recipe_attachments a
    WHERE a.recipe_id = p_recipe_id AND a.revision = v_revision
  ), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.get_recipe_media(integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recipe_media(integer, boolean) TO anon, authenticated;

CREATE FUNCTION public.save_recipe_media(p_recipe_id integer, p_base_revision uuid, p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.recipes; v_revision uuid := gen_random_uuid(); item jsonb; pos integer := 0; obj storage.objects;
BEGIN
  SELECT * INTO r FROM public.recipes WHERE id = p_recipe_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR r.user_id IS DISTINCT FROM auth.uid() OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF r.media_revision IS DISTINCT FROM p_base_revision THEN RAISE EXCEPTION 'media_conflict'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_media'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF item->>'kind' IN ('image', 'video') THEN
      IF split_part(item->>'storage_path', '/', 1) IS DISTINCT FROM auth.uid()::text THEN
        RAISE EXCEPTION 'invalid_media_owner';
      END IF;
      SELECT * INTO obj FROM storage.objects WHERE bucket_id = 'recipe-attachments' AND name = item->>'storage_path';
      IF NOT FOUND THEN RAISE EXCEPTION 'media_upload_missing'; END IF;
      IF (item->>'kind' = 'image' AND COALESCE(obj.metadata->>'mimetype', '') NOT IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'))
        OR (item->>'kind' = 'video' AND COALESCE(obj.metadata->>'mimetype', '') NOT IN ('video/mp4', 'video/webm', 'video/quicktime', 'video/ogg')) THEN
        RAISE EXCEPTION 'invalid_media_type';
      END IF;
    ELSE obj := NULL;
    END IF;
    INSERT INTO public.recipe_attachments(recipe_id, revision, position, section, kind, storage_path, external_url, filename, mime_type, size_bytes)
    VALUES (r.id, v_revision, pos, item->>'section', item->>'kind',
      CASE WHEN item->>'kind' <> 'link' THEN item->>'storage_path' END,
      CASE WHEN item->>'kind' = 'link' THEN item->>'external_url' END,
      COALESCE(item->>'filename', ''), obj.metadata->>'mimetype', (obj.metadata->>'size')::bigint);
    pos := pos + 1;
  END LOOP;
  UPDATE public.recipes SET media_revision = v_revision WHERE id = r.id;
  IF r.is_public AND r.status = 'published' THEN
    INSERT INTO public.recipe_pending_updates(recipe_id, user_id, changes)
    VALUES (r.id, auth.uid(), jsonb_build_object('media_revision', v_revision));
    UPDATE public.recipes SET has_pending_update = true WHERE id = r.id;
  END IF;
  RETURN v_revision;
END;
$$;
REVOKE ALL ON FUNCTION public.save_recipe_media(integer, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_recipe_media(integer, uuid, jsonb) TO authenticated;

-- Lock and approve the EXACT attachment revision the moderator has viewed.
-- Existing text/photo approval stays in the same transaction.
CREATE FUNCTION public.review_recipe_media(p_recipe_id integer, p_revision uuid, p_approve boolean, p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.recipes;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.recipes WHERE id = p_recipe_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT r.is_public THEN RAISE EXCEPTION 'not_public'; END IF;
  IF r.media_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'media_conflict'; END IF;
  IF p_approve THEN
    IF r.has_pending_update THEN PERFORM public.apply_pending_update(r.id);
    ELSE UPDATE public.recipes SET status = 'published', is_image_flagged = false WHERE id = r.id;
    END IF;
    UPDATE public.recipes SET published_media_revision = p_revision WHERE id = r.id;
  ELSIF r.has_pending_update THEN
    PERFORM public.discard_pending_update(r.id);
    UPDATE public.recipes SET media_revision = published_media_revision WHERE id = r.id;
  ELSE
    UPDATE public.recipes SET status = 'rejected', moderation_note = NULLIF(p_note, ''), is_image_flagged = false WHERE id = r.id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.review_recipe_media(integer, uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_recipe_media(integer, uuid, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
