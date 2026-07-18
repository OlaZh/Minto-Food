-- ============================================================
-- GDPR Hard Delete v2
-- 2026-07-18
--
-- Виправлення багів у hard_delete_user_data() (20260519_1000):
--   1. Функція видаляла неіснуючу таблицю shopping_list_items —
--      крон падав на першому ж видаленні акаунта.
--      Реальні таблиці: shopping_items + shopping_lists.
--   2. Не покривались таблиці: water, week_meals, weight_records,
--      user_activities, scanned_product_corrections,
--      scanned_product_name_corrections, recipe_pending_updates.
--   3. recipe_ingredients_raw видалялись для ВСІХ рецептів юзера,
--      але публічні рецепти лишаються (анонімізовані) — вони
--      втрачали інгредієнти. Тепер видаляємо тільки для приватних.
--   4. FK gdpr_requests.user_id -> auth.users без CASCADE блокував
--      видалення auth-запису (крок 2 крону). FK знято: user_id
--      лишається plain UUID, лог зберігається як compliance trail
--      (GDPR ст. 5(2) accountability).
-- ============================================================

-- 4. Зняти блокуючий FK — лог GDPR-запитів переживає видалення юзера
ALTER TABLE gdpr_requests
  DROP CONSTRAINT IF EXISTS gdpr_requests_user_id_fkey;

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
