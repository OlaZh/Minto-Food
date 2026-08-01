# MintoFood — повний QA test plan перед наступним кроком roadmap

> **Версія:** 2.0
>
> **Оновлено:** 01.08.2026
>
> **Середовище:** поточні Supabase і Vercel використовуються як **pre-production**, оскільки реальних користувачів ще немає. Новий чистий production створюється перед soft launch; поточне середовище після цього стає staging.
>
> **Мета:** перевірити все, що вже позначено зробленим у Roadmap v2, і окремо зафіксувати блокери, які неможливо чесно закрити без зовнішніх акаунтів, рішень або виправлення коду.
>
> **Не входить у цей раунд:** опитування 10–15 осіб, покупка домену та реалізація ще не зроблених фаз.

---

## 1. Правила виконання

Для кожного тесту використовувати один зі статусів:

- `PASS` — очікуваний результат підтверджено, є доказ;
- `FAIL` — фактичний результат не відповідає очікуваному, створено issue;
- `BLOCKED` — тест неможливо виконати через відсутній сервіс, ключ, конфігурацію або відоме виправлення;
- `NOT RUN` — тест ще не запускався;
- `N/A` — пункт свідомо не застосовується, причина записана.

Чекбокс закривається лише разом із записом у журналі результатів. Для кожного запуску фіксувати:

- ID тесту;
- дату й тестувальника;
- URL середовища;
- Git commit/deployment ID;
- браузер, ОС і viewport;
- тестовий акаунт;
- expected vs actual;
- screenshot, console/network log, SQL або response body;
- issue ID для `FAIL`;
- виконаний cleanup.

### Журнал результатів

| Test ID | Status | Environment / commit | Actual result | Evidence / issue | Cleanup |
|---|---|---|---|---|---|
| _приклад: AUTH-01_ | _NOT RUN_ |  |  |  |  |

---

## 2. Тестові акаунти й дані

Потрібно чотири окремі акаунти:

| Акаунт | Роль |
|---|---|
| **User A** | автор рецептів; меню, вода, вага, активність, книги та список покупок |
| **User B** | перевірка RLS, рейтингів та ізоляції даних User A |
| **Admin** | окремий admin; не використовувати для RLS-тестів звичайного користувача |
| **Delete User** | лише GDPR soft/hard delete в самому кінці |

Використовувати префікс `QA-YYYYMMDD-` у назвах рецептів, книг та інших тестових записів. Паролі, access/refresh tokens, service-role key, API keys і `CRON_SECRET` не додавати в документ, Git, screenshots або issue.

### Обов'язкові передумови

- [ ] **PRE-01:** записати public URL, admin URL, Git commit і deployment ID.
- [ ] **PRE-02:** підтвердити, що в середовищі немає реальних користувачів/production-даних.
- [ ] **PRE-03:** підтвердити застосування останніх міграцій, включно з `20260724_1000`, `20260726_1000`, `20260729_1000`, `20260729_1100`.
- [ ] **PRE-04:** на живій БД підтвердити тип `recipe_pending_updates.recipe_id = integer`.
- [ ] **PRE-05:** перевірити EXECUTE grants для `check_rate_limit`, `stage_recipe_update`, `reserve_moderation_slot`, `finalize_moderation_slot`, `apply_pending_update`, `discard_pending_update`.
- [ ] **PRE-06:** записати стан інтеграцій без значень секретів: PostHog, Sentry, Sightengine, Google OAuth, email confirmation/reset, `CRON_SECRET`.
- [ ] **PRE-07:** перед destructive round зробити доступний backup/snapshot або письмово зафіксувати, що всі дані середовища disposable.

---

## 3. Автоматичні й статичні gates

### Уже підтверджено 01.08.2026

- [x] **AUTO-01:** `npm run lint:api` — API ESLint gate чистий (`no-undef`; warnings `no-unused-vars` не є повним lint усього репозиторію).
- [x] **AUTO-02:** `npm run test:save-recipe` — 30/30 mock-тестів.
- [x] **AUTO-03:** `npm run test:consent-gate` — 12/12 тестів.
- [x] **AUTO-04:** `admin-app: npm run test:security` — 22/22 тестів.
- [x] **AUTO-05:** `admin-app: npm run lint` — чисто.
- [x] **AUTO-06:** `admin-app: npm run build` — production build успішний.

### Потрібно повторити або розблокувати

- [ ] **AUTO-07:** root `npm run build` завершується локально й не створює неочікуваного diff.

  **BLOCKED:** у корені не встановлений Sass і немає root `package-lock.json`; встановлення залежностей/створення lock-файла погоджується окремо.

- [ ] **AUTO-08:** `node scripts/csp-theme-check.mjs` завершується й дає 0 CSP violations.

  Історичний PASS є в Roadmap, але повторний запуск 01.08.2026 завис до таймауту — потрібна діагностика скрипта.
- [ ] **AUTO-09:** статично 0 `div.app-bg`, 0 `div.app-shell`, немає вкладених `<main>`, усі page-файли мають канонічний `main.main`.
- [ ] **AUTO-10:** кожна активна migration має коректний rollback або документовану причину його відсутності; naming convention відповідає `YYYYMMDD_HHMM_description.sql`.
- [ ] **AUTO-11:** `docs/customer-research.md` містить target persona й актуальний interview script; `docs/migrations.md`, `docs/release-checklist.md`, staging sync script і PR template існують та не містять застарілих шляхів.
- [ ] **AUTO-12:** live schema підтверджує розділення `profiles` (auth/admin) і `user_profiles` (health); видалені legacy tables (`old_products`, `recipetest`, `cookbook_notes`, `cookbook_notebooks`, `shopping_list`, `meals_backup_before_streaks`, `product_similar`) справді відсутні.
- [ ] **AUTO-13:** `.env`, `.env.*` (крім `.env.example`) не tracked; secret sweep client bundle/source maps і доступної Git history не знаходить реальних service-role/API secrets.

---

## 4. Round A — deployment, headers і базова безпека

Відомі read-only smoke results від 01.08.2026: public home `200`; admin `/` і `/dashboard` без сесії `307 → /login`; sitemap `200`; anon GDPR export `401`; `GET /api/save-recipe` `405`; public/admin security headers присутні.

- [ ] **DEP-01:** public home повертає `200`, немає redirect loop.
- [ ] **DEP-02:** admin protected route без сесії редіректить на `/login`.
- [ ] **DEP-03:** public headers: HSTS, CSP, `nosniff`, `DENY`, Referrer-Policy.
- [ ] **DEP-04:** admin headers: HSTS, `nosniff`, `DENY`, Referrer-Policy, `X-Robots-Tag: noindex, nofollow`.
- [ ] **DEP-05:** public CSP не містить `script-src 'unsafe-inline'`; дозволені Supabase Realtime, PostHog і Sentry origins відповідають коду.
- [ ] **DEP-06:** `GET /api/gdpr-export` без Bearer → `401`.
- [ ] **DEP-07:** `POST /api/save-recipe` без Bearer/з невалідним JWT → `401`; неправильний HTTP method → `405`.
- [ ] **DEP-08:** service-role key відсутній у client JS, HTML, source maps і network responses.
- [ ] **DEP-09:** admin URL не містить access/refresh tokens після auth transfer.

### Cron fail-closed

- [x] **SEC-01:** handler повертає `500` без `CRON_SECRET` і `401` без правильного Bearer до будь-якого Supabase-запиту; regression-тест `npm run test:gdpr-cron` додано 01.08.2026.
- [ ] **DEP-10:** після виправлення/підтвердження env: cron без Bearer → `401`.
- [ ] **DEP-11:** cron із неправильним Bearer → `401`.
- [ ] **DEP-12:** cron із правильним Bearer допускається до виконання.

---

## 5. Round B — Auth, onboarding і сесія

- [ ] **AUTH-01:** signup submit disabled без age/terms checkbox; примусовий submit також відхиляється.
- [ ] **AUTH-02:** consent text веде на `terms.html` і `privacy.html`.
- [ ] **AUTH-03:** signup із валідними даними; зайнятий email не створює другий акаунт і не розкриває зайвих даних.
- [ ] **AUTH-04:** слабкий пароль обробляється згідно з реальною Supabase password policy; policy записана в evidence.
- [ ] **AUTH-05:** email confirmation веде назад на правильний Vercel URL і створює валідну сесію. `BLOCKED`, якщо confirmation provider не налаштований.
- [ ] **AUTH-06:** password reset — request, email link, новий пароль, старий пароль більше не працює. `BLOCKED`, якщо email не налаштований.
- [ ] **AUTH-07:** Google OAuth login/callback/logout; redirect URL і allowed origins коректні. `BLOCKED`, якщо provider не налаштований.
- [ ] **AUTH-08:** невірний пароль показує локалізовану помилку без завислого loading state.
- [ ] **AUTH-09:** logout очищає session UI; захищена дія знову відкриває login modal.
- [ ] **AUTH-10:** welcome screen показується новому користувачу один раз і містить три заявлені цінності.
- [ ] **AUTH-11:** nickname step зберігається; validation/error/loading feedback працює.
- [ ] **AUTH-12:** goal wizard: ціль → параметри тіла → активність; норми перераховуються й записуються в `user_profiles`.
- [ ] **AUTH-13:** skip wizard записує `goal_wizard_skipped`; повторний reload не запускає wizard безумовно.
- [ ] **AUTH-14:** sample breakfast сіється лише для порожнього meals і не дублюється після reload.
- [ ] **AUTH-15:** onboarding checklist показує фактичні milestones і зникає лише після виконання всіх.
- [ ] **AUTH-16:** activation milestone toast на тестовому порозі не дублюється в межах сесії.

---

## 6. Round C — RLS та ізоляція User A/User B/anon

Перевіряти не лише відсутність UI-кнопки, а й прямий Supabase REST/RPC/mutation під відповідним JWT.

- [ ] **RLS-01:** User B не бачить private/draft/pending recipe User A.
- [ ] **RLS-02:** User B не може update/delete recipe User A навіть прямим запитом.
- [ ] **RLS-03:** User B не бачить meals, water, week meals, weight, activities, streaks, shopping data, cookbooks і GDPR requests User A.
- [ ] **RLS-04:** User B бачить лише власні raw `recipe_ratings`; ідентичність інших voters не витікає.
- [ ] **RLS-05:** агрегований rating/count published recipe доступний User B та anon через `get_recipe_rating_summaries`.
- [ ] **RLS-06:** anon бачить лише `is_public=true`, `status='published'`, `deleted_at IS NULL` recipes.
- [ ] **RLS-07:** anon/authenticated не можуть напряму писати moderation columns або `image_moderation_log`.
- [ ] **RLS-08:** non-admin не читає admin-only tables/RPC і не виконує admin server actions.
- [ ] **RLS-09:** `soft_delete_user()` відхиляє anon і чужий UUID; власний UUID допускається лише для authenticated user.

---

## 7. Round D — меню на день і тиждень

- [ ] **DAY-01:** day pills вибирають правильну дату; дані не змішуються між днями.
- [ ] **DAY-02:** accordion meals відкривається/закривається без втрати стану.
- [ ] **DAY-03:** додати, відредагувати й видалити meal; totals оновлюються без reload.
- [ ] **DAY-04:** water add/remove; capsule/progress і persisted value синхронні.
- [ ] **DAY-05:** calorie ring, protein/fat/carbs bars і totals відповідають даним БД.
- [ ] **DAY-06:** copy/paste/clear day; confirm і empty state коректні.
- [ ] **DAY-07:** streak оновлюється після meal, profile показує current і longest streak.
- [ ] **DAY-08:** day layout — 4-column desktop і 1-column mobile без overflow.
- [ ] **WEEK-01:** matrix days × meals і колонка totals відповідають даним.
- [ ] **WEEK-02:** copy/paste/clear week; операція не зачіпає інший тиждень.
- [ ] **WEEK-03:** mobile accordion і “Весь тиждень” grid показують правильні meal indicators.

---

## 8. Round E — recipes, visibility, ratings і public flow

### Private/public CRUD і каталог

- [ ] **REC-01:** private recipe default; мінімальний/чернетковий контент дозволено.
- [ ] **REC-02:** public submit вимагає назву + ingredients або steps і стає `pending`.
- [ ] **REC-03:** server-side validation також відхиляє невалідний public payload, незалежно від client validation.
- [ ] **REC-04:** власні cards мають правильні lock/globe/status badges.
- [ ] **REC-05:** own filters Усі/Приватні/Публічні/На модерації дають правильні набори.
- [ ] **REC-06:** “Зробити публічним” для private recipe валідовує дані й переводить у `pending`.
- [ ] **REC-07:** “Твої рецепти” та “Загальна база” не змішують private content.
- [ ] **REC-08:** search показує окремі counts “Мої/Загальні”, “Показати всі” працює.
- [ ] **REC-09:** filter chips, sort і empty/error/skeleton states коректні.
- [ ] **REC-10:** “Нові рецепти” drawer показує заявлений період/сортування і не ламається без фото.
- [ ] **REC-11:** delete own recipe видаляє його з UI/DB та не зачіпає чужі recipes.

### Photo й API validation

- [ ] **IMG-01:** валідне нове фото проходить через `/api/save-recipe`, а сервер сам визначає, що фото нове.
- [ ] **IMG-02:** unchanged photo при edit не викликає provider повторно.
- [ ] **IMG-03:** invalid data URI, короткий base64, junk string, неправильний тип і oversized image відхиляються; recipe не записується частково.
- [ ] **IMG-04:** private recipe з flagged photo не може бути опублікований admin дією.
- [ ] **IMG-05:** audit row створюється/фіналізується без витоку raw secrets.
- **BLOCKED-IMG-01:** без Sightengine keys stub повертає `score:0`; реальну NSFW-класифікацію не можна вважати перевіреною. Mock branches уже покриті AUTO-02.
- [ ] **IMG-06:** окремо перевірити provider-quota path: після moderation limit фото не йде provider, recipe потрапляє в manual queue як `rate_limited`. Не називати це NSFW detection.
- [ ] **IMG-07:** boundary: score `0.79` не flagged, `0.80` flagged (`>= IMAGE_NSFW_THRESHOLD`); виконати через provider test mode або контрольований mock.
- [ ] **IMG-08:** admin override/clear flag та reject image змінюють правильне live/staged photo, пишуть audit і не залишають recipe назавжди в черзі.

### Публікація, рейтинг і staged update — виконувати саме в цьому порядку

- [ ] **FLOW-01:** User A створює public recipe → `pending`; він відсутній у anon/public listing.
- [ ] **FLOW-02:** Admin approve → `published`; recipe з'являється у public listing і `/recipe/{slug}`.
- [ ] **FLOW-03:** User B ставить rating 1–5; AVG/count оновлюються.
- [ ] **FLOW-04:** User B змінює rating; upsert не додає другий vote, count лишається 1.
- [ ] **FLOW-05:** User A не може оцінити власний recipe.
- [ ] **FLOW-06:** User A редагує published recipe (text-only) → live version не змінюється до review, `has_pending_update=true`.
- [ ] **FLOW-07:** Admin apply → усі staged text fields атомарно переходять у live, pending очищено.
- [ ] **FLOW-08:** User A робить другий staged edit із photo; admin бачить саме staged image.
- [ ] **FLOW-09:** Admin discard → live recipe/photo лишається попереднім, staged і score/time очищені.
- [ ] **FLOW-10:** published → private стає `draft` і зникає з public listing; apply staged не може зробити private recipe public.
- [ ] **FLOW-11:** паралельний staged edit під час apply/discard не губиться; перевірено lock/snapshot semantics на живій БД.

---

## 9. Round F — product guide, shopping, cookbook і profile

### Product guide

- [ ] **PROD-01:** cards, basic search і filters повертають правильні результати.
- [ ] **PROD-02:** advanced filters комбінуються і коректно очищаються.
- [ ] **PROD-03:** product details modal показує правильні nutrition/details; image fallback не дає 404.
- [ ] **PROD-04:** mobile 2-column layout, modal close/focus і long names без overflow.

### Shopping і shared list

- [ ] **SHOP-01:** quick add і manual add створюють item у правильній категорії.
- [ ] **SHOP-02:** checkbox/progress/grouping синхронізуються після reload.
- [ ] **SHOP-03:** clear має confirmation; print layout придатний до друку.
- [ ] **SHOP-04:** share створює/відкриває shared list без розкриття інших user data.
- [ ] **SHOP-05:** realtime update між двома сесіями працює; reconnect не дублює items.

### Cookbook

- [ ] **BOOK-01:** створення/редагування/видалення книги та empty state.
- [ ] **BOOK-02:** save recipe to book/login prompt; повторне збереження не створює неправильний дубль.
- [ ] **BOOK-03:** cards, recent list і book modal відповідають БД.
- [ ] **BOOK-04:** notes/stickers save, reload і error feedback.
- [ ] **BOOK-05:** mobile layout не має overflow.

### Profile і health data

- [ ] **PROFILE-01:** sidebar/tabs: Мої дані, Контроль ваги, Активність, Статистика, Налаштування.
- [ ] **PROFILE-02:** nickname/body/goal data save і reload; invalid values відхиляються.
- [ ] **PROFILE-03:** BMI/unsafe weight goal warning з'являється на заявлених порогах.
- [ ] **PROFILE-04:** weight record CRUD і charts/statistics відповідають записам.
- [ ] **PROFILE-05:** activity CRUD; steps/distance/energy totals коректні.
- [ ] **PROFILE-06:** current/longest streak у profile відповідає day menu.
- [ ] **PROFILE-07:** усі async actions мають spinner/progress/toast/error feedback.
- [ ] **PROFILE-08:** unauthenticated profile не показує всі tab sections стосом за login modal; відомий баг Roadmap перевіряється окремо.

### Scanner/corrections

- [ ] **SCAN-01:** barcode/OpenFoodFacts success, not-found і network-error paths.
- [ ] **SCAN-02:** product name correction та nutrition correction зберігаються і потрапляють у відповідну admin queue.
- [ ] **SCAN-03:** scanner/correction loading та error feedback не зависають.

---

## 10. Round G — admin-app і moderation

### Access, transfer і layout

- [ ] **ADM-01:** anon protected route → `/login`; non-admin → `/unauthorized`; admin має доступ до dashboard/reports/users.
- [ ] **ADM-02:** “Відкрити адмінку” з main site завершується на `/dashboard`; access/refresh tokens відсутні в URL, history і copied link.
- [ ] **ADM-03:** unexpected-origin transfer message і payload без tokens відхиляються.
- [ ] **ADM-04:** sidebar active state, “На сайт” і mobile navigation доступні; nav не перекриває content.
- [ ] **ADM-05:** safe forced server-action failure показує error toast, а не silent refresh.

### Dashboard, search і CRUD sections

- [ ] **ADM-06:** top stats pills відповідають даним; “Активних (7д)” рахує unique users, не meal rows.
- [ ] **ADM-07:** reports: grouping, drawer, filters, bulk actions і resolution reasons.
- [ ] **ADM-08:** moderation queue: new/public/pending/flagged/staged items, spam detection `>10/day`, inline edit, auto-flag badges і author mini-history.
- [ ] **ADM-09:** recipes search знаходить `name_ua`, `name_en`, `name_pl`; status/search state не губиться між tabs.
- [ ] **ADM-10:** products: approve, duplicate detection/merge, pagination після filtering, clear search.
- [ ] **ADM-11:** users: local/global search, pagination, admin toggle, ban/unban, shadow ban.
- [ ] **ADM-12:** authors/tags/catalog/archive/corrections/scanned-products/unmatched sections відкриваються й виконують основні CRUD/review actions.
- [ ] **ADM-13:** feature flags toggle без deploy; cache/rollout змінюється лише після заявленого TTL або refresh path.
- [ ] **ADM-14:** усі admin sections — light/dark × desktop/mobile; таблиці, drawers, sidebar і action menus не мають overflow або недоступних controls.
- [ ] **ADM-15:** прямі anon/non-admin запити до кожної admin table/RPC повертають `401/403` або 0 rows згідно з контрактом; UI redirect не вважається доказом RLS.

### Moderation semantics і regressions

- [ ] **MOD-01:** approve/reject public recipe; private recipe approve заблокований.
- [ ] **MOD-02:** delete recipe from report також закриває pending report.
- [ ] **MOD-03:** ban ставить `is_banned=true`, published recipes → draft, pending reports resolved. За поточним кодом login користувача не блокується — іншу семантику треба окремо погодити.
- [ ] **MOD-04:** unban знімає flag, але не републікує recipes автоматично.
- [ ] **MOD-05:** shadow ban: новий public submission автора залишається draft; existing content не змінюється без окремої дії.
- [ ] **MOD-06:** strike 2 → freeze window; strike 3 → ban і hide published recipes.
- [ ] **MOD-07:** Undo доступний 5 секунд і відновлює саме останню підтриману дію.
- [ ] **MOD-08:** self-demotion admin заблокована; demotion останнього admin заблокована.
- [ ] **MOD-09:** “Переглянути як користувач” відкриває правильний public content без підміни auth context.
- [ ] **MOD-10:** кожна admin mutation пише очікуваний `admin_actions` audit row без секретів.
- [ ] **MOD-11:** inappropriate-text і suspicious-link flags з'являються для public moderation/reports; private recipe не auto-flagged лише через приватний імпорт або зовнішнє посилання.

---

## 11. Round H — GDPR, consent і legal

### GDPR export — поточний контракт

- [ ] **GDPR-01:** download має ім'я `mintofood-export-XXXXXXXX.json`, `Content-Type: application/json`, `Cache-Control: no-store`.
- [ ] **GDPR-02:** export містить `exported_at`, `user_id`, `email`, `profile`, `health_profile`, `recipes`, `cookbooks`, `meals`, `water`, `week_meals`, `weight_records`, `activities`, `streaks`, `shopping_lists`, `shopping_items`, `gdpr_requests`, `scanned_product_corrections`, `scanned_product_name_corrections`, `recipe_pending_updates`, `recipe_reports`.
- [ ] **GDPR-03:** у `gdpr_requests` створено `type='export'`, `status='completed'`; failed export не повертає частковий JSON як success.

### GDPR export — блокери до повного PASS

- **BLOCKED-GDPR-01:** `recipe_ratings` і `api_rate_limits` уже user-linked та очищаються hard-delete v3, але `gdpr-export.js` їх не експортує.
- **DECISION-GDPR-01:** погодити й задокументувати export/retention для `cookbook_recipes`, recipe ingredient relations, `image_moderation_log`, archived recipes (`deleted_at != null`) і admin audit data. До цього не писати “експорт містить усі персональні дані”.
- [ ] **GDPR-04:** після погодженого виправлення повторити export і підтвердити нові секції реальними seeded rows.

### Cookie consent

- [ ] **CONSENT-01:** guest Accept/Reject/Custom; Reject має однакову видимість з Accept.
- [ ] **CONSENT-02:** `minto_consent`: `necessary=true`, правильні analytics/marketing, version і timestamp; persistence після reload та між pages; після заявлених 6 місяців потрібен новий consent.
- [ ] **CONSENT-03:** cookies page reopens settings; custom choice оновлюється; повторного banner немає до version bump/expiry.
- [ ] **CONSENT-04:** authenticated choice синхронізується в `profiles.consent_*`; logout/login не відновлює застарілий local choice поверх DB.
- [ ] **CONSENT-05:** bump `CONSENT_VERSION` викликає re-prompt.
- [ ] **CONSENT-06:** banner/settings доступні й працюють на кожній public/legal/error page, де їх підключає build; немає сторінки зі старою або подвійною копією consent script.
- **BLOCKED-CONSENT-01:** без реального PostHog key відсутність SDK при Reject не доводить gate, бо SDK не завантажиться і при Accept. Live suppression proof виконувати після підключення EU PostHog; до цього покриття — AUTO-03.

### Legal UI

- [ ] **LEGAL-01:** Privacy/Terms/Cookies мають UA/EN/PL blocks; links і headings не змішують мови.
- [ ] **LEGAL-02:** DMCA/Imprint доступні й залінковані з footer; imprint template clearly blocked до реальних operator data.
- [ ] **LEGAL-03:** medical disclaimers присутні на profile/weight/activity/statistics.
- [ ] **LEGAL-04:** privacy rights ведуть до Profile → Settings → GDPR.
- [ ] **LEGAL-05:** processors list відповідає реально активним інтеграціям; неактивні сервіси позначені коректно.

---

## 12. Round I — API rate limits і live DB concurrency

Перед тестом дочекатися чистого 60-секундного window або використати окремий fresh QA user. Ліміт рахує **спроби створення**, не лише успішні inserts.

- [ ] **RATE-01:** перші 10 creation attempts допускаються; 11-та → HTTP `429` і `error='rate_limited'`.
- [ ] **RATE-02:** invalid creation attempt також займає slot, якщо дійшов до server validation.
- [ ] **RATE-03:** edit existing recipe після create limit не блокується.
- [ ] **RATE-04:** localized toast відповідає активній UA/EN/PL мові.
- [ ] **RATE-05:** direct anon/authenticated execution `check_rate_limit` заборонене; service-role execution дозволене.
- [ ] **RATE-06:** parallel burst допускає рівно limit requests; advisory lock не дозволяє race bypass.
- [ ] **RATE-07:** rows з'являються в `api_rate_limits`; cleanup видаляє старі rows і не чіпає активне window.
- [ ] **RATE-08:** після тесту видалити QA recipes; rate rows очищаються окремо або через погоджений cleanup.
- [ ] **RATE-09:** контрольований mock RPC failure підтверджує задокументований fail-open path і server log; не вимикати live DB заради цього тесту.

---

## 13. Round J — global UI, layout, responsive, themes і accessibility

### Page matrix

Перевірити 17 page-файлів: `index`, `week-menu`, `recipes`, `recipe`, `product-guide`, `shopping-list`, `shared-list`, `cookbook`, `profile`, `privacy`, `terms`, `cookies`, `imprint`, `dmca`, `404`, `500`, `maintenance`.

- [ ] **UI-01:** кожна сторінка — light/dark × 1440×900/390×844; 0 horizontal overflow, content не перекритий.
- [ ] **UI-02:** breakpoints 1200/1024/768/480; окремо tablet portrait/landscape.
- [ ] **UI-03:** реальні: iOS Safari, Android Chrome, iPad Safari, macOS Safari.
- [ ] **UI-04:** desktop header/subheader/breadcrumbs, mobile header/tab-bar/“Ще” мають правильні active states і destinations.
- [ ] **UI-05:** footer на заявлених public/legal pages: desktop 4 columns, tablet 2×2, mobile accordion, UA/EN/PL switch.
- [ ] **UI-06:** footer притиснутий до viewport bottom на короткому content; spacing header↔content↔footer узгоджений.
- [ ] **UI-07:** skeleton/empty/error states кожного реалізованого module; empty states мають релевантний CTA.
- [ ] **UI-08:** fade-in, reduced-motion, theme anti-FOUC і зняття `no-transition`.
- [ ] **UI-09:** keyboard traversal, visible focus, modal focus/close/Escape, labels, contrast і semantic landmarks.
- [ ] **UI-10:** lazy images, image fallback, favicon/apple icons/manifest/maskable icons/theme-color.
- [ ] **UI-11:** loading spinner на auth/profile/recipe/scanner/onboarding/notes; buttons не допускають double submit.
- [ ] **UI-12:** progress bar у GDPR export завершується/скидається при success/error.
- [ ] **UI-13:** toast system не дублює повідомлення й має зрозумілий error feedback.
- [ ] **UI-14:** back-to-top, smooth scroll, offline indicator і recovery banner.
- [ ] **UI-15:** 404 global route і окремий `/recipe/nonexistent-slug` recipe-not-found state.
- [ ] **UI-16:** `500.html` перевіряти статично; safe forced error — лише у контрольованому handler, не валити live application.
- [ ] **UI-17:** maintenance page відображається коректно; rewrite instruction не ввімкнений випадково.

---

## 14. Round K — SEO, public URLs, metadata і sharing

- [ ] **SEO-01:** published `/recipe/{slug}` доступний incognito; private/pending/deleted slug не витікає.
- [ ] **SEO-02:** CTA “Зберегти в книгу” для anon відкриває login modal.
- [ ] **SEO-03:** JSON-LD Recipe має name/image/author/nutrition/ingredients/instructions/timings/yield і truthful aggregate rating.
- [ ] **SEO-04:** Google Rich Results Test пройти на поточному Vercel URL; повторити після власного домену.
- [ ] **SEO-05:** canonical і `?lang=` узгоджені; hreflang `uk/en/pl/x-default` взаємні.
- [ ] **SEO-06:** title/description/OG/Twitter metadata локалізовані; default OG image доступне абсолютним URL.
- [ ] **SEO-07:** sitemap — valid XML, static + published recipe URLs + hreflang; немає private/profile/admin/product-modal URLs.
- [ ] **SEO-08:** robots дозволяє public та забороняє admin/profile/api згідно з планом.
- [ ] **SEO-09:** Web Share API і copy-link; Telegram/Messenger/iOS Messages preview/link після доступності відповідного середовища.
- [ ] **SEO-10:** невідомий route віддає 404 page; невідомий recipe slug — коректний recipe not-found UX.

---

## 15. Round L — analytics, Sentry, console, network і performance

### PostHog — code-ready, live blocked

- [ ] **AN-01:** без key PostHog CDN не завантажується ні при Accept, ні при Reject.
- [ ] **AN-02:** після підключення EU key: Reject/withdrawal блокує SDK/product events; Accept ініціалізує один раз без duplicate `$pageview`.
- [ ] **AN-03:** identify/reset після login/logout; revoke під час pending session не робить stale identify.
- [ ] **AN-04:** події signup, recipe create/submitted, meal/water/weight, cookbook/save-to-book приходять без PII.
- **BLOCKED-AN-01:** `recipe_published` зараз не може спрацьовувати у client flow; перехід робить admin-app, де event ще не перенесено.
- **BLOCKED-AN-02:** funnels/cohorts/session recording — до PostHog account і окремого privacy-рішення.

### Sentry — code-ready, live blocked

- [ ] **ERR-01:** без DSN public/admin integrations no-op і не роблять network requests.
- [ ] **ERR-02:** після DSN штучна safe error доходить у правильний project із `user.id`, без email/PII/breadcrumbs поведінки.
- [ ] **ERR-03:** expected network/Abort/ResizeObserver errors фільтруються.
- [ ] **ERR-04:** admin source maps реально завантажені; stack trace читається.
- [ ] **ERR-05:** alert rules спрацьовують. `BLOCKED` до Sentry account/env.

### Console/network/performance

- [ ] **PERF-01:** 0 uncaught errors, CSP violations і неочікуваних failed requests на page matrix; warnings переглянуті й класифіковані, а не механічно прирівняні до FAIL.
- [ ] **PERF-02:** 0 неочікуваних 404 на scripts/styles/images/fonts/icons; очікувані 401/404 записані окремо.
- [ ] **PERF-03:** Lighthouse на index/recipes/recipe/profile у desktop/mobile; scores і Web Vitals записані.
- **DECISION-PERF-01:** pass/fail thresholds Lighthouse потребують окремого погодження; до цього тест лише вимірює baseline.
- [ ] **PERF-04:** довгі назви, emoji, кирилиця/латиниця/польські символи, very long ingredient/step не ламають layout і не створюють unsafe HTML.
- [ ] **PERF-05:** fresh empty account показує коректні empty states без console errors.

---

## 16. Round M — GDPR soft/hard delete, тільки останнім

> Використовувати виключно **Delete User**. Перед hard-delete потрібне окреме явне підтвердження користувача. Поточне середовище є pre-production і не містить реальних користувачів; слово “staging” тут означає саме disposable test environment.

### Soft delete

- [ ] **DEL-01:** confirm modal; cancel нічого не змінює.
- [ ] **DEL-02:** confirm створює `deletion_requested_at` і `deletion_scheduled_for ≈ +30 days`.
- [ ] **DEL-03:** button disabled, scheduled date visible, state зберігається після reload.
- [ ] **DEL-04:** `gdpr_requests.type='delete'` створено; інший user не може змінити цей request.

### Hard delete — після живих DEP-10…DEP-12 і явного підтвердження

- [ ] **DEL-05:** зробити due тільки Delete User; повторно перевірити його UUID перед cron.
- [ ] **DEL-06:** unauth/wrong-secret cron → `401`; correct secret запускає job.
- [ ] **DEL-07:** app data очищені: meals/water/week/weight/activity/streak/shopping/cookbooks/pending/raw ingredients/ratings/rate rows/reports/corrections/GDPR requests/profile.
- [ ] **DEL-08:** private recipes видалені; public recipes збережені лише за погодженою anonymization policy та більше не мають user identity.
- [ ] **DEL-09:** `auth.users` row видалений після успішного app cleanup.
- [ ] **DEL-10:** moderation/audit rows більше не містять deletable user identity згідно з погодженою retention policy.
- [ ] **DEL-11:** повторний cron не падає й не зачіпає User A/B/Admin.
- **BLOCKED-DEL-01:** hard-delete admin account окремо не вважати покритим, доки не погоджено retention/anonymization `admin_actions.admin_id` та інших admin audit references.

---

## 17. Cleanup після QA

- [ ] Видалити/архівувати QA recipes, books, shopping lists, reports, corrections і uploaded images.
- [ ] Зняти ban/shadow/freeze, якщо акаунти залишаються для regression.
- [ ] Повернути feature flags і moderation thresholds до початкових значень.
- [ ] Очистити browser storage/cookies тестових profiles.
- [ ] Не видаляти User A/B/Admin до завершення повторних regression tests.
- [ ] Зафіксувати залишкові QA rows, які свідомо зберігаються.

---

## 18. Поза межами цього QA-раунду / blockers

- Customer interviews, висновки, value proposition і pricing decisions.
- Домен, DNS, mailboxes, Resend templates/preferences/webhooks.
- DPA, реальні operator data в imprint і фінальне legal review.
- PostHog/Sentry/UptimeRobot accounts та dashboard configuration — code hooks перевіряються, live delivery позначається `BLOCKED`.
- Реальний image moderation provider і rescan старих фото.
- Monetization: payment provider, subscription schema, checkout, webhooks, paywall, pricing, VAT/refunds.
- Footer newsletter/social/pricing links, якщо відповідні сервіси/акаунти ще не існують.
- TIER 2 і TIER 3: social layer, retention, referral, PWA/TWA, content strategy, A/B, scale infrastructure тощо.

---

## 19. Матриця покриття Roadmap v2

| Roadmap phase | Що покриває цей документ |
|---|---|
| 0 Design foundation | AUTO-09, UI-01…UI-13; формальна governance лишається TIER 2 |
| 1 Layout | UI-01…UI-06, UI-09 |
| 2 Day menu | DAY-01…DAY-08 |
| 3 Week menu | WEEK-01…WEEK-03 |
| 4 Recipes | REC-01…REC-11, FLOW-01…FLOW-11, SEO-01…SEO-03 |
| 5 Product guide | PROD-01…PROD-04 |
| 6 Shopping list | SHOP-01…SHOP-05 |
| 7 Cookbook | BOOK-01…BOOK-05 |
| 8 Profile | PROFILE-01…PROFILE-08, GDPR/DEL rounds |
| 9 Navigation/Auth | AUTH round, ADM-01…ADM-04, UI-04 |
| 10 Polish | UI/PERF page matrix, states, focus, lazy load |
| 10.5 Admin center | ADM-01…ADM-15, MOD-01…MOD-11 |
| 10.6 Advanced moderation | MOD round, IMG round, archive/undo/reasons/history/text-link auto-flags |
| 10.7 Private/Public | REC-01…REC-07, FLOW-01…FLOW-10, RLS-01/RLS-06 |
| 10.8 Footer | UI-05/UI-06, LEGAL-02 |
| 10.9 Structural refactor | AUTO-09, UI-01/UI-06 |
| 11 Customer validation artifacts | AUTO-11; interviews/outcomes поза QA |
| 12 DB/migrations/flags/release | AUTO-10…AUTO-13, PRE-03…PRE-05, ADM-13 |
| 13 Legal/GDPR | GDPR, CONSENT, LEGAL, DEL rounds |
| 14 Email | Auth email smoke лише якщо provider працює; решта BLOCKED/out of scope |
| 15 SEO/Public URLs | SEO-01…SEO-10, rating FLOW |
| 16 Analytics/Sentry/Onboarding | AUTH-10…AUTH-16, AN/ERR sections |
| 17 Basic infrastructure | DEP, RATE, PERF; лише вже реалізовані headers/rate-limit/code checks |
| 18 Image moderation | IMG-01…IMG-08, FLOW-06…FLOW-11, MOD-01 |
| 19 Monetization | Не реалізовано — out of scope |
| 20 Footer/global UI | UI-05/UI-06; залежні newsletter/social items out of scope |
| 21 Global UI | UI-07…UI-17, AUTO-07/AUTO-08 |
| 22 Pre-launch QA | Увесь документ; real-device/admin/soft-launch хвости лишаються до виконання |

---

## Exit criteria

QA-раунд можна вважати завершеним лише коли:

1. усі in-scope tests мають `PASS` або погоджений `N/A`;
2. немає unresolved critical/high defects у Auth, RLS, GDPR, data integrity, recipe publication, admin access і cron security;
3. кожний `BLOCKED` має owner, dependency і наступну дію;
4. destructive tests виконано тільки на Delete User з доказом cleanup;
5. coverage matrix не має фази, позначеної done у Roadmap, без відповідного test/evidence;
6. release checklist пройдено на тому самому deployment, який піде в soft launch.
