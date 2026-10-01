-- Run after 20260929_1100_recipe_classification.sql as an administrator.
-- Structural checks should all be true.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='recipes' AND column_name='cuisine') AS cuisine_column,
  position('cooking_method' IN pg_get_functiondef(
    'public.stage_recipe_update(integer,uuid,jsonb,jsonb,boolean,numeric)'::regprocedure)) > 0 AS rpc_saves_method,
  has_function_privilege('service_role',
    'public.stage_recipe_update(integer,uuid,jsonb,jsonb,boolean,numeric)','EXECUTE') AS service_can_save,
  NOT has_function_privilege('authenticated',
    'public.stage_recipe_update(integer,uuid,jsonb,jsonb,boolean,numeric)','EXECUTE') AS client_cannot_call_rpc;

-- Remaining ambiguous/legacy classifications require a human decision.
-- For example fit/vegan in category, conflicting meal types, or slow_cooked.
-- Include recipe context so replacements can be reviewed without guessing from codes.
SELECT id, name_ua, category, type, cooking_method, cuisine, ingredients, steps
FROM public.recipes
WHERE deleted_at IS NULL AND (
  (NULLIF(category,'') IS NOT NULL AND category NOT IN
    ('breakfast','lunch','dinner','snack','dessert','drinks','bakery','fast','no_power'))
  OR (NULLIF(type,'') IS NOT NULL AND type NOT IN
    ('porridge','soup','salad','side_dish','main_course','pasta','sauce','sandwich','casserole','pancakes','omelet','smoothie'))
  OR (NULLIF(cooking_method,'') IS NOT NULL AND cooking_method NOT IN
    ('boiling','frying','baking','steaming','grilling','stewing','soaking','fresh'))
)
ORDER BY id;
