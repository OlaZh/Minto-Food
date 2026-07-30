-- ============================================================
-- GDPR Hard Delete v3
-- 2026-07-29
--
-- hard_delete_user_data() (v2, 20260718_1200) predates two tables added
-- since: recipe_ratings (Фаза 15, 20260726_1000) and api_rate_limits
-- (Фаза 17, 20260729_1000). Both have user_id ON DELETE CASCADE, so the
-- rows disappear anyway once auth.users is deleted downstream by the cron
-- — but v2's own style is to delete these explicitly too (see e.g.
-- scanned_product_corrections, which already has CASCADE and is still
-- deleted by name). This migration keeps that consistency and keeps the
-- returned JSONB summary complete for audit trails.
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

  -- 2. Water
  DELETE FROM water WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('water', v_count);

  -- 3. Week meals
  DELETE FROM week_meals WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('week_meals', v_count);

  -- 4. Weight records
  DELETE FROM weight_records WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('weight_records', v_count);

  -- 5. User activities
  DELETE FROM user_activities WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('user_activities', v_count);

  -- 6. User streaks
  DELETE FROM user_streaks WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('user_streaks', v_count);

  -- 7. Shopping (items перед lists через FK)
  DELETE FROM shopping_items WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('shopping_items', v_count);

  DELETE FROM shopping_lists WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('shopping_lists', v_count);

  -- 8. Cookbook recipes (спочатку, бо залежать від cookbooks і recipes)
  DELETE FROM cookbook_recipes
  WHERE cookbook_id IN (SELECT id FROM cookbooks WHERE user_id = p_user_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('cookbook_recipes', v_count);

  -- 9. Cookbooks
  DELETE FROM cookbooks WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('cookbooks', v_count);

  -- 10. Staged updates юзера (FK на auth.users без CASCADE —
  --     без цього кроку видалення auth-запису блокується)
  DELETE FROM recipe_pending_updates WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipe_pending_updates', v_count);

  -- 11. Recipe ingredients — ТІЛЬКИ приватних рецептів.
  --     Публічні рецепти лишаються для спільноти разом з інгредієнтами.
  DELETE FROM recipe_ingredients_raw
  WHERE recipe_id IN (
    SELECT id FROM recipes
    WHERE user_id = p_user_id AND (is_public = false OR is_public IS NULL)
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipe_ingredients', v_count);

  -- 11b. Recipe ratings CAST BY this user (own votes on others' recipes).
  --      Has ON DELETE CASCADE, so this is belt-and-braces — kept explicit
  --      for the audit summary and consistency with the rest of this function.
  DELETE FROM recipe_ratings WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipe_ratings', v_count);

  -- 11c. This user's own /api/* rate-limit history. Has ON DELETE CASCADE,
  --      kept explicit for the same reason as 11b.
  DELETE FROM api_rate_limits WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('api_rate_limits', v_count);

  -- 12. Recipes (приватні — видаляємо; публічні — анонімізуємо)
  UPDATE recipes
  SET user_id = NULL, author = NULL
  WHERE user_id = p_user_id AND is_public = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipes_anonymized', v_count);

  DELETE FROM recipes WHERE user_id = p_user_id AND (is_public = false OR is_public IS NULL);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipes_deleted', v_count);

  -- 13. Recipe reports (зроблені цим юзером)
  DELETE FROM recipe_reports WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipe_reports', v_count);

  -- 14. Правки сканованих продуктів (мають CASCADE від auth.users,
  --     але видаляємо явно — щоб дані зникли навіть якщо крок
  --     deleteAuthUser у кроні впаде)
  DELETE FROM scanned_product_corrections WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('scanned_product_corrections', v_count);

  DELETE FROM scanned_product_name_corrections WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('scanned_product_name_corrections', v_count);

  -- 15. Nullable посилання, що інакше блокують DELETE auth.users
  UPDATE recipe_reports SET resolved_by = NULL WHERE resolved_by = p_user_id;
  UPDATE feature_flags  SET updated_by  = NULL WHERE updated_by  = p_user_id;

  -- 16. User health profile
  DELETE FROM user_profiles WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('user_profiles', v_count);

  -- 17. Завершити GDPR запит (лог лишається — compliance trail)
  UPDATE gdpr_requests
  SET status = 'completed', completed_at = now()
  WHERE user_id = p_user_id AND type = 'delete';

  -- 18. Видалити профіль (auth.users видаляється окремо через Admin API)
  DELETE FROM profiles WHERE id = p_user_id;

  RETURN v_result;
END;
$$;

-- Тільки service_role може викликати цю функцію (через Vercel Cron)
REVOKE ALL ON FUNCTION hard_delete_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hard_delete_user_data(UUID) TO service_role;
