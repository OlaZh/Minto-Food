-- Emergency write-access lockdown for public.recipes.
--
-- Confirmed live preflight (2026-08-08):
--   * anon had INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER grants;
--   * permissive PUBLIC policies allowed writes where user_id IS NULL;
--   * an authenticated INSERT policy checked only status='pending' and did not
--     require user_id = auth.uid().
--
-- This migration intentionally DOES NOT change recipe rows or SELECT policies.
-- It preserves authenticated owner/admin workflows while removing anonymous
-- writes, ownership spoofing and TRUNCATE/TRIGGER/REFERENCES privileges.

BEGIN;

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_unknown_policies text;
BEGIN
  -- Stop instead of deleting an unreviewed policy that appeared after the
  -- 2026-08-08 preflight. A repeated run after this migration is allowed.
  SELECT string_agg(quote_ident(policyname), ', ' ORDER BY policyname)
    INTO v_unknown_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'recipes'
    AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
    AND policyname NOT IN (
      'Users can delete own recipes',
      'admins_delete_recipes',
      'Users can insert own recipes',
      'Users submit pending recipes only',
      'admins_insert_recipes',
      'Users can update own recipes',
      'admins_update_recipes',
      'recipes_owner_insert_own',
      'recipes_owner_update_own',
      'recipes_owner_delete_own',
      'recipes_admin_insert',
      'recipes_admin_update',
      'recipes_admin_delete'
    );

  IF v_unknown_policies IS NOT NULL THEN
    RAISE EXCEPTION
      'recipes write-lockdown stopped: unreviewed client write policy/policies: %',
      v_unknown_policies;
  END IF;
END;
$$;

-- Table grants are a separate security layer from RLS. In particular, RLS
-- does not protect TRUNCATE, so remove all client table privileges first and
-- add back only the operations the application actually needs.
REVOKE ALL PRIVILEGES ON TABLE public.recipes FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.recipes FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.recipes FROM authenticated;

GRANT SELECT ON TABLE public.recipes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recipes TO authenticated;

-- Remove every reviewed permissive write policy from the live preflight.
DROP POLICY IF EXISTS "Users can delete own recipes" ON public.recipes;
DROP POLICY IF EXISTS "admins_delete_recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can insert own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users submit pending recipes only" ON public.recipes;
DROP POLICY IF EXISTS "admins_insert_recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can update own recipes" ON public.recipes;
DROP POLICY IF EXISTS "admins_update_recipes" ON public.recipes;

-- Authenticated authors may create only rows owned by their own JWT identity.
-- Status/moderation fields remain governed by the existing validation and
-- moderation triggers; this policy only establishes ownership.
DROP POLICY IF EXISTS "recipes_owner_insert_own" ON public.recipes;
CREATE POLICY "recipes_owner_insert_own"
  ON public.recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Authors cannot take ownership of another row or detach their row to NULL.
DROP POLICY IF EXISTS "recipes_owner_update_own" ON public.recipes;
CREATE POLICY "recipes_owner_update_own"
  ON public.recipes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "recipes_owner_delete_own" ON public.recipes;
CREATE POLICY "recipes_owner_delete_own"
  ON public.recipes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Preserve the existing admin workflows, but scope them explicitly to the
-- authenticated role instead of implicit PUBLIC.
DROP POLICY IF EXISTS "recipes_admin_insert" ON public.recipes;
CREATE POLICY "recipes_admin_insert"
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

DROP POLICY IF EXISTS "recipes_admin_update" ON public.recipes;
CREATE POLICY "recipes_admin_update"
  ON public.recipes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "recipes_admin_delete" ON public.recipes;
CREATE POLICY "recipes_admin_delete"
  ON public.recipes
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());

DO $$
DECLARE
  v_public_write_policies integer;
  v_safe_policy_count integer;
  v_unreviewed_client_write integer;
BEGIN
  SELECT count(*)
    INTO v_public_write_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'recipes'
    AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    AND (
      'public'::name = ANY (roles)
      OR 'anon'::name = ANY (roles)
    );

  IF v_public_write_policies <> 0 THEN
    RAISE EXCEPTION
      'recipes write-lockdown postflight failed: % PUBLIC/anon write policies remain',
      v_public_write_policies;
  END IF;

  SELECT count(*)
    INTO v_unreviewed_client_write
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'recipes'
    AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
    AND policyname NOT IN (
      'recipes_owner_insert_own',
      'recipes_owner_update_own',
      'recipes_owner_delete_own',
      'recipes_admin_insert',
      'recipes_admin_update',
      'recipes_admin_delete'
    );

  IF v_unreviewed_client_write <> 0 THEN
    RAISE EXCEPTION
      'recipes write-lockdown postflight failed: % unreviewed client write policies remain',
      v_unreviewed_client_write;
  END IF;

  IF has_table_privilege('anon', 'public.recipes', 'INSERT')
     OR has_table_privilege('anon', 'public.recipes', 'UPDATE')
     OR has_table_privilege('anon', 'public.recipes', 'DELETE')
     OR has_table_privilege('anon', 'public.recipes', 'TRUNCATE')
     OR has_table_privilege('anon', 'public.recipes', 'REFERENCES')
     OR has_table_privilege('anon', 'public.recipes', 'TRIGGER') THEN
    RAISE EXCEPTION 'recipes write-lockdown postflight failed: anon still has a write/high-risk table privilege';
  END IF;

  IF has_table_privilege('authenticated', 'public.recipes', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.recipes', 'REFERENCES')
     OR has_table_privilege('authenticated', 'public.recipes', 'TRIGGER') THEN
    RAISE EXCEPTION 'recipes write-lockdown postflight failed: authenticated still has a high-risk table privilege';
  END IF;

  SELECT count(*)
    INTO v_safe_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'recipes'
    AND policyname IN (
      'recipes_owner_insert_own',
      'recipes_owner_update_own',
      'recipes_owner_delete_own',
      'recipes_admin_insert',
      'recipes_admin_update',
      'recipes_admin_delete'
    )
    AND roles = ARRAY['authenticated']::name[];

  IF v_safe_policy_count <> 6 THEN
    RAISE EXCEPTION
      'recipes write-lockdown postflight failed: expected 6 authenticated write policies, found %',
      v_safe_policy_count;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
