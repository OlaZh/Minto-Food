-- SECURITY-SAFE rollback for
-- 20260809_1000_queue_all_recipes_for_moderation_and_fix_rls.sql.
--
-- Recipe statuses are intentionally NOT restored: the previous published state
-- was explicitly declared unreviewed/untrusted, and restoring it would expose
-- content before manual moderation. This rollback only collapses the split
-- SELECT policies into an equivalent strict policy without reopening RLS-06.

BEGIN;

DROP POLICY IF EXISTS "recipes_public_select_strict" ON public.recipes;
DROP POLICY IF EXISTS "recipes_owner_select_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_admin_select_all" ON public.recipes;
DROP POLICY IF EXISTS "public_read_published_recipes" ON public.recipes;

CREATE POLICY "public_read_published_recipes"
  ON public.recipes
  FOR SELECT
  TO anon, authenticated
  USING (
    (
      is_public IS TRUE
      AND status = 'published'
      AND deleted_at IS NULL
    )
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin IS TRUE
    )
  );

GRANT SELECT ON TABLE public.recipes TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
