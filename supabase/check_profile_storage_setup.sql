-- Run in Supabase SQL Editor after:
--   20260601_1200_profile_preferences.sql
--   20260601_1500_onboarding_once_flag.sql
--   20260601_1600_profiles_autocreate_and_self_rls.sql
--
-- Returns PASS/FAIL rows for the DB-backed profile/storage rollout.

WITH expected_profile_columns AS (
  SELECT *
  FROM (
    VALUES
      ('id', 'uuid', true),
      ('full_name', 'text', true),
      ('language', 'text', true),
      ('theme', 'text', true),
      ('unit_system', 'text', true),
      ('copied_day', 'jsonb', false),
      ('copied_week', 'jsonb', false),
      ('welcome_seen_on', 'date', false),
      ('welcome_intro_seen', 'boolean', true)
  ) AS t(column_name, data_type, is_not_null)
),
actual_profile_columns AS (
  SELECT
    a.attname AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
    a.attnotnull AS is_not_null
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'profiles'
    AND a.attnum > 0
    AND NOT a.attisdropped
),
profile_column_gaps AS (
  SELECT
    e.column_name,
    e.data_type AS expected_type,
    a.data_type AS actual_type,
    e.is_not_null AS expected_not_null,
    a.is_not_null AS actual_not_null
  FROM expected_profile_columns e
  LEFT JOIN actual_profile_columns a USING (column_name)
  WHERE a.column_name IS NULL
     OR a.data_type <> e.data_type
     OR a.is_not_null <> e.is_not_null
),
profile_defaults AS (
  SELECT
    a.attname AS column_name,
    pg_get_expr(d.adbin, d.adrelid) AS default_expr
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname = 'public'
    AND c.relname = 'profiles'
    AND a.attname IN ('language', 'theme', 'unit_system', 'welcome_intro_seen')
),
backfill_gaps AS (
  SELECT count(*) AS missing_profiles
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL
),
checks AS (
  SELECT
    1 AS sort_order,
    'profiles table exists' AS check_name,
    CASE WHEN to_regclass('public.profiles') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
    NULL::text AS details

  UNION ALL

  SELECT
    2,
    'user_profiles table exists',
    CASE WHEN to_regclass('public.user_profiles') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
    NULL::text

  UNION ALL

  SELECT
    3,
    'profiles required columns / types / nullability',
    CASE WHEN EXISTS (SELECT 1 FROM profile_column_gaps) THEN 'FAIL' ELSE 'PASS' END,
    COALESCE(
      (
        SELECT string_agg(
          column_name
          || ' expected '
          || expected_type
          || CASE WHEN expected_not_null THEN ' NOT NULL' ELSE ' NULLABLE' END
          || ', got '
          || COALESCE(actual_type, 'missing')
          || CASE
            WHEN actual_not_null IS NULL THEN ''
            WHEN actual_not_null THEN ' NOT NULL'
            ELSE ' NULLABLE'
          END,
          '; '
          ORDER BY column_name
        )
        FROM profile_column_gaps
      ),
      NULL::text
    )

  UNION ALL

  SELECT
    4,
    'profiles defaults present',
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM profile_defaults
        WHERE (column_name = 'language' AND default_expr NOT ILIKE '%ua%')
           OR (column_name = 'theme' AND default_expr NOT ILIKE '%light%')
           OR (column_name = 'unit_system' AND default_expr NOT ILIKE '%metric%')
           OR (column_name = 'welcome_intro_seen' AND default_expr NOT ILIKE '%false%')
      )
      OR (SELECT count(*) FROM profile_defaults) <> 4
      THEN 'FAIL'
      ELSE 'PASS'
    END,
    (
      SELECT string_agg(column_name || '=' || COALESCE(default_expr, 'NULL'), '; ' ORDER BY column_name)
      FROM profile_defaults
    )

  UNION ALL

  SELECT
    5,
    'profiles primary key on id',
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'profiles'
          AND con.contype = 'p'
          AND pg_get_constraintdef(con.oid) ILIKE '%(id)%'
      )
      THEN 'PASS'
      ELSE 'FAIL'
    END,
    NULL::text

  UNION ALL

  SELECT
    6,
    'profiles check constraints',
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM (
          VALUES
            ('profiles_language_check'),
            ('profiles_theme_check'),
            ('profiles_unit_system_check')
        ) AS expected(conname)
        LEFT JOIN pg_constraint con
          ON con.conname = expected.conname
        LEFT JOIN pg_class c
          ON c.oid = con.conrelid
        LEFT JOIN pg_namespace n
          ON n.oid = c.relnamespace
        WHERE con.oid IS NULL
           OR n.nspname <> 'public'
           OR c.relname <> 'profiles'
      )
      THEN 'FAIL'
      ELSE 'PASS'
    END,
    (
      SELECT string_agg(con.conname || ': ' || pg_get_constraintdef(con.oid), '; ' ORDER BY con.conname)
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'profiles'
        AND con.conname IN (
          'profiles_language_check',
          'profiles_theme_check',
          'profiles_unit_system_check'
        )
    )

  UNION ALL

  SELECT
    7,
    'RLS enabled on public.profiles',
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'profiles'
          AND c.relrowsecurity = true
      )
      THEN 'PASS'
      ELSE 'FAIL'
    END,
    NULL::text

  UNION ALL

  SELECT
    8,
    'users_insert_own_profile policy exists',
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'profiles'
          AND policyname = 'users_insert_own_profile'
          AND cmd = 'INSERT'
      )
      THEN 'PASS'
      ELSE 'FAIL'
    END,
    (
      SELECT string_agg(policyname || ' [' || cmd || ']', '; ' ORDER BY policyname)
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'profiles'
    )

  UNION ALL

  SELECT
    9,
    'handle_new_user() exists as SECURITY DEFINER',
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'handle_new_user'
          AND p.prosecdef = true
      )
      THEN 'PASS'
      ELSE 'FAIL'
    END,
    (
      SELECT string_agg(
        p.proname || ' security_definer=' || p.prosecdef::text,
        '; '
        ORDER BY p.proname
      )
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'handle_new_user'
    )

  UNION ALL

  SELECT
    10,
    'on_auth_user_created trigger exists and enabled',
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'auth'
          AND c.relname = 'users'
          AND t.tgname = 'on_auth_user_created'
          AND NOT t.tgisinternal
          AND t.tgenabled <> 'D'
      )
      THEN 'PASS'
      ELSE 'FAIL'
    END,
    (
      SELECT string_agg(t.tgname || ' enabled=' || t.tgenabled::text, '; ' ORDER BY t.tgname)
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'auth'
        AND c.relname = 'users'
        AND NOT t.tgisinternal
    )

  UNION ALL

  SELECT
    11,
    'profiles backfill complete for existing auth.users',
    CASE WHEN (SELECT missing_profiles FROM backfill_gaps) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'missing profiles: ' || (SELECT missing_profiles::text FROM backfill_gaps)

  UNION ALL

  SELECT
    12,
    'user_profiles expected health columns exist',
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM (
          VALUES
            ('user_id'),
            ('age'),
            ('height'),
            ('weight'),
            ('gender'),
            ('activity'),
            ('goal'),
            ('calories'),
            ('protein'),
            ('fat'),
            ('carbs'),
            ('water'),
            ('target_weight')
        ) AS expected(column_name)
        LEFT JOIN information_schema.columns c
          ON c.table_schema = 'public'
         AND c.table_name = 'user_profiles'
         AND c.column_name = expected.column_name
        WHERE c.column_name IS NULL
      )
      THEN 'FAIL'
      ELSE 'PASS'
    END,
    (
      SELECT string_agg(c.column_name, ', ' ORDER BY c.ordinal_position)
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'user_profiles'
    )
)
SELECT
  check_name,
  status,
  details
FROM checks
ORDER BY sort_order;

-- Optional detail view: existing users without a profile row.
SELECT
  u.id,
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;
