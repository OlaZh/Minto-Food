-- Run in Supabase SQL Editor BEFORE:
-- migrations/20261004_1000_recipe_ingredient_translations.sql
-- PostgreSQL enforces read-only mode. No recipe content is returned.

BEGIN TRANSACTION READ ONLY;

-- 1. Overall result. READY_TO_APPLY means the new columns can be added.
-- ALREADY_PRESENT means both columns already have the expected definition.
-- Any STOP_* result needs review before running the migration.
WITH recipe_table AS (
  SELECT c.oid, c.relkind,
    COALESCE(pg_has_role(current_user, c.relowner, 'USAGE'), false) AS can_alter_table
  FROM (VALUES (to_regclass('public.recipes'))) AS target(oid)
  LEFT JOIN pg_class c ON c.oid = target.oid
), columns AS (
  SELECT column_name, udt_name, domain_name, is_nullable, is_generated, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'recipes'
), translations AS (
  SELECT
    count(*) AS present_columns,
    count(*) FILTER (
      WHERE udt_name <> 'text'
         OR domain_name IS NOT NULL
         OR is_nullable <> 'YES'
         OR is_generated <> 'NEVER'
         OR column_default IS NOT NULL
    ) AS incompatible_columns
  FROM columns
  WHERE column_name IN ('ingredients_en', 'ingredients_pl')
)
SELECT
  CASE
    WHEN r.oid IS NULL THEN 'STOP_RECIPES_TABLE_MISSING'
    WHEN r.relkind NOT IN ('r', 'p') THEN 'STOP_RECIPES_IS_NOT_A_TABLE'
    WHEN NOT r.can_alter_table THEN 'STOP_TABLE_OWNER_PERMISSION_REQUIRED'
    WHEN NOT EXISTS (
      SELECT 1 FROM columns
      WHERE column_name = 'ingredients' AND udt_name IN ('text', 'varchar')
    ) THEN 'STOP_ORIGINAL_INGREDIENTS_COLUMN_MISSING_OR_WRONG_TYPE'
    WHEN t.incompatible_columns > 0 THEN 'STOP_EXISTING_TRANSLATION_COLUMNS_DIFFER'
    WHEN t.present_columns = 2 THEN 'ALREADY_PRESENT'
    ELSE 'READY_TO_APPLY'
  END AS migration_status,
  r.can_alter_table,
  t.present_columns AS translation_columns_present,
  2 - t.present_columns AS translation_columns_to_add,
  t.incompatible_columns AS incompatible_translation_columns
FROM recipe_table r CROSS JOIN translations t;

-- 2. Definitions of the original field and both target fields.
-- Missing ingredients_en / ingredients_pl is expected before the migration.
SELECT
  expected.column_name,
  (actual.column_name IS NOT NULL) AS column_exists,
  actual.data_type,
  actual.udt_name,
  actual.is_nullable,
  actual.is_generated,
  actual.column_default
FROM (VALUES ('ingredients'), ('ingredients_en'), ('ingredients_pl')) AS expected(column_name)
LEFT JOIN information_schema.columns actual
  ON actual.table_schema = 'public'
 AND actual.table_name = 'recipes'
 AND actual.column_name = expected.column_name
ORDER BY expected.column_name;

COMMIT;
