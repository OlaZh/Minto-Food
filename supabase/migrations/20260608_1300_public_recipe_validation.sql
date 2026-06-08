-- ============================================================
-- Серверна валідація публічних рецептів
-- 2026-06-08
--
-- Що робить:
--   Тригер на recipes (INSERT/UPDATE), що блокує публікацію
--   рецепту БЕЗ мінімальних даних. Захист від обходу JS-валідації
--   (DevTools, прямий запит до Supabase API).
--
-- Принцип (Фаза 10.7 PRIVATE vs PUBLIC):
--   • PRIVATE (is_public = false) — НЕ валідується. Будь-який контент
--     дозволено: незавершені рецепти, відсутні кроки, фото будь-чого.
--     Приватні рецепти НЕ йдуть на модерацію.
--   • PUBLIC на модерації (is_public = true AND status = 'pending') —
--     потребує: назву + (інгредієнти АБО кроки).
--
-- Перевіряється ТІЛЬКИ наявність даних. Зміст (NSFW/scam/spam)
--   контролює ручна модерація в адмінці, не цей тригер.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_public_recipe()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Валідуємо лише публічні рецепти, що йдуть у чергу модерації.
  -- Приватні (is_public = false) пропускаються без жодних перевірок.
  IF NEW.is_public = true AND NEW.status = 'pending' THEN

    IF NEW.name_ua IS NULL OR btrim(NEW.name_ua) = '' THEN
      RAISE EXCEPTION 'Публічний рецепт потребує назви'
        USING ERRCODE = 'check_violation';
    END IF;

    IF (NEW.ingredients IS NULL OR btrim(NEW.ingredients) = '')
       AND (NEW.steps IS NULL OR btrim(NEW.steps) = '') THEN
      RAISE EXCEPTION 'Публічний рецепт потребує інгредієнтів або кроків приготування'
        USING ERRCODE = 'check_violation';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_public_recipe ON public.recipes;

CREATE TRIGGER trg_validate_public_recipe
  BEFORE INSERT OR UPDATE ON public.recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_public_recipe();
