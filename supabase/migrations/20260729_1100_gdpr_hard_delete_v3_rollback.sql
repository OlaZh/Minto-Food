-- ============================================================
-- ROLLBACK: GDPR Hard Delete v3 (20260729_1100)
--
-- Повертає hard_delete_user_data() до версії v2 (20260718_1200) —
-- без явного видалення recipe_ratings/api_rate_limits (обидва все одно
-- CASCADE-ать самі за собою, це видалення лиш аудитне).
-- ============================================================

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

  DELETE FROM water WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('water', v_count);

  DELETE FROM week_meals WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('week_meals', v_count);

  DELETE FROM weight_records WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('weight_records', v_count);

  DELETE FROM user_activities WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('user_activities', v_count);

  DELETE FROM user_streaks WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('user_streaks', v_count);

  DELETE FROM shopping_items WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('shopping_items', v_count);

  DELETE FROM shopping_lists WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('shopping_lists', v_count);

  DELETE FROM cookbook_recipes
  WHERE cookbook_id IN (SELECT id FROM cookbooks WHERE user_id = p_user_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('cookbook_recipes', v_count);

  DELETE FROM cookbooks WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('cookbooks', v_count);

  DELETE FROM recipe_pending_updates WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('recipe_pending_updates', v_count);

  DELETE FROM recipe_ingredients_raw
  WHERE recipe_id IN (
    SELECT id FROM recipes
    WHERE user_id = p_user_id AND (is_public = false OR is_public IS NULL)
  );
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

  DELETE FROM scanned_product_corrections WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('scanned_product_corrections', v_count);

  DELETE FROM scanned_product_name_corrections WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('scanned_product_name_corrections', v_count);

  UPDATE recipe_reports SET resolved_by = NULL WHERE resolved_by = p_user_id;
  UPDATE feature_flags  SET updated_by  = NULL WHERE updated_by  = p_user_id;

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
