# supabase/migrations/

Усі нові міграції починаючи з травня 2026 — тут.

## Naming convention

```
YYYYMMDD_HHMM_опис.sql
YYYYMMDD_HHMM_опис_rollback.sql
```

Приклад:
```
20260518_1000_feature_flags.sql
20260518_1000_feature_flags_rollback.sql
```

## Правила

1. Кожна міграція — окремий файл. Не редагувати вже застосовані.
2. Поруч з кожним файлом — `_rollback.sql` з операцією скасування.
3. Destructive операції (`DROP`, `TRUNCATE`, `ALTER TYPE`) — спочатку staging, потім prod.
4. Нові колонки — nullable спочатку, потім бекфіл, потім NOT NULL.
5. Перед будь-якою destructive міграцією — зробити backup у Supabase Dashboard.

## Старі міграції

Файли у `supabase/*.sql` (без папки migrations) — вже застосовані у Supabase.
Залишаються як historical reference, не видаляти.
