# QA Test Plan — перед наступним кроком роадмапу

> **Створено:** 01.08.2026
> **Контекст:** зроблено багато роботи (Фази 0-10.9 + значна частина TIER 1), час перевірити все перед тим як йти далі. Не чіпаємо опитування 10 осіб і покупку домену — це окремий блок.
> **Автоматична база вже пройдена:** 30/30 recipe/API mock-тести (`npm run test:save-recipe`), 12/12 consent-тести, 22/22 admin security-тести, чистий ESLint (`npm run lint:api`), успішний `admin-app` production build.

---

## Тестові акаунти

Потрібно 4 окремих акаунти, не менше:

| Акаунт | Роль |
|---|---|
| **User A** | основний — наповнюємо рецептами, меню, водою, вагою |
| **User B** | перевірка рейтингів + ізоляції чужих даних від User A |
| **Admin** | модерація в `admin-app` |
| **Delete User** | окремий чистий акаунт — виключно для GDPR soft/hard delete в самому кінці |

**Чому окремо:** GDPR-видалення робить акаунт непридатним для подальших тестів, тому не можна видаляти User A/B по ходу роботи.

---

## Рекомендований порядок

### 1. Auth + ізоляція даних (User A, User B)

- [ ] Signup з age-checkbox gate (disabled без нього)
- [ ] Email confirmation
- [ ] Login / logout
- [ ] Password reset
- [ ] Google OAuth
- [ ] Негативні кейси: невірний пароль, зайнятий email, слабкий пароль

**Негативні RLS-тести (критично, User B проти даних User A):**

- [ ] User B не бачить приватний рецепт User A
- [ ] User B не може редагувати/видалити рецепт User A
- [ ] User B не бачить meals, weight records, GDPR requests, рейтинги User A
- [ ] anon (без сесії) бачить лише `published` публічні рецепти
- [ ] service-role ендпоінти (`gdpr-export`, `save-recipe`) відхиляють запит без валідного JWT

---

### 2. Основні сценарії (User A)

- [ ] Рецепт приватний — мінімум полів, будь-який контент дозволено
- [ ] Рецепт публічний — валідація (назва + інгредієнти або кроки)
- [ ] Завантаження фото рецепта
- [ ] Редагування опублікованого рецепта → staged `pending_update` flow
- [ ] Видалення рецепта
- [ ] Меню на день: додати/видалити прийом їжі, вода
- [ ] Меню на тиждень: copy/paste/clear день і тиждень
- [ ] Streak-лічильник і КБЖУ-бари синхронізуються після логування їжі
- [ ] Рейтинги: User B оцінює рецепт User A → AVG оновлюється
  - [ ] **Повторна оцінка = upsert**, кількість голосів лишається 1, AVG перераховується (`add-recipe.js:1622`) — не повинно блокуватись
  - [ ] Власний рецепт оцінити не можна

---

### 3. GDPR export (User A, після наповнення даними)

- [ ] Файл `mintofood-export-XXXXXXXX.json` завантажується без падіння сторінки
- [ ] JSON містить усі таблиці: `profile`, `health_profile` (user_profiles), `recipes`, `cookbooks`, `meals`, `water`, `week_meals`, `weight_records`, `activities`, `streaks`, `shopping_lists`, `shopping_items`, `gdpr_requests`, `scanned_product_corrections`, `recipe_pending_updates`, `recipe_reports`
- [ ] У `gdpr_requests` з'явився новий рядок `type='export'`, `status='completed'`

---

### 4. Rate limit (наприкінці recipe-тестів, User A)

- [ ] 10 спроб створення рецепта проходять
- [ ] 11-та спроба повертає 429 (`api/save-recipe.js:44`)
- [ ] Після ліміту — редагування існуючих рецептів НЕ блокується (лічить лише створення)
- [ ] Toast rate-limit показується у поточній мові інтерфейсу

---

### 5. Адмінка і модерація (Admin)

- [ ] Не-admin користувач → редірект `/unauthorized`
- [ ] Без сесії → редірект `/login`
- [ ] Approve рецепта (з чергою модерації)
- [ ] Reject рецепта
- [ ] Staged updates: apply (мержить усі поля) / discard (відкидає staged, лишає published)
- [ ] Ban / shadow ban користувача
- [ ] Bulk actions на скаргах
- [ ] Undo action (5 сек вікно)
- [ ] "Переглянути як користувач"

**Відоме обмеження — NSFW stub:**
- [ ] Без Sightengine env-ключів (`SIGHTENGINE_USER`/`SIGHTENGINE_SECRET`) stub завжди повертає `score:0` — будь-яке фото проходить як безпечне (`api/save-recipe.js:144`)
- [ ] Живий flagged-flow перевірити неможливо без підключення провайдера або тестового режиму; покрито лише мок-тестами

---

### 6. Responsive / теми / consent / реальні пристрої

- [ ] 17 публічних сторінок × світла/темна тема × desktop (1440×900) + mobile (390×844)
- [ ] iOS Safari на реальному пристрої
- [ ] Android Chrome на реальному пристрої
- [ ] Cookie-банер: Accept All / Reject All / Custom (granular toggles)
- [ ] localStorage (`minto_consent`) для гостя, `profiles.consent_*` для залогіненого — коректні значення після кожного вибору

**Відоме обмеження — PostHog:**
- [ ] Можна перевірити лише що SDK не вантажиться при Reject (мережевий запит відсутній)
- [ ] Повний тест "Accept → events приходять" потребує реального PostHog-акаунту (EU hosting) і ключа — заблоковано до створення акаунту

---

### 7. SEO / консоль / мережа / Lighthouse / edge cases

- [ ] `/recipe/{slug}` у інкогніто без логіну — рендериться, CTA "Зберегти в книгу" → login modal
- [ ] JSON-LD Recipe markup валідний (Google Rich Results Test, коли буде deployed URL)
- [ ] `sitemap.xml` — валідний XML, містить статичні + рецепти + hreflang
- [ ] `404.html` на випадковий рецепт
- [ ] `500.html` — **перевіряти статично + штучну помилку в контрольованому handler, НЕ форсувати краш live-застосунку**
- [ ] DevTools Console на кожній сторінці — 0 помилок/попереджень
- [ ] Network — 0 404 на асети/іконки/шрифти
- [ ] CSP violations на живому деплої (локально вже 0 через `scripts/csp-theme-check.mjs`)
- [ ] Lighthouse (Performance/Accessibility/SEO) на 3-4 ключових сторінках
- [ ] Offline-indicator з'являється офлайн + recovery banner після повернення мережі
- [ ] Порожній щойно зареєстрований акаунт — усі empty states коректні
- [ ] Довгі назви/emoji/кирилиця в полях — не ламають layout

---

### 8. GDPR delete (в самому кінці, окремо)

> Виключно **Delete User** — ніколи User A/B, вони потрібні живими для регресій.

- [ ] Запит на soft-delete → перевірити `deletion_requested_at`/`deletion_scheduled_for` у `profiles`
- [ ] Кнопка стає disabled, стан зберігається після reload
- [ ] Новий рядок `gdpr_requests.type='delete'`
- [ ] **Hard-delete — лише після окремого явного підтвердження**, тестувати на staging з disposable-акаунтом, не на production-даних

---

## Поза межами цього раунду

- **Монетизація** (Stripe/checkout/webhooks/paywall) — ще не реалізовано, тестувати нема чого
- **Опитування 10 осіб і покупка домену** — окремий блок, не займаємось у цьому раунді QA
- **Search Console / Bing Webmaster** — блокер: потрібен реальний домен

---

_Джерело контексту: `Roadmap_v2.md` (TIER 0 done + TIER 1 in progress), пам'ять проєкту._
