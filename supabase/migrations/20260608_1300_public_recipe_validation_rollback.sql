-- ============================================================
-- ROLLBACK: Серверна валідація публічних рецептів
-- 2026-06-08
-- ============================================================

DROP TRIGGER IF EXISTS trg_validate_public_recipe ON public.recipes;
DROP FUNCTION IF EXISTS public.validate_public_recipe();
