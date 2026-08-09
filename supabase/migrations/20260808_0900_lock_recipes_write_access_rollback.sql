-- SECURITY-SAFE rollback for 20260808_0900_lock_recipes_write_access.sql.
--
-- The confirmed anonymous write/TRUNCATE vulnerability is intentionally never
-- restored. This rollback restores the previous policy names and equivalent
-- owner/admin functionality while keeping secure grants and ownership checks.

BEGIN;

DROP POLICY IF EXISTS "recipes_owner_insert_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_owner_update_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_owner_delete_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_admin_insert" ON public.recipes;
DROP POLICY IF EXISTS "recipes_admin_update" ON public.recipes;
DROP POLICY IF EXISTS "recipes_admin_delete" ON public.recipes;

DROP POLICY IF EXISTS "Users can insert own recipes" ON public.recipes;
CREATE POLICY "Users can insert own recipes"
  ON public.recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own recipes" ON public.recipes;
CREATE POLICY "Users can update own recipes"
  ON public.recipes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own recipes" ON public.recipes;
CREATE POLICY "Users can delete own recipes"
  ON public.recipes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_insert_recipes" ON public.recipes;
CREATE POLICY "admins_insert_recipes"
  ON public.recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin IS TRUE
    )
  );

DROP POLICY IF EXISTS "admins_update_recipes" ON public.recipes;
CREATE POLICY "admins_update_recipes"
  ON public.recipes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admins_delete_recipes" ON public.recipes;
CREATE POLICY "admins_delete_recipes"
  ON public.recipes
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());

REVOKE ALL PRIVILEGES ON TABLE public.recipes FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.recipes FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.recipes FROM authenticated;
GRANT SELECT ON TABLE public.recipes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recipes TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
