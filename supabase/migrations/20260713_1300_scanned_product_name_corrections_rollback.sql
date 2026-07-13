REVOKE ALL ON FUNCTION submit_scanned_name_correction(text, text, text, text)
  FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION get_scanned_name_corrections(text)
  FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION approve_scanned_name_correction(uuid)
  FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION reject_scanned_name_correction(uuid)
  FROM public, anon, authenticated;

DROP FUNCTION IF EXISTS submit_scanned_name_correction(text, text, text, text);
DROP FUNCTION IF EXISTS get_scanned_name_corrections(text);
DROP FUNCTION IF EXISTS approve_scanned_name_correction(uuid);
DROP FUNCTION IF EXISTS reject_scanned_name_correction(uuid);

DROP TABLE IF EXISTS scanned_product_name_corrections;

-- Restore the deletion function from the preceding migration.
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
