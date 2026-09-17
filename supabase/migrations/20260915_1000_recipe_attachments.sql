-- Recipe attachments: immutable file paths and separately approved snapshots.
-- Apply in Supabase SQL Editor before deploying the UI. No existing data is rewritten.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.recipe_attachments') IS NOT NULL THEN
    RAISE EXCEPTION 'Recipe attachments already exist. Do not re-run or drop data; use an upgrade migration.';
  END IF;
  IF to_regprocedure('public.hard_delete_user_data(uuid)') IS NULL
    OR to_regprocedure('public.apply_pending_update(integer)') IS NULL
    OR to_regprocedure('public.discard_pending_update(integer)') IS NULL THEN
    RAISE EXCEPTION 'Required existing GDPR/moderation functions are missing. Apply the earlier project migrations first.';
  END IF;
END;
$$;

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
      OR (r.is_public AND p_revision IN (r.media_revision, r.published_media_revision)
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))
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
    IF r.is_public IS NOT TRUE OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin) THEN
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
  IF NOT FOUND OR r.is_public IS NOT TRUE THEN RAISE EXCEPTION 'not_public'; END IF;
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

-- Returning a published/staged recipe to a private book applies the owner's
-- edits immediately and removes its old public moderation queue atomically.
CREATE FUNCTION public.save_private_recipe(p_recipe_id integer, p_user_id uuid, p_fields jsonb)
RETURNS SETOF public.recipes LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.recipes; edited public.recipes;
BEGIN
  IF COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.recipes WHERE id = p_recipe_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR r.user_id IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'not_authorized'; END IF;
  edited := jsonb_populate_record(r, p_fields);
  UPDATE public.recipes SET name_ua = edited.name_ua, kcal = edited.kcal, protein = edited.protein,
    fat = edited.fat, carbs = edited.carbs, fiber = edited.fiber, total_weight = edited.total_weight,
    category = edited.category, ingredients = edited.ingredients, steps = edited.steps, image = edited.image,
    is_public = false, status = 'draft', has_pending_update = false,
    is_image_flagged = false, image_nsfw_score = NULL, image_moderated_at = NULL
  WHERE id = r.id;
  DELETE FROM public.recipe_pending_updates WHERE recipe_id = r.id;
  RETURN QUERY SELECT * FROM public.recipes WHERE id = r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_private_recipe(integer, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_private_recipe(integer, uuid, jsonb) TO service_role;

-- Durable cleanup survives removal of profiles/auth.users. There deliberately
-- is no FK to those tables; only the worker may remove a completed job.
CREATE TABLE public.recipe_media_cleanup_jobs (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  result jsonb NOT NULL DEFAULT '{}',
  lease_token uuid,
  lease_until timestamptz
);
CREATE TABLE public.recipe_media_cleanup_files (
  user_id uuid NOT NULL REFERENCES public.recipe_media_cleanup_jobs(user_id) ON DELETE CASCADE,
  source_path text NOT NULL,
  destination_path text,
  phase text NOT NULL CHECK (phase IN ('copy', 'delete')),
  PRIMARY KEY (user_id, source_path),
  CHECK (split_part(source_path, '/', 1) = user_id::text),
  CHECK (destination_path IS NULL OR destination_path ~ '^retained/[0-9a-f-]{36}$'),
  CHECK (phase <> 'copy' OR destination_path IS NOT NULL)
);
ALTER TABLE public.recipe_media_cleanup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_media_cleanup_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recipe_media_cleanup_jobs, public.recipe_media_cleanup_files FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.recipe_media_cleanup_jobs, public.recipe_media_cleanup_files TO service_role;

-- An upload holds a profile lock until its Storage transaction commits.
-- Deletion takes the conflicting lock before inventorying files, so an upload
-- either enters that inventory or fails after the profile has been removed.
CREATE FUNCTION public.recipe_media_upload_allowed() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR KEY SHARE;
  RETURN FOUND AND NOT EXISTS (SELECT 1 FROM public.recipe_media_cleanup_jobs WHERE user_id = auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.recipe_media_upload_allowed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recipe_media_upload_allowed() TO authenticated, anon;
CREATE POLICY recipe_media_active_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id <> 'recipe-attachments' OR public.recipe_media_upload_allowed());

-- Wrap the existing deletion implementation instead of duplicating its table
-- list. Keeping the public RPC name also makes an older cron safe to retry:
-- it cannot lose the file inventory when the profile disappears.
ALTER FUNCTION public.hard_delete_user_data(uuid) RENAME TO hard_delete_user_data_without_media;
ALTER FUNCTION public.hard_delete_user_data_without_media(uuid) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.hard_delete_user_data_without_media(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.hard_delete_user_data(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  -- Serialize retries, including the interval after the profile is gone.
  PERFORM pg_advisory_xact_lock(hashtextextended('recipe-media-delete:' || p_user_id::text, 0));
  SELECT result INTO v_result FROM public.recipe_media_cleanup_jobs WHERE user_id = p_user_id;
  IF FOUND THEN RETURN v_result; END IF;
  PERFORM 1 FROM public.profiles WHERE id = p_user_id
    AND deletion_scheduled_for IS NOT NULL AND deletion_scheduled_for <= now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Grace period has not expired or user not found'; END IF;
  PERFORM 1 FROM public.recipes WHERE user_id = p_user_id ORDER BY id FOR UPDATE;
  INSERT INTO public.recipe_media_cleanup_jobs(user_id) VALUES (p_user_id);

  -- Withdrawn history is private. Keep only the active/reviewable snapshots of
  -- public recipes retained by the existing account-deletion policy.
  DELETE FROM public.recipe_attachments a USING public.recipes r
  WHERE a.recipe_id = r.id AND r.user_id = p_user_id
    AND NOT (r.is_public IS TRUE AND r.deleted_at IS NULL
      AND (a.revision IS NOT DISTINCT FROM r.media_revision OR a.revision IS NOT DISTINCT FROM r.published_media_revision));

  INSERT INTO public.recipe_media_cleanup_files(user_id, source_path, destination_path, phase)
  SELECT p_user_id, o.name,
    CASE WHEN kept.yes THEN 'retained/' || gen_random_uuid()::text END,
    CASE WHEN kept.yes THEN 'copy' ELSE 'delete' END
  FROM storage.objects o
  CROSS JOIN LATERAL (SELECT EXISTS (
    SELECT 1 FROM public.recipe_attachments a JOIN public.recipes r ON r.id = a.recipe_id
    WHERE a.storage_path = o.name AND r.is_public IS TRUE AND r.deleted_at IS NULL
  ) AS yes) kept
  WHERE o.bucket_id = 'recipe-attachments' AND split_part(o.name, '/', 1) = p_user_id::text;

  -- The queue, anonymization, private recipe deletion and grace check are one
  -- transaction. A failure in the original RPC rolls the entire operation back.
  v_result := public.hard_delete_user_data_without_media(p_user_id);
  UPDATE public.recipe_media_cleanup_jobs SET result = v_result WHERE user_id = p_user_id;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.hard_delete_user_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_user_data(uuid) TO service_role;

-- One leased worker per account; small batches bound each response. A crashed
-- worker is reclaimable after ten minutes without losing completed work.
CREATE FUNCTION public.recipe_media_cleanup_step(p_user_id uuid, p_action text,
  p_token uuid DEFAULT NULL, p_source text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE job public.recipe_media_cleanup_jobs; task public.recipe_media_cleanup_files;
  original storage.objects; copied storage.objects;
BEGIN
  SELECT * INTO job FROM public.recipe_media_cleanup_jobs WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_action = 'claim' THEN
    IF job.lease_until > now() THEN RETURN NULL; END IF;
    job.lease_token := gen_random_uuid();
    UPDATE public.recipe_media_cleanup_jobs SET last_attempt_at = now() WHERE user_id = p_user_id;
  ELSIF p_token IS NULL OR job.lease_token IS DISTINCT FROM p_token OR job.lease_until <= now() THEN
    RAISE EXCEPTION 'cleanup_lease_lost';
  END IF;
  UPDATE public.recipe_media_cleanup_jobs SET lease_token = job.lease_token,
    lease_until = now() + interval '10 minutes' WHERE user_id = p_user_id;

  IF p_action = 'copy_done' THEN
    SELECT * INTO task FROM public.recipe_media_cleanup_files
      WHERE user_id = p_user_id AND source_path = p_source FOR UPDATE;
    IF NOT FOUND OR task.phase <> 'copy' THEN RAISE EXCEPTION 'cleanup_task_changed'; END IF;
    SELECT * INTO original FROM storage.objects WHERE bucket_id = 'recipe-attachments' AND name = task.source_path;
    IF NOT FOUND THEN RAISE EXCEPTION 'cleanup_source_missing'; END IF;
    SELECT * INTO copied FROM storage.objects WHERE bucket_id = 'recipe-attachments' AND name = task.destination_path;
    IF NOT FOUND OR to_jsonb(copied)->>'owner_id' IS NOT NULL OR to_jsonb(copied)->>'owner' IS NOT NULL
      OR copied.metadata->>'size' IS DISTINCT FROM original.metadata->>'size'
      OR copied.metadata->>'mimetype' IS DISTINCT FROM original.metadata->>'mimetype' THEN
      RAISE EXCEPTION 'cleanup_copy_not_verified';
    END IF;
    UPDATE public.recipe_attachments SET storage_path = task.destination_path WHERE storage_path = task.source_path;
    UPDATE public.recipe_media_cleanup_files SET phase = 'delete' WHERE user_id = p_user_id AND source_path = p_source;
  ELSIF p_action = 'delete_done' THEN
    IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'recipe-attachments' AND name = p_source) THEN
      RAISE EXCEPTION 'cleanup_source_not_deleted';
    END IF;
    DELETE FROM public.recipe_media_cleanup_files WHERE user_id = p_user_id AND source_path = p_source AND phase = 'delete';
    IF NOT FOUND THEN RAISE EXCEPTION 'cleanup_task_changed'; END IF;
  ELSIF p_action = 'finish' THEN
    IF EXISTS (SELECT 1 FROM public.recipe_media_cleanup_files WHERE user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'recipe-attachments' AND split_part(name, '/', 1) = p_user_id::text)
      OR EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
      RAISE EXCEPTION 'cleanup_incomplete';
    END IF;
    DELETE FROM public.recipe_media_cleanup_jobs WHERE user_id = p_user_id;
    RETURN jsonb_build_object('done', true);
  ELSIF p_action = 'release' THEN
    UPDATE public.recipe_media_cleanup_jobs SET lease_token = NULL, lease_until = NULL WHERE user_id = p_user_id;
    RETURN NULL;
  ELSIF p_action NOT IN ('claim', 'next') THEN
    RAISE EXCEPTION 'invalid_cleanup_action';
  END IF;
  RETURN jsonb_build_object('token', job.lease_token, 'files', COALESCE((
    SELECT jsonb_agg(to_jsonb(f)) FROM (
      SELECT source_path, destination_path, phase FROM public.recipe_media_cleanup_files
      WHERE user_id = p_user_id ORDER BY source_path LIMIT 50
    ) f), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.recipe_media_cleanup_step(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recipe_media_cleanup_step(uuid, text, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
