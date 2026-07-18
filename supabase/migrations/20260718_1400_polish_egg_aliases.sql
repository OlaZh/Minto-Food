-- Common Polish recipe forms for the canonical fresh egg product (products.id = 1914).
-- Exact aliases must win over fuzzy matches such as duck or quail eggs.

DO $$
BEGIN
  -- Read-only guard: do not attach aliases if id 1914 is not the expected product.
  IF NOT EXISTS (
    SELECT 1
    FROM public.products product
    WHERE product.id = 1914
      AND product.deleted_at IS NULL
      AND product.user_id IS NULL
      AND lower(COALESCE(product.name_pl, '')) = 'świeże jaja'
  ) THEN
    RAISE EXCEPTION 'Expected product 1914 (Świeże jaja) was not found';
  END IF;

  INSERT INTO public.product_aliases (
    product_id,
    alias_name,
    alias_normalized,
    language,
    is_user_added,
    created_at
  )
  SELECT
    1914,
    alias.alias_name,
    alias.alias_normalized,
    'pl',
    false,
    timestamptz '2026-07-18 14:00:00+00'
  FROM (VALUES
    ('jaja',  'jaja'),
    ('jajka', 'jajka'),
    ('jajko', 'jajko'),
    ('jajek', 'jajek'),
    ('jaj',   'jaj')
  ) AS alias(alias_name, alias_normalized)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.product_aliases existing
    WHERE existing.product_id = 1914
      AND existing.alias_normalized = alias.alias_normalized
      AND existing.language = 'pl'
  );
END;
$$;
