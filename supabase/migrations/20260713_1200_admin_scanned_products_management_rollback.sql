REVOKE ALL ON FUNCTION admin_update_scanned_product(
  text, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) FROM authenticated;
REVOKE ALL ON FUNCTION admin_delete_scanned_product(text) FROM authenticated;

DROP FUNCTION IF EXISTS admin_update_scanned_product(
  text, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
);
DROP FUNCTION IF EXISTS admin_delete_scanned_product(text);
