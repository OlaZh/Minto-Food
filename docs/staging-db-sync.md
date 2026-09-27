# Staging DB sync

Скрипт `supabase/staging-sync.ps1` синхронізує `public` schema з production у staging без копіювання бойових даних.

Стан звірено 27.09.2026: скрипт є в репозиторії. Окремий staging-проєкт, готовий seed і успішний live-sync цим документом не підтверджені. За [QA-планом](qa-test-plan.md) нинішній pre-production має стати staging після створення нового чистого production; цей скрипт сам по собі не виконує весь такий перехід.

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

Нижче приклад параметра; `supabase/staging.seed.sql` у репозиторії відсутній. Потрібно підготувати власний seed-файл до запуску цієї команди.

```powershell
powershell -ExecutionPolicy Bypass -File .\supabase\staging-sync.ps1 -SeedFile .\supabase\staging.seed.sql
```

## Нотатки

- Скрипт навмисно не чіпає `auth`, `storage` та інші internal schema Supabase.
- Якщо потрібні демонстраційні дані, тримай їх окремим SQL-файлом для staging.
- Перед risky migration все одно лишається правило: спочатку staging, потім prod.
