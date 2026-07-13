-- Admin-only management for the shared scanned_products catalogue.

CREATE OR REPLACE FUNCTION admin_update_scanned_product(
  p_barcode text,
  p_name_ua text,
  p_name_en text,
  p_name_pl text,
  p_brand text,
  p_kcal numeric,
  p_protein numeric,
  p_fat numeric,
  p_carbs numeric,
  p_fiber numeric,
  p_sugar numeric,
  p_salt numeric,
  p_label_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF coalesce(
    nullif(btrim(p_name_ua), ''),
    nullif(btrim(p_name_pl), ''),
    nullif(btrim(p_name_en), '')
  ) IS NULL THEN
    RAISE EXCEPTION 'at least one product name is required';
  END IF;

  UPDATE scanned_products
  SET
    name_ua = nullif(btrim(p_name_ua), ''),
    name_en = nullif(btrim(p_name_en), ''),
    name_pl = nullif(btrim(p_name_pl), ''),
    brand = nullif(btrim(p_brand), ''),
    kcal = p_kcal,
    protein = p_protein,
    fat = p_fat,
    carbs = p_carbs,
    fiber = p_fiber,
    sugar = p_sugar,
    salt = p_salt,
    label_type = p_label_type,
    updated_at = now()
  WHERE barcode = p_barcode;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'scanned product not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_scanned_product(p_barcode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM scanned_product_corrections WHERE barcode = p_barcode;
  DELETE FROM scanned_products WHERE barcode = p_barcode;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'scanned product not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION admin_update_scanned_product(
  text, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) FROM public, anon;
REVOKE ALL ON FUNCTION admin_delete_scanned_product(text) FROM public, anon;

GRANT EXECUTE ON FUNCTION admin_update_scanned_product(
  text, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_scanned_product(text) TO authenticated;
