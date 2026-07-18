-- ============================================================
-- ROLLBACK: GDPR Hard Delete v2 (20260718_1200)
--
-- Повертає функцію до версії 20260519_1000 і відновлює FK
-- gdpr_requests.user_id -> auth.users.
--
-- УВАГА: відновлення FK впаде, якщо в gdpr_requests вже є рядки
-- юзерів, видалених з auth.users (compliance trail). У такому разі
-- FK не відновлювати або спершу видалити осиротілі рядки.
-- ============================================================

ALTER TABLE gdpr_requests
  ADD CONSTRAINT gdpr_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION hard_delete_user_data(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB := '{}';
  v_count  INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
      AND deletion_scheduled_for IS NOT NULL
      AND deletion_scheduled_for <= now()
  ) THEN
    RAISE EXCEPTION 'Grace period has not expired or user not found: %', p_user_id;
  END IF;

  DELETE FROM meals WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('meals', v_count);

  DELETE FROM user_streaks WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('user_streaks', v_count);

  DELETE FROM shopping_list_items WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('shopping_list_items', v_count);

  DELETE FROM cookbook_recipes
  WHERE cookbook_id IN (SELECT id FROM cookbooks WHERE user_id = p_user_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('cookbook_recipes', v_count);

  DELETE FROM cookbooks WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('cookbooks', v_count);

  DELETE FROM recipe_ingredients_raw
  WHERE recipe_id IN (SELECT id FROM recipes WHERE user_id = p_user_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipe_ingredients', v_count);

  UPDATE recipes
  SET user_id = NULL, author = NULL
  WHERE user_id = p_user_id AND is_public = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipes_anonymized', v_count);

  DELETE FROM recipes WHERE user_id = p_user_id AND (is_public = false OR is_public IS NULL);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipes_deleted', v_count);

  DELETE FROM recipe_reports WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipe_reports', v_count);

  DELETE FROM user_profiles WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('user_profiles', v_count);

  UPDATE gdpr_requests
  SET status = 'completed', completed_at = now()
  WHERE user_id = p_user_id AND type = 'delete';

  DELETE FROM profiles WHERE id = p_user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION hard_delete_user_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hard_delete_user_data(UUID) TO service_role;
