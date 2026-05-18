-- ============================================================
-- GDPR Hard Delete
-- 2026-05-19
--
-- Що робить:
--   Функція hard_delete_user_data(p_user_id) видаляє або анонімізує
--   всі прикладні дані юзера. Викликається з Vercel Cron після 30-денного
--   grace period. Сам запис у auth.users видаляється окремо через Admin API.
-- ============================================================

CREATE OR REPLACE FUNCTION hard_delete_user_data(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB := '{}';
  v_count  INT;
BEGIN
  -- Перевірка: тільки якщо grace period вже минув
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
      AND deletion_scheduled_for IS NOT NULL
      AND deletion_scheduled_for <= now()
  ) THEN
    RAISE EXCEPTION 'Grace period has not expired or user not found: %', p_user_id;
  END IF;

  -- 1. Meals
  DELETE FROM meals WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('meals', v_count);

  -- 2. User streaks
  DELETE FROM user_streaks WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('user_streaks', v_count);

  -- 3. Shopping list items
  DELETE FROM shopping_list_items WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('shopping_list_items', v_count);

  -- 4. Cookbook recipes (спочатку, бо залежать від cookbooks і recipes)
  DELETE FROM cookbook_recipes
  WHERE cookbook_id IN (SELECT id FROM cookbooks WHERE user_id = p_user_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('cookbook_recipes', v_count);

  -- 5. Cookbooks
  DELETE FROM cookbooks WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('cookbooks', v_count);

  -- 6. Recipe ingredients (прив'язані до рецептів юзера)
  DELETE FROM recipe_ingredients_raw
  WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = p_user_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipe_ingredients', v_count);

  -- 7. Recipes (приватні; публічні — анонімізуємо, не видаляємо)
  --    Публічні рецепти зберігаємо для спільноти, але знімаємо прив'язку до юзера.
  UPDATE recipes
  SET user_id = NULL, author = NULL
  WHERE user_id = p_user_id AND is_public = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipes_anonymized', v_count);

  DELETE FROM recipes WHERE user_id = p_user_id AND (is_public = false OR is_public IS NULL);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipes_deleted', v_count);

  -- 8. Recipe reports (зроблені цим юзером)
  DELETE FROM recipe_reports WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipe_reports', v_count);

  -- 9. User health profile
  DELETE FROM user_profiles WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('user_profiles', v_count);

  -- 10. Завершити GDPR запит
  UPDATE gdpr_requests
  SET status = 'completed', completed_at = now()
  WHERE user_id = p_user_id AND type = 'delete';

  -- 11. Видалити профіль (auth.users видаляється окремо через Admin API)
  DELETE FROM profiles WHERE id = p_user_id;

  RETURN v_result;
END;
$$;

-- Тільки service_role може викликати цю функцію (через Vercel Cron)
REVOKE ALL ON FUNCTION hard_delete_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hard_delete_user_data(UUID) TO service_role;
