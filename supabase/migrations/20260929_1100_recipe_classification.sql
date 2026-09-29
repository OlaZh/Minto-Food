-- Apply before deploying the combined recipe form and admin cuisine field.
-- Only exact legacy aliases are converted; unrelated recipe data is untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.recipes IN ACCESS EXCLUSIVE MODE;

-- Keep original classifications and RPC definition for a guarded rollback.
CREATE TABLE public.recipe_classification_20260929_backup (
  recipe_id integer PRIMARY KEY REFERENCES public.recipes(id) ON DELETE CASCADE,
  before_values jsonb NOT NULL,
  after_values jsonb NOT NULL
);
CREATE TABLE public.recipe_classification_20260929_function_backup (
  definition text NOT NULL
);
REVOKE ALL ON public.recipe_classification_20260929_backup,
  public.recipe_classification_20260929_function_backup FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO public.recipe_classification_20260929_function_backup
SELECT pg_get_functiondef('public.stage_recipe_update(integer,uuid,jsonb,jsonb,boolean,numeric)'::regprocedure);

ALTER TABLE public.recipes ADD COLUMN cuisine text;

-- Save all current rows before changing any classification. No names/content.
INSERT INTO public.recipe_classification_20260929_backup
SELECT id, jsonb_build_object('category', category, 'type', type,
  'cooking_method', cooking_method, 'cuisine', cuisine), '{}'::jsonb
FROM public.recipes;

-- Preserve cuisine in its own admin field. A cuisine does not imply a meal.
UPDATE public.recipes SET cuisine = category, category = NULL
WHERE category IN ('european','ukrainian','asian','mediterranean','american','middle_eastern');

-- A legacy meal stored as a type can move only without overwriting a different category.
UPDATE public.recipes SET
  category = CASE type WHEN 'drink' THEN 'drinks' WHEN 'baking' THEN 'bakery' ELSE type END,
  type = NULL
WHERE type IN ('breakfast','lunch','dinner','snack','dessert','drink','baking')
  AND (category IS NULL OR category = '' OR category = CASE type WHEN 'drink' THEN 'drinks' WHEN 'baking' THEN 'bakery' ELSE type END);

-- Roll back the temporary salad category without inventing lunch/dinner.
-- Conflicting existing dish types remain available for explicit manual review.
UPDATE public.recipes SET type = 'salad', category = NULL
WHERE category = 'salad' AND (type IS NULL OR type IN ('', 'salad'));

UPDATE public.recipes SET cooking_method = CASE cooking_method
  WHEN 'boiled' THEN 'boiling' WHEN 'fried' THEN 'frying' WHEN 'baked' THEN 'baking'
  WHEN 'steamed' THEN 'steaming' WHEN 'grilled' THEN 'grilling'
  WHEN 'stewed' THEN 'stewing' WHEN 'raw' THEN 'fresh' END
WHERE cooking_method IN ('boiled','fried','baked','steamed','grilled','stewed','raw');

UPDATE public.recipe_classification_20260929_backup b SET after_values =
  jsonb_build_object('category', r.category, 'type', r.type,
    'cooking_method', r.cooking_method, 'cuisine', r.cuisine)
FROM public.recipes r WHERE r.id = b.recipe_id;
DELETE FROM public.recipe_classification_20260929_backup WHERE before_values = after_values;

CREATE OR REPLACE FUNCTION public.stage_recipe_update(
  p_recipe_id integer,
  p_user_id   uuid,
  p_direct    jsonb,
  p_pending   jsonb,
  p_image_flagged boolean DEFAULT false,
  p_image_score   numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT user_id INTO v_owner FROM recipes WHERE id = p_recipe_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'recipe not found'; END IF;
  IF v_owner <> p_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Direct columns (non-moderated) written to the live recipe now.
  IF p_direct IS NOT NULL AND p_direct <> '{}'::jsonb THEN
    UPDATE recipes SET
      name_ua      = COALESCE((p_direct->>'name_ua'), name_ua),
      kcal         = COALESCE((p_direct->>'kcal')::numeric, kcal),
      protein      = COALESCE((p_direct->>'protein')::numeric, protein),
      fat          = COALESCE((p_direct->>'fat')::numeric, fat),
      carbs        = COALESCE((p_direct->>'carbs')::numeric, carbs),
      fiber        = COALESCE((p_direct->>'fiber')::numeric, fiber),
      total_weight = COALESCE((p_direct->>'total_weight')::numeric, total_weight),
      category     = COALESCE((p_direct->>'category'), category),
      type         = CASE WHEN p_direct ? 'type' THEN NULLIF(p_direct->>'type', '') ELSE type END,
      cooking_method = CASE WHEN p_direct ? 'cooking_method' THEN NULLIF(p_direct->>'cooking_method', '') ELSE cooking_method END,
      ingredients  = COALESCE((p_direct->>'ingredients'), ingredients),
      steps        = COALESCE((p_direct->>'steps'), steps),
      is_public    = COALESCE((p_direct->>'is_public')::boolean, is_public),
      status       = COALESCE((p_direct->>'status'), status)
    WHERE id = p_recipe_id;
  END IF;

  -- Stage moderated changes for review.
  IF p_pending IS NOT NULL AND p_pending <> '{}'::jsonb THEN
    INSERT INTO recipe_pending_updates (recipe_id, user_id, changes)
    VALUES (p_recipe_id, p_user_id, p_pending);

    UPDATE recipes
    SET has_pending_update = true,
        -- A staged NSFW photo flags the live recipe so it enters the queue,
        -- but the live recipe.image is NOT replaced (admin reviews the staged
        -- copy in recipe_pending_updates.changes.image).
        is_image_flagged   = CASE WHEN p_image_flagged THEN true ELSE is_image_flagged END,
        image_nsfw_score   = CASE WHEN p_pending ? 'image' THEN p_image_score ELSE image_nsfw_score END,
        image_moderated_at = CASE WHEN p_pending ? 'image' THEN now() ELSE image_moderated_at END
    WHERE id = p_recipe_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.stage_recipe_update(integer,uuid,jsonb,jsonb,boolean,numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage_recipe_update(integer,uuid,jsonb,jsonb,boolean,numeric) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
