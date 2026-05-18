# MintoFood — Migration Policy

> Правила безпечних змін у БД. Читати перед кожною міграцією.

---

## Де живуть міграції

- `supabase/migrations/` — всі нові міграції (починаючи з травня 2026)
- `supabase/*.sql` — старі міграції (вже застосовані, historical reference)

## Naming convention

```
YYYYMMDD_HHMM_опис.sql
YYYYMMDD_HHMM_опис_rollback.sql
```

Приклади:
```
20260601_1430_add_subscription_columns.sql
20260601_1430_add_subscription_columns_rollback.sql
```

---

## Checklist перед кожною міграцією

- [ ] Файл названо за конвенцією
- [ ] Поруч є `_rollback.sql`
- [ ] Усі операції ідемпотентні (`IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO NOTHING`)
- [ ] Нові колонки — nullable або з DEFAULT (не ламають існуючі рядки)
- [ ] Протестовано на staging перед prod
- [ ] Зроблено backup у Supabase Dashboard

---

## Типи операцій

### Безпечні (можна одразу на prod)

- `ADD COLUMN IF NOT EXISTS` з nullable або DEFAULT
- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `CREATE OR REPLACE FUNCTION`
- `DROP POLICY IF EXISTS` + `CREATE POLICY`
- `INSERT ... ON CONFLICT DO NOTHING`

### Потребують обережності (staging першим)

- `ALTER COLUMN` (зміна типу, додавання NOT NULL)
- `DROP COLUMN` — видаляє дані назавжди
- `DROP TABLE` — видаляє дані назавжди
- `UPDATE` (масовий бекфіл) — блокує рядки

### Алгоритм для NOT NULL колонки

1. Додати колонку nullable: `ADD COLUMN foo TEXT`
2. Бекфіл: `UPDATE table SET foo = 'default' WHERE foo IS NULL`
3. Перевірити: `SELECT COUNT(*) FROM table WHERE foo IS NULL` → має бути 0
4. Поставити NOT NULL: `ALTER COLUMN foo SET NOT NULL`

---

## Staging

Staging проєкт у Supabase: окремий project ID (не prod).

Перед будь-якою destructive міграцією:
1. Застосувати на staging
2. Перевірити що додаток працює
3. Тільки потім — prod

---

## Backup

Supabase Pro робить daily backups автоматично (Point-in-Time Recovery).

Ручний backup перед небезпечною міграцією:
- Dashboard → Settings → Backups → Create backup

---

## Відомі таблиці (аудит від 2026-05-18)

Запущено `20260518_1100_db_audit.sql`. RLS: всі таблиці public schema захищені ✅

### App tables (active)

| Таблиця | Рядки | Примітка |
|---------|-------|----------|
| `products` | 1551 | путівник по продуктах |
| `product_myths_new` | 3600 | факти/міфи (назва з "new" — норм, старої немає) |
| `product_benefits` | 4621 | |
| `product_aliases` | 5978 | |
| `product_substitutes` | 3565 | |
| `product_harm` | 1419 | |
| `product_combinations` | 2359 | |
| `product_effects` | 957 | |
| `product_units` | 428 | |
| `recipes` | 858 | |
| `recipe_tags` | 277 | |
| `tags` | 10 | |
| `meals` | 43 | |
| `week_meals` | 22 | |
| `water` | 39 | |
| `cookbooks` | 6 | |
| `cookbook_recipes` | 8 | |
| `shopping_lists` | 8 | активна |
| `shopping_items` | 23 | |
| `profiles` | 1 | auth / admin / RLS (is_admin, is_banned…) |
| `user_profiles` | 1 | персональні дані (profile.js, health data) |
| `nutrition_profiles` | 5 | |
| `user_streaks` | 1 | |
| `weight_records` | 1 | |
| `categories` | 96 | |
| `admin_actions` | 6 | |
| `recipe_reports` | 4 | |
| `recipe_pending_updates` | 0 | staged moderation |
| `recipe_author_profiles` | 0 | адмін pipeline |
| `scanned_products` | 27 | |
| `recipe_stickers` | 0 | майбутня фіча |
| `shopping_saved_items` | 0 | майбутня фіча |
| `feature_flags` | 5 | додано 2026-05-18 ✅ |
| `subscription` | 0 | порожня, зарезервована під Фазу 19 |

### Видалено міграцією `20260518_1200_cleanup_dead_tables.sql`

| Таблиця | Рядків було | Причина |
|---------|-------------|---------|
| `recipetest` | 5 | тестова, ніде не referenced |
| `shopping_list` | 0 | порожній дублікат shopping_lists |
| `meals_backup_before_streaks` | 12 | явний backup після streak-міграції |
| `cookbook_notes` | 1 | не referenced в JS або адмінці |
| `cookbook_notebooks` | 1 | не referenced в JS або адмінці |
| `product_similar` | 0 | порожній попередник product_substitutes |
| `old_products` | 703 | замінена новою products таблицею |

### Залишити

| Таблиця | Рядків | Вирок |
|---------|--------|-------|
| `messages_2026_05_*` | 0 | 🚫 Supabase Realtime internals, не чіпати |
