-- ============================================================
-- Per-user recipe ratings with truthful server-side aggregation
-- 2026-07-26
--
-- Existing recipes.rating values are intentionally not migrated:
-- they have no reliable voter identity. New aggregates start from
-- verified rows in recipe_ratings only.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recipe_ratings (
  recipe_id  INTEGER     NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating     SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (recipe_id, user_id)
);

COMMENT ON TABLE public.recipe_ratings IS
  'One authenticated user vote per published recipe. Aggregate values are calculated from these rows.';

CREATE INDEX IF NOT EXISTS idx_recipe_ratings_user_id
  ON public.recipe_ratings (user_id);

CREATE OR REPLACE FUNCTION public.set_recipe_rating_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_recipe_rating_updated_at() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_recipe_rating_updated_at ON public.recipe_ratings;
CREATE TRIGGER trg_recipe_rating_updated_at
  BEFORE UPDATE ON public.recipe_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_recipe_rating_updated_at();

ALTER TABLE public.recipe_ratings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.recipe_ratings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recipe_ratings TO authenticated;
GRANT ALL ON TABLE public.recipe_ratings TO service_role;

DROP POLICY IF EXISTS "recipe_ratings_select_own" ON public.recipe_ratings;
CREATE POLICY "recipe_ratings_select_own"
  ON public.recipe_ratings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "recipe_ratings_insert_own" ON public.recipe_ratings;
CREATE POLICY "recipe_ratings_insert_own"
  ON public.recipe_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.recipes r
      WHERE r.id = recipe_id
        AND r.status = 'published'
        AND r.deleted_at IS NULL
        AND (r.user_id IS NULL OR r.user_id <> auth.uid())
    )
  );

DROP POLICY IF EXISTS "recipe_ratings_update_own" ON public.recipe_ratings;
CREATE POLICY "recipe_ratings_update_own"
  ON public.recipe_ratings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.recipes r
      WHERE r.id = recipe_id
        AND r.status = 'published'
        AND r.deleted_at IS NULL
        AND (r.user_id IS NULL OR r.user_id <> auth.uid())
    )
  );

DROP POLICY IF EXISTS "recipe_ratings_delete_own" ON public.recipe_ratings;
CREATE POLICY "recipe_ratings_delete_own"
  ON public.recipe_ratings
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Only aggregated values leave the database. Individual voter ids remain
-- protected by RLS. The published-recipe join also prevents leaking rating
-- activity for drafts, private recipes, or soft-deleted recipes.
CREATE OR REPLACE FUNCTION public.get_recipe_rating_summaries(p_recipe_ids INTEGER[])
RETURNS TABLE (
  recipe_id    INTEGER,
  rating       NUMERIC,
  rating_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rr.recipe_id,
    round(avg(rr.rating)::numeric, 1) AS rating,
    count(*)::bigint                  AS rating_count
  FROM public.recipe_ratings rr
  JOIN public.recipes r ON r.id = rr.recipe_id
  WHERE rr.recipe_id = ANY(COALESCE(p_recipe_ids, ARRAY[]::INTEGER[]))
    AND r.status = 'published'
    AND r.deleted_at IS NULL
  GROUP BY rr.recipe_id;
$$;

REVOKE ALL ON FUNCTION public.get_recipe_rating_summaries(INTEGER[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recipe_rating_summaries(INTEGER[])
  TO anon, authenticated, service_role;
