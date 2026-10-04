-- Text ingredient translations share the existing recipe row and access policies.
-- Apply before deploying the admin and site changes that read/write these fields.
BEGIN;

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS ingredients_en text,
  ADD COLUMN IF NOT EXISTS ingredients_pl text;

COMMENT ON COLUMN public.recipes.ingredients_en IS 'Full ingredient list in English, including headings and notes';
COMMENT ON COLUMN public.recipes.ingredients_pl IS 'Full ingredient list in Polish, including headings and notes';

NOTIFY pgrst, 'reload schema';
COMMIT;
