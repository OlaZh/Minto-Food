-- Roll back the code first. Filled translations must be backed up and cleared
-- explicitly before these columns can be removed. See migrations/README.md.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.recipes
    WHERE NULLIF(btrim(ingredients_en), '') IS NOT NULL
       OR NULLIF(btrim(ingredients_pl), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Ingredient translations exist: back them up before rollback';
  END IF;
END;
$$;

ALTER TABLE public.recipes
  DROP COLUMN ingredients_en,
  DROP COLUMN ingredients_pl;

NOTIFY pgrst, 'reload schema';
COMMIT;
