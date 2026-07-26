-- ============================================================
-- ROLLBACK: per-user recipe ratings
-- 2026-07-26
-- ============================================================

REVOKE ALL ON FUNCTION public.get_recipe_rating_summaries(INTEGER[])
  FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.get_recipe_rating_summaries(INTEGER[]);

DROP TRIGGER IF EXISTS trg_recipe_rating_updated_at ON public.recipe_ratings;
DROP FUNCTION IF EXISTS public.set_recipe_rating_updated_at();

DROP TABLE IF EXISTS public.recipe_ratings;

