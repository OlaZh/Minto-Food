# Staging DB sync

Скрипт `supabase/staging-sync.ps1` синхронізує `public` schema з production у staging без копіювання бойових даних.

## Що потрібно

- `pg_dump` і `psql` у `PATH`
- окремий staging Supabase project
- два connection string:
  - `SUPABASE_PROD_DB_URL`
  - `SUPABASE_STAGING_DB_URL`

## Що робить скрипт

1. Робить `schema-only` dump з prod
2. Обмежує dump лише схемами з параметра `-Schemas` (за замовчуванням `public`)
3. Імпортує цей dump у staging
4. За бажанням накочує окремий seed SQL через `-SeedFile`

`--clean --if-exists` означає, що об'єкти в цільовій схемі staging будуть перевизначені під поточну prod-структуру. Для production цей скрипт не призначений.

## Базове використання

```powershell
$env:SUPABASE_PROD_DB_URL = "postgresql://..."
$env:SUPABASE_STAGING_DB_URL = "postgresql://..."
powershell -ExecutionPolicy Bypass -File .\supabase\staging-sync.ps1
```

## Dry run

```powershell
powershell -ExecutionPolicy Bypass -File .\supabase\staging-sync.ps1 -WhatIf
```

## З анонімізованим seed

```powershell
powershell -ExecutionPolicy Bypass -File .\supabase\staging-sync.ps1 -SeedFile .\supabase\staging.seed.sql
```

## Нотатки

- Скрипт навмисно не чіпає `auth`, `storage` та інші internal schema Supabase.
- Якщо потрібні демонстраційні дані, тримай їх окремим SQL-файлом для staging.
- Перед risky migration все одно лишається правило: спочатку staging, потім prod.
