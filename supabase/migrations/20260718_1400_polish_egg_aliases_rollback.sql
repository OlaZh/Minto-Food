DO $$
BEGIN
  DELETE FROM public.product_aliases
  WHERE product_id = 1914
    AND language = 'pl'
    AND is_user_added = false
    AND created_at = timestamptz '2026-07-18 14:00:00+00'
    AND alias_normalized IN ('jaja', 'jajka', 'jajko', 'jajek', 'jaj');
END;
$$;
