-- Revert application code first. Stops rather than overwriting later edits.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.recipes IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.recipe_classification_20260929_backup b
    JOIN public.recipes r ON r.id = b.recipe_id
    WHERE jsonb_build_object('category',r.category,'type',r.type,
      'cooking_method',r.cooking_method,'cuisine',r.cuisine) IS DISTINCT FROM b.after_values
  ) THEN RAISE EXCEPTION 'Classification changed after migration; review before rollback'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.recipes r WHERE r.cuisine IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.recipe_classification_20260929_backup b WHERE b.recipe_id=r.id)
  ) THEN RAISE EXCEPTION 'New cuisine data exists; review before rollback'; END IF;
END;
$$;
UPDATE public.recipes r SET category = b.before_values->>'category',
  type = b.before_values->>'type', cooking_method = b.before_values->>'cooking_method'
FROM public.recipe_classification_20260929_backup b WHERE r.id = b.recipe_id;
DO $$
DECLARE original text;
BEGIN
  SELECT definition INTO STRICT original FROM public.recipe_classification_20260929_function_backup;
  EXECUTE original;
END;
$$;
ALTER TABLE public.recipes DROP COLUMN cuisine;
DROP TABLE public.recipe_classification_20260929_backup;
DROP TABLE public.recipe_classification_20260929_function_backup;
NOTIFY pgrst, 'reload schema';
COMMIT;
