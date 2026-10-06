# 🌿 MintoFood — Roadmap v2 (після аудиту)

> **Звірено з кодом і наявними QA-звітами:** 27.09.2026. Реалізована основа; pre-launch QA відкритий.
> **Палітра:** Соковита м'ята (`#a6d6b8` / `#b8e0c5` / `#4ab584` / `#82bf99` / `#0f2818`)
> **Принцип:** No MVP thinking, але правильне sequencing. Робимо фундаментально, але в правильному порядку — щоб не потонути в інфраструктурі до того, як продукт зустріне юзерів.
> **НЕ чіпаємо:** шрифти (Fraunces/Rubik/Mulish), лого, існуючі кольори світлої та темної тем.

---

## 🧭 Структура roadmap

Документ розбито на 4 TIER-и (0–3) за пріоритетністю:

- **TIER 0 — Реалізована основа** (Фази 0–10.9): редизайн, адмінка, футер і структурний рефакторинг; непідтверджений QA позначений окремо
- **TIER 1 — MUST до публічного launch**: без цього не запускаємось
- **TIER 2 — Перші 3 місяці після launch**: growth, retention, мобайл
- **TIER 3 — Scale stage**: коли є revenue + traction

> Цей порядок не означає "TIER 2 = не важливо". Він означає: спершу довести продукт до юзерів, побачити що працює, а потім полірувати. Інакше ризик 6+ місяців без feedback loop.

### Як читати статуси

- `[x]` у переліку реалізації означає наявний код або документ. Це не автоматичне підтвердження deploy чи повного QA.
- `[x]` у QA означає перевірений результат у вказаному середовищі й на вказану дату; джерело — [QA-план і журнал](qa-test-plan.md).
- `[ ]` лишається для невиконаного, часткового, заблокованого або непідтвердженого пункту. Рішення «не робимо» позначається `N/A` з причиною.
- Звірка 27.09.2026 є перевіркою документації та коду, а не новим браузерним тестом чи перевіркою дашбордів. Історичний PASS не засвідчує поточний deployment.
- Запис пропозиції в roadmap не є доказом її погодження власницею. Відкриті варіанти реалізації, тарифи, строки, ринкові прогнози та правила зовнішніх платформ лишаються плановими припущеннями до відповідного рішення/перевірки; ця звірка їх не затверджує.

### Підтверджений стан і відкритий залишок

| Напрям | Що підтверджено | Що залишається |
|---|---|---|
| Дизайн-система | Токени й компоненти в SCSS, див. Фазу 0 | Наскрізне дотримання правил і governance — Фаза 29 |
| Гостьовий UI | [QA 08.09](qa/phase22-2026-09-08/report.md): 204 початкові стани, lint/build і тести; [артефакти 22.09](qa-test-plan.md#qa22-local-20260922): локальні фікси QA22-01/03, матриця 68/68 | Auth/device/workflow QA, повний UI-09; QA22-02 |
| Авторизація | Частина сценаріїв пройдена; фікси мають окремі результати | AUTH-01/04/05/06/07/10/11/16 та повторення на релізному deployment — [QA-план](qa-test-plan.md) |
| Адмінка й RLS | Гостьовий redirect перевірено 08.09; RLS-01…10 мають серпневі результати | Адмін-сесія, non-admin UI, повні ADM/MOD workflow; admin CSP |
| GDPR | Export/delete/cron реалізовані, захист cron перевірено | Неповний export (`BLOCKED-GDPR-01`, `DECISION-GDPR-01`), ручні GDPR/DEL сценарії |
| Збережені рецепти | Код і локальні SQL/API-перевірки описані в [release-документі](saved-recipes-release.md) | Застосування нової міграції, deploy і live QA не підтверджені |
| Середовища | Є staging-sync скрипт; поточне середовище визначене як pre-production | Новий чистий prod, перетворення поточного на staging, env/seed — Фаза 17 |
| Дослідження й оплата | Persona та скрипт інтерв'ю готові | Результатів інтерв'ю немає в журналі; рішення про провайдера не зафіксоване — Фази 11/19 |

---

## 🧭 Форм-система проєкту

Правило premium-додатків (Apple Health, Noom, Lifesum): максимум **2 форми + 1 драматичний акцент**.

- **Rounded rectangles** (r=12–20px) — картки, кнопки, поля, контейнери
- **Одне кільце на сторінку** — тільки для головного показника (наприклад, калорії на "Меню на день")

---

# ✅ TIER 0 — Реалізована основа

> Нижче зафіксовано реалізацію редизайну та адмінки. Відкриті перевірки не закриті загальним статусом розділу; див. Фазу 22 та QA-план.

---

## 🎨 ФАЗА 0: Дизайн-система (фундамент)

**Форм-система:**

- [x] Визначити стандарти rounded rectangles — `--radius-md/lg/xl` = 12/16/20 у [токенах](../scss/utils/_design-system.scss); там також визначені xs/sm/2xl/pill для інших елементів
- [x] Правило "одне кільце на сторінку" записане в секції «Форм-система проєкту»; наскрізна перевірка застосування — Фаза 29

**SCSS компоненти (mixins/placeholders):**

- [x] `%premium-card` — стандарт картки з hover (фактична назва; у старому плані помилково `%card-premium`)
- [x] `%button-primary` — основна кнопка
- [x] `%button-secondary` — вторинна кнопка
- [x] `%button-ghost` — прозора / утилітарна кнопка
- [x] `%chip-filter` (категорії "Рецепти", "Путівник")
- [x] `%chip-day` — дні тижня
- [x] `%pill-badge` — streak, статуси
- [x] `%progress-bar` — горизонтальний бар для макро
- [x] `%ring-hero` — велике кільце калорій
- [x] `%water-capsule` — вертикальна капсула води

> Усі перелічені placeholders оголошені в [`scss/utils/_design-system.scss`](../scss/utils/_design-system.scss), звірено 27.09.2026. Це підтвердження реалізації; єдине використання токенів усюди ще не підтверджене.

**Spacing system:**

- [x] Зафіксувати шкалу: 4, 8, 12, 16, 20, 24, 32, 40, 56 px — `--space-xxs`…`--space-4xl` у `_design-system.scss`
- [ ] Усі компоненти використовують тільки ці значення — наскрізний аудит у Фазі 29; наявність токенів не закриває цей пункт

**Shadow/elevation system:**

- [x] Level 1 — картки: `--shadow-1`
- [x] Level 2 — hover state: `--shadow-2`
- [x] Level 3 — модалки, dropdowns: `--shadow-3`; усі три рівні мають dark overrides у `_design-system.scss`

> **Статус:** токени й компоненти реалізовані. Формалізація та перевірка застосування правил лишаються в TIER 2 → **Фаза 29, Design governance**. QA-покриття основи: AUTO-09 та UI-01…UI-13 у [QA-плані](qa-test-plan.md).

---

## 🏗 ФАЗА 1: Layout-система (каркас)

- [x] ✅ Стандартний десктопний хедер
- [x] ✅ Стандартний підхедер: заголовок сторінки / breadcrumbs
- [x] ✅ Мобільний хедер (компактний)
- [x] ✅ Мобільний таб-бар: 5 іконок + "Ще"
- [x] ✅ "Ще" — bottom sheet або окрема сторінка
- [x] ✅ Базовий 4-колонковий грід для dashboard
- [x] ✅ Responsive breakpoints: 1200 / 1024 / 768 / 480 px

---

## 🏠 ФАЗА 2: "Меню на день" — ✅ реалізовано; QA — Фаза 22

- [x] ✅ Таблиця `user_streaks`, `get_current_streak()`, автотригер на `meals`, бекфіл
- [x] ✅ Дні тижня pills, кільце калорій + streak, аккордеони meals, вода, макро-бари
- [x] ✅ Мобільна версія (1 колонка)
- [x] ✅ JS: streak-логіка, аккордеони, копіювати/вставити/очистити день
- [x] ✅ Тест світлої + темної теми

---

## 📅 ФАЗА 3: "Меню на тиждень" — ✅ реалізовано; QA — Фаза 22

- [x] ✅ Матриця "дні × прийоми", pills днів тижня, "Разом" колонка
- [x] ✅ Копіювати/вставити тиждень
- [x] ✅ Мобільна версія (аккордеони, сітка "Весь тиждень" з крапками)
- [x] ✅ Тест світлої + темної теми

---

## 🍳 ФАЗА 4: "Рецепти" — ✅ реалізовано; QA — Фаза 22

- [x] ✅ Картки, пошук + чіпи-фільтри, рейтинги, empty state
- [x] ✅ Мобільна версія (2 колонки)
- [x] ✅ Хедер: `[🔥 Нові рецепти]` — `Рецепти` — `[+ Додати рецепт]`
- [x] ✅ Drawer "Нові рецепти" (за 24 год, без фото, сортування за свіжістю + рейтингом)
- [x] ✅ Browsing: "Твої рецепти" + "Загальна база"
- [x] ✅ Пошук: "Мої (N)" + "Загальні (N)" з "Показати всі"
- [x] ✅ Тест світлої + темної теми

---

## 🥦 ФАЗА 5: "Путівник по продуктах" — ✅ реалізовано; QA — Фаза 22

- [x] ✅ Картки продуктів, пошук + фільтри, розширені фільтри, модалка деталей
- [x] ✅ Мобільна версія (2 колонки)
- [x] ✅ Тест світлої + темної теми

---

## 🛒 ФАЗА 6: "Список покупок" — ✅ реалізовано; QA — Фаза 22

- [x] ✅ Групування по категоріях, чекбокси, прогрес, дії (поділитися/очистити/друк)
- [x] ✅ Швидке додавання продукту
- [x] ✅ Мобільна версія
- [x] ✅ Тест світлої + темної теми

---

## 📚 ФАЗА 7: "Книга рецептів" — ✅ реалізовано; QA — Фаза 22

- [x] ✅ Картки книг, "Нещодавно переглянуті", модалка книги, нотатки/стікери
- [x] ✅ Мобільна версія
- [x] ✅ Тест світлої + темної теми

### Збережені рецепти зі скріншотів, відео й посилань (24–25.09.2026)

- [x] Реалізовано погоджений [сценарій](saved-recipe-plan.md): окрема коротка форма, приватні джерела, вибір книг, перетворення того самого запису на ручний рецепт
- [x] Підготовлено SQL/API/Storage-код і регресійні скрипти; [обсяг локальних перевірок та інструкція запуску](saved-recipes-release.md)
- [x] Відкат попередньої системи `recipe_attachments` у БД підтверджений наданим користувачкою результатом 17/17 — [історія відкату](recipe-rollback.md); повторно старий SQL не запускати
- [ ] Застосування `20260924_1200_saved_recipes.sql`, postflight, deployment сумісного клієнта/API та live QA — підтвердження в репозиторії відсутнє

> Наявний код не закриває BOOK-06/07 чи нові live-перевірки приватності та очищення джерел. Попередні результати QA стосуються версій до цієї функції.

---

## 👤 ФАЗА 8: Профіль + підсторінки — ✅ реалізовано; QA — Фаза 22

- [x] ✅ Layout + Sidebar (на мобільному — горизонтальний таб-бар)
- [x] ✅ Мої дані / Контроль ваги / Активність / Статистика / Налаштування
- [x] ✅ Streak в профілі (current + longest_streak)
- [x] ✅ Мобільна версія всіх підсторінок
- [x] ✅ Тест світлої + темної теми

---

## 🧭 ФАЗА 9: Навігація та авторизація — ✅ реалізовано; є відкриті AUTH-дефекти

- [x] ✅ Хедер з аватаркою / login
- [x] ✅ Модалка логіну/реєстрації
- [x] ✅ Мобільний таб-бар + "Ще"

---

## ✅ ФАЗА 10: Фінальний поліш — майже готова

- [x] ✅ Повний огляд усіх сторінок у світлій темі (18.07.2026, автоматизований прохід + вибірковий візуальний огляд — див. Фазу 22)
- [x] ✅ Повний огляд усіх сторінок у темній темі (18.07.2026, там само)
- [x] ✅ Skeleton-loaders (рецепти, путівник, книга)
- [x] ✅ Базові empty states реалізовані; повний аудит станів і релевантних CTA лишається UI-07 / Фаза 16
- [x] ✅ Error states (рецепти, путівник)
- [x] ✅ Анімації переходів (fade-in)
- [x] ✅ Глобальний `:focus-visible` реалізовано; QA22-01 (початковий фокус/Esc) локально закритий за [артефактами 22.09](qa-test-plan.md#qa22-local-20260922), повний accessibility audit UI-09 відкритий
- [x] ✅ Lazy-load реалізовано; повний performance audit відкритий у PERF-сценаріях QA-плану
- [ ] Мобільний QA на реальних пристроях (iOS Safari, Android Chrome) — **перенесено в TIER 1 → "Pre-launch QA"**

---

## 🛡 ФАЗА 10.5: Адмінка — Центр модерації — ✅ реалізовано; runtime QA відкритий

> Next.js `admin-app/`, Server Actions + Supabase SSR, доступ через `profiles.is_admin = true`.

**Зроблено:**

- [x] ✅ Інфраструктура БД (`is_admin`, `is_banned`, `recipe_reports` колонки, `admin_actions` таблиця)
- [x] ✅ RLS-політики (reports, recipes, products, profiles)
- [x] ✅ Routing & Auth (middleware, login, OAuth callback, transfer, unauthorized)
- [x] ✅ Layout: sidebar + mobile block
- [x] ✅ Секція "Скарги" (з bulk actions, drawer, групування, фільтри)
- [x] ✅ Секція "Нові рецепти" (черга pending/flagged/staged, редагування, прапорці тексту/посилань/фото й історія автора). Денний поріг кількості рецептів у поточному коді відсутній — `admin-app/src/lib/autoFlag.ts`, `app/(admin)/moderation/`
- [x] ✅ Секція "Юзерські продукти" (pg_trgm дублі, merge, схвалити)
- [x] ✅ Секція "Користувачі" (пошук, бан/розбан, toggle admin)
- [x] ✅ Top stats bar (4 pills з кешем 5 хв)
- [x] ✅ Next.js структура: dashboard / reports / moderation / recipes / products / users / authors / tags / archive
- [x] ✅ Безпека: RLS, confirmation, логування в `admin_actions`

**UX-поліш навігації та пошуку (червень 2026) — ✅:**

- [x] ✅ Активний стан поточного розділу + окремий перехід "На сайт" (`layout.tsx`, `AdminSidebarNav.tsx`)
- [x] ✅ Пошук позначено як локальний для сторінки + "Очистити" + менш оманливі лічильники (`UsersClient.tsx`, `ProductsClient.tsx`)
- [x] ✅ Фільтри й пошук не губляться: таби зберігають запит, пошук зберігає статус, "Очистити" скидає лише текст (`recipes/page.tsx` → `buildRecipesHref`)

**Відкритий хвіст (закрити в TIER 1):**

- [x] ✅ Тест penetration по коду (18.07.2026): proxy.ts редіректить без сесії → /login, не-admin → /unauthorized; всі admin-таблиці під RLS `is_admin`, RPC мають внутрішню перевірку; додано `assertAdmin()` у server actions catalog/recipes/authors (defense-in-depth); 22 security-тести проходять. Лишився runtime-тест на deployed URL
- [x] ✅ Гостьовий доступ до `/dashboard` і `/moderation` → `307 /login` (DEP-02, повтор 08.09.2026); прямі anon write/admin-RPC перевірки RLS-10 — PASS 10.08.2026. Код відповіді залежить від маршруту/прав, універсальний `403` не є контрактом
- [ ] Повний runtime-контроль доступу на релізному deployment: admin/non-admin UI та всі admin tables/RPC — ADM-01/15
- [ ] QA-тести (workflow, каскади, бан, bulk, empty)
- [ ] Тест світлої + темної теми

---

## 🛡 ФАЗА 10.6: Адмінка — Розширені інструменти модерації — ✅ реалізовано; MOD QA відкритий

- [x] ✅ Shadow ban (`is_shadow_banned`, нові рецепти → draft)
- [x] ✅ Архів порушень (soft delete: `deleted_at`, `app/(admin)/archive/`)
- [x] ✅ "Переглянути як користувач" (іконка в ReportsClient/ModerationClient)
- [x] ✅ Mini-history автора
- [x] ✅ Причина модерації (`ModerationReasonDialog` з категоріями)
- [x] ✅ Undo action (`lib/undoToast.ts`, 5 сек)
- [x] ✅ Auto-flagging inappropriate content + suspicious links

---

## ✅ ФАЗА 10.7: PRIVATE vs PUBLIC архітектура рецептів

> **Статус:** ядро, UI та серверна валідація реалізовані. RLS-01…10 мають live evidence за 08–10.08.2026; повні REC/FLOW/MOD сценарії відкриті. Застосування окремих міграцій перевіряти за PRE-03…05, а не повторювати їх за старою приміткою. Нові приватні джерела — [«Збережені рецепти»](saved-recipes-release.md), їхній deploy окремо не підтверджений.
> **Принцип:** PRIVATE = особиста кулінарна книга (будь-який контент), PUBLIC = спільнота (проходить модерацію).

### Правила

**PRIVATE рецепти** — дозволено все:

- незавершений контент, відсутні кроки/інгредієнти, короткі назви
- зовнішні посилання (TikTok, Instagram, YouTube, Telegram, Notion, блоги)
- масовий імпорт / quick save
- Без банів за кількість. Приватні фото можуть потрапити в ручну чергу за результатом image moderation (Фаза 18); масове збереження саме собою не є денним spam-сигналом

**PUBLIC рецепти** — тільки для "Поділитися зі спільнотою":

- обов'язкова назва
- хоча б інгредієнти АБО кроки приготування
- блокуються: scam / adult / gambling / phishing
- всі йдуть через чергу модерації

### ✅ Зроблено

- [x] ✅ **DB default** — `is_public DEFAULT false` (нові рецепти приватні) + backfill (`supabase/private_public_recipes.sql`)
- [x] ✅ **`is_public` у payload** — `recipe-modal.js` передає `is_public: isPublicSubmission` при збереженні
- [x] ✅ **Валідація публікації** — перед submit як PUBLIC: перевірка назви + (інгредієнти або кроки)
- [x] ✅ **Auto-flagging scope** — `detectFlags()` викликається в moderation queue і reports. Черга також містить приватні flagged-фото; твердження «тільки PUBLIC контент» не відповідає поточному коду
- [x] ✅ **Bot activity detection видалено** — масовий import приватних рецептів є нормальною поведінкою

> Окремо в `/api/save-recipe` діє ліміт **спроб створення за хвилину** (за замовчуванням 10, Фаза 17), включно з приватними та saved-записами. Це наявна поведінка API; денного правила «забагато рецептів = спам» немає. Звірка документів не змінює цей ліміт.

### 🔮 Наступна черга

- [x] ✅ **Окрема валідація на сервері** — DB trigger `validate_public_recipe` (`20260608_1300`): публічний `pending` без назви або без інгредієнтів/кроків → reject. Приватні (`is_public=false`) НЕ валідуються — будь-який контент дозволено
- [x] ✅ **"Зробити публічним" для існуючих приватних рецептів** — кнопка `recipe-card__make-public` на власних приватних рецептах (валідація назва+контент → `is_public=true, status=pending`)
- [x] ✅ **Позначення в UI** — бейдж `iconLock`/`iconGlobe` (`recipe-card__visibility`) на власних рецептах, обидва стани, у фірмовому стилі іконок
- [x] ✅ **Фільтр у "Твої рецепти"** — чіпи `recipe-own-filter` (Усі / Приватні / Публічні / На модерації), клієнтська фільтрація кешованих власних рецептів

---

## 🏗 ФАЗА 10.9: Структурний рефакторинг HTML/SCSS — уніфікація layout

> **Статус:** HTML/SCSS-рефакторинг зроблено. Локальна перевірка структури, тем і геометрії гостьових сторінок повторена 08.09.2026 (204 стани, [звіт](qa/phase22-2026-09-08/report.md)); авторизовані стани й реальні пристрої лишаються у Фазі 22.
> **Проблема (вирішена):** кожна сторінка мала різну структуру між `<header>` і `<footer>` — деякі мали зайві обгортки `div.app-bg > div.app-shell`, деякі не мали `<main>` взагалі, деякі мали `<main>` всередині grid-колонки. Це спричиняло різні відступи, нестабільний sticky-footer і невалідний HTML.
> **Принцип:** одна канонічна структура на всіх сторінках, нуль зайвих обгорток.
> **Перевірено по коду (червень 2026):** 0 збігів `app-bg`/`app-shell` у всіх HTML; кожна сторінка має `<main class="main">`; вкладені/відсутні `<main>` усунено.

---

### Канонічна структура (ціль для ВСІХ сторінок)

```html
<body class="page">
  <header class="header">…</header>
  <main class="main">
    <div class="container">
      <!-- контент сторінки -->
    </div>
  </main>
  <!-- модальні вікна (якщо є) -->
  <footer class="site-footer">…</footer>
</body>
```

**Правила:**
- `body.page` — flex-колонка, `min-height: 100vh`
- `main.main` — `flex: 1`, щоб завжди притискати футер до низу
- `div.container` — обмеження ширини + padding (max-width 1320px)
- Модальні вікна — поза `<main>`, перед `<footer>`
- Немає `div.app-bg`, немає `div.app-shell` — вони були зайвим дублюванням `container`

---

### Зміни по файлах

> Історія виконаного рефакторингу: блоки «До рефакторингу» нижче описують старий стан. Вони не є описом нинішнього HTML чи інструкцією повторно внести вже виконані зміни.

#### 📄 `index.html` (Меню на день) — НАЙСКЛАДНІШИЙ

**До рефакторингу:**
```
body.page.page--day-menu
  header
  div.app-bg
    div.app-shell
      div.container
        [page-header + day-week-nav + div.layout]
          div.layout (4-колонковий grid)
            aside.sidebar
            main.main  ← ПРОБЛЕМА: main всередині grid-колонки
            aside.water-sidebar
            aside.right-sidebar
  [модалки]
  footer
```

**Цільова структура:**
```
body.page.page--day-menu
  header
  main.main
    div.container
      [page-header + day-week-nav + div.layout]
        div.layout
          aside.sidebar
          div.meals-column  ← перейменувати з main.main (валідний HTML)
          aside.water-sidebar
          aside.right-sidebar
  [модалки]
  footer
```

**Конкретні зміни в HTML:**
- [x] ✅ Видалити рядок `<div class="app-bg">`
- [x] ✅ Видалити рядок `<div class="app-shell">`
- [x] ✅ Замінити `<div class="container">` → `<main class="main"><div class="container">`
- [x] ✅ Замінити внутрішній `<main class="main">` (grid-колонка) → `<div class="meals-column">`
- [x] ✅ Замінити відповідний `</main>` (grid-колонки) → `</div>`
- [x] ✅ Виправити закриваючі теги: `</div></main>` замість `</div></div></div>`

**Конкретні зміни в SCSS (`_layout.scss` + `_day-menu.scss`):**
- [x] ✅ Додати `.meals-column` туди де є `.main` як grid-колонка: `display: flex; flex-direction: column; min-width: 0; flex: 1;`
- [x] ✅ Замінити `.page--day-menu .main` → `.page--day-menu .meals-column` де мається на увазі колонка

---

#### 📄 `week-menu.html` (Меню на тиждень)

**До рефакторингу:**
```
div.app-bg > div.app-shell > div.container > main.main
```
*(container зовні main — неправильний порядок)*

**Цільова структура:**
```
main.main > div.container
```

**Конкретні зміни в HTML:**
- [x] ✅ Видалити `<div class="app-bg">`
- [x] ✅ Видалити `<div class="app-shell">`
- [x] ✅ Замінити `<div class="container">` → `<main class="main">`
- [x] ✅ Замінити `<main class="main">` → `<div class="container">`
- [x] ✅ Виправити закриваючі теги: `</div></main>` замість `</main></div></div></div>`

---

#### 📄 `recipes.html` (Рецепти)

**До рефакторингу:**
```
div.app-bg > div.app-shell > main.recipe-page > div.container
```

**Цільова структура:**
```
main.main.recipe-page > div.container
```
*(зберігаємо клас `recipe-page` для page-specific стилів)*

**Конкретні зміни в HTML:**
- [x] ✅ Видалити `<div class="app-bg">`
- [x] ✅ Видалити `<div class="app-shell">`
- [x] ✅ Замінити `<main class="recipe-page">` → `<main class="main recipe-page">`
- [x] ✅ Виправити закриваючі теги: прибрати два зайві `</div>`

---

#### 📄 `shopping-list.html` (Список покупок)

**До рефакторингу:**
```
div.app-bg > div.app-shell > main.shop-page > div.container
```

**Цільова структура:**
```
main.main.shop-page > div.container
```

**Конкретні зміни в HTML:**
- [x] ✅ Видалити `<div class="app-bg">`
- [x] ✅ Видалити `<div class="app-shell">`
- [x] ✅ Замінити `<main class="shop-page">` → `<main class="main shop-page">`
- [x] ✅ Виправити закриваючі теги: прибрати два зайві `</div>`

---

#### 📄 `product-guide.html` (Путівник по продуктах)

**До рефакторингу:**
```
div.app-bg > div.app-shell > main.main > div.container
```
*(внутрішня структура правильна, зайві лише app-bg і app-shell)*

**Цільова структура:**
```
main.main > div.container
```

**Конкретні зміни в HTML:**
- [x] ✅ Видалити `<div class="app-bg">`
- [x] ✅ Видалити `<div class="app-shell">`
- [x] ✅ Виправити закриваючі теги: прибрати два зайні `</div>`

---

#### 📄 `cookbook.html` (Книга рецептів)

**До рефакторингу:**
```
main (без класу) > div.container > div.cookbook-page
```

**Цільова структура:**
```
main.main > div.container > div.cookbook-page
```

**Конкретні зміни в HTML:**
- [x] ✅ Замінити `<main>` → `<main class="main">`

---

#### 📄 `profile.html` (Профіль)

**До рефакторингу:**
```
div.profile-container
  div.page-header
  div.profile-layout
    nav.profile-sidebar
    main.profile-main  ← вкладений <main> — невалідний HTML
```

**Цільова структура:**
```
main.main
  div.container
    div.page-header
    div.profile-layout
      nav.profile-sidebar
      div.profile-main  ← не може бути <main> всередині <main>
```

**Конкретні зміни в HTML:**
- [x] ✅ Замінити `<div class="profile-container">` → `<main class="main"><div class="container">`
- [x] ✅ Замінити `<main class="profile-main">` → `<div class="profile-main">`
- [x] ✅ Замінити відповідний `</main>` → `</div>`
- [x] ✅ Виправити закриваючі теги: `</div></main>` замість `</div></div>`

**Конкретні зміни в SCSS (`_profile.scss`):**
- [x] ✅ Перевірити чи є стилі на `.profile-container` → перенести на `main.main` або залишити якщо не конфліктують
- [x] ✅ `.profile-main` лишається — змінюється лише HTML-тег з `<main>` на `<div>`

---

#### 📄 `recipe.html` (Сторінка рецепту)

**До рефакторингу:**
```
header.rp-bar
div#recipeRoot  ← JS рендерить контент сюди, немає main
footer
```

**Цільова структура:**
```
header.rp-bar
main.main
  div#recipeRoot
footer
```

**Конкретні зміни в HTML:**
- [x] ✅ Додати `<main class="main">` перед `<div id="recipeRoot">`
- [x] ✅ Додати `</main>` після `</div>` що закриває recipeRoot
- [x] ✅ Перевірити JS: рендерить у `#recipeRoot` через innerHTML — нічого не змінилось

---

### Зміни в SCSS

#### `scss/layout/_layout.scss`
- [x] ✅ Додати `flex: 1` до `.main` (page wrapper) — щоб footer завжди був внизу
- [x] ✅ Видалити або закоментувати стилі `.app-shell` (більше не використовується)
- [x] ✅ Видалити правило `.app-bg, .page > main, #recipeRoot { flex: 1 }` — воно було тимчасовим
- [x] ✅ Додати `.meals-column` як замінник `.main` в grid-контексті (index.html) — `_layout.scss:146,163`

#### `scss/pages/_day-menu.scss` (або де є `.page--day-menu .main`)
- [x] ✅ Знайти всі `.layout .main` або `.page--day-menu .main` → замінити на `.meals-column` — `_day-menu.scss:29`

#### `scss/pages/_profile.scss`
- [x] ✅ Перевірити `.profile-container` стилі → перенести на `main.main` якщо потрібно

---

### Історичний порядок виконаного рефакторингу

1. Спочатку SCSS зміни (щоб не зламати стилі при HTML рефакторингу)
2. Потім HTML файли по одному, перевіряючи кожен у браузері
3. Компіляція SCSS після кожного кроку
4. Фінальна перевірка: всі сторінки у світлій та темній темі, мобільний вигляд

### Критерії завершення
- [x] ✅ Жодного `div.app-bg` або `div.app-shell` в жодному HTML-файлі (0 збігів)
- [x] ✅ Кожна сторінка має `<main class="main">` як прямий дочірній елемент `body.page`
- [x] ✅ `<main>` не вкладено в інший `<main>` (валідний HTML)
- [x] ✅ Футер завжди притиснутий до низу viewport навіть на порожніх сторінках — перевірено програмно на всіх 16 сторінках × 2 в'юпорти (18.07.2026)
- [x] ✅ Однакові відступи між header↔content і content↔footer — вибірковий візуальний огляд скриншотів у Фазі 22 (18.07.2026), розбіжностей не помічено
- [x] ✅ Нуль регресій у існуючих стилях — прохід Фази 22 (18.07.2026): 0 overflow, 0 помилок консолі

---

## 🦶 ФАЗА 10.8: Глобальний футер

> **Статус:** ядро футера реалізоване; локальні теми/layout перевірені 18.07 та повторно 08.09.2026, mobile accordion — 08.09.2026. Повний UI-05/06 і відкладені інтеграції лишаються відкритими.
> **Tagline:** "Харчові звички набувають форми"
> **Принцип:** мінімалістичний, без зайвого — тільки те що реально існує зараз.

### Структура

**4 колонки на десктопі / акордеон на мобайлі**

| Колонка | Посилання |
|---|---|
| Brand | Логотип + tagline |
| Продукт | Меню на день / Меню на тиждень / Рецепти / Книга рецептів / Путівник / Список покупок |
| Підтримка | Help Center / Feedback / Report issue |
| Юридичне | Privacy / Terms / Cookies / GDPR / Company Info |

**Bottom row:** `© 2026 MintoFood` + перемикач UA/EN/PL; tagline розміщений у Brand-колонці (`partials/footer.html`).

### ✅ Зроблено

- [x] ✅ HTML-компонент `partials/footer.html`
- [x] ✅ SCSS `scss/layout/_footer.scss` — десктоп 4 колонки, tablet 2×2, mobile акордеон
- [x] ✅ Спільний футер підключено до public/legal сторінок, включно з `recipe.html` для `/recipe/{slug}`; актуальна матриця 17 сторінок — у [QA-звіті 08.09](qa/phase22-2026-09-08/report.md)
- [x] ✅ Тест світлої + темної теми (18.07.2026, автоматизований QA-прохід Фази 22 — обидві теми, desktop+mobile)

### 🔮 Відкладено (залежності або TIER 2/3)

- [ ] **Newsletter signup** → залежить від Resend (Фаза 14)
- [ ] **Pricing посилання** → коли з'явиться сторінка (Фаза 19)
- [ ] **Соцмережі** (IG / TikTok / Pinterest / YouTube) → коли з'являться акаунти
- [x] ✅ **Перемикач мови UA/EN/PL** є в `partials/footer.html`; повний runtime-тест перемикання — UI-05
- [ ] **Blog / Press / Affiliate** → TIER 2/3
- [ ] **Status page** → TIER 3

---

# 🚀 TIER 1 — MUST до публічного launch

> Без цього не запускаємось. Усе тут має бути зроблено фундаментально, без скорочень.
> **Орієнтовно:** 8-12 тижнів роботи (включно з генерацією документів і beta-тестуванням).

---

## 🎯 ФАЗА 11: Customer validation (НОВА, критична)

> **Чому це перше:** перш ніж писати paywall, інтегрувати платежі і генерувати pricing page — треба перевірити попит. Persona й скрипт готові в [customer-research.md](customer-research.md); журнал інтерв'ю та висновки не заповнені. Це відсутність задокументованих результатів, а не доказ кількості фактично проведених розмов.

### 📞 Customer interviews

- [x] Сформулювати target persona: жінки 25-45, ЄС + Україна, цікавляться харчуванням, користувались MyFitnessPal/Yazio/Lifesum
- [ ] Знайти 15 респондентів: соцмережі, ком'юніті, знайомі, Reddit r/MealPrep / r/loseit, українські Telegram-групи
- [x] Підготувати скрипт інтерв'ю (30-45 хв):
  - [x] Що зараз використовуєш для трекінгу харчування? Чому саме це?
  - [x] Що в цьому додатку бісить? Що б змінила?
  - [x] Чи платиш за щось у цій сфері? Скільки? За що саме?
  - [x] Якби була магічна фіча для харчового додатку — що б це було?
  - [x] Показ MintoFood (5–8 хв demo у готовому скрипті) → чесна реакція
  - [x] За що в MintoFood ти б заплатила $5/міс? А за що точно не заплатила б?
- [ ] Провести 10-15 інтерв'ю (1 на день, 2 тижні)
- [ ] Транскрибувати + позначити паттерни (Notion/Miro)

### 📊 Висновки → рішення

- [ ] **Top 3 болі** з інтерв'ю → що з них вирішує MintoFood вже?
- [ ] **Top 3 фічі**, за які люди готові платити → це і є основа Premium (а НЕ "10 рецептів max")
- [ ] Скласти **value proposition** одним реченням: "MintoFood — це [що] для [кого], тому що [unique value]"
- [ ] Зафіксувати: ціна (стрес-тест на $3 / $5 / $7 / $10) — за що готові, за що ні
- [x] Створити `docs/customer-research.md`: persona, скрипт, шаблони журналу й висновків
- [ ] Заповнити журнал і висновки фактичними результатами; оновлювати дослідження кожні 3 міс

### 💡 Outcome

- [ ] Переписана Фаза 19 (монетизація) на основі реальних insights
- [ ] Реалістична Free vs Premium розбивка
- [ ] Перший draft messaging для pricing page

> ⚡ _Якщо інтерв'ю покажуть, що ніхто не платить за recipe app — це теж результат. Краще дізнатись до реалізації платної підписки._

---

## 🧹 ФАЗА 12: Чистка БД + Migration safety (РОЗШИРЕНА)

> Старий план — просто "почистити стале". Новий — додати інфраструктуру для безпечних змін на майбутнє. Це найдешевший момент: поки таблиць мало.

### 🧽 Чистка

- [x] `profiles` vs `user_profiles` — різні ролі, обидві активні (profiles = auth/admin, user_profiles = health data)
- [x] Видалити `old_products` — замінена новою таблицею products
- [x] Видалити `recipetest`, `cookbook_notes`, `cookbook_notebooks`, `shopping_list`, `meals_backup_before_streaks`, `product_similar`
- [x] Проведено аудит RLS; live evidence RLS-01…10 за 08–10.08.2026 — у [QA-плані](qa-test-plan.md). Це покриття перелічених таблиць/операцій на дату прогону, а не підтвердження всіх наступних міграцій

### 🧬 Migration safety (НОВЕ — критичне для solo founder)

- [x] **Naming convention:** `YYYYMMDD_HHMM_description.sql` — зафіксовано у `supabase/migrations/README.md`
- [x] Тримати всі міграції у `supabase/migrations/` + у git
- [x] **Migration policy документ** `docs/migrations.md` — checklist, типи операцій, алгоритм NOT NULL
- [x] **Rollback стратегія:** правило про окремий `_rollback.sql` задокументоване; перевірка повноти всіх активних міграцій лишається AUTO-10
- [x] **Staging DB sync:** є `supabase/staging-sync.ps1` для schema-only sync і опційного seed; це не підтверджує створення staging-проєкту чи успішну репетицію — див. [інструкцію](staging-db-sync.md) і Фазу 17

### 🚩 Feature flags (НОВЕ — критичне!)

- [x] Таблиця `feature_flags` — `supabase/migrations/20260518_1000_feature_flags.sql`
- [x] Helper `js/feature-flag.js`: `isEnabled(key, userId)` → boolean, кеш 5 хв, детермінований rollout
- [x] Кешування 5 хвилин (sessionLevel, не запит на кожну дію)
- [x] Адмінка: секція `app/(admin)/feature-flags/` для toggle без deploy
- [x] Перші флаги: `social_features_enabled`, `ai_scan_enabled`, `paywall_enabled`, `new_onboarding`, `referral_enabled`

### 📋 Release checklist

- [x] `docs/release-checklist.md` — pre-deploy, deploy, smoke test, rollback
- [x] Прикріпити як PR template (`.github/pull_request_template.md`)

---

## ⚖️ ФАЗА 13: Юридичне + GDPR

> **Контекст:** ти базуєшся в ЄС → GDPR обов'язковий з дня 1. Штрафи реальні (до €20M або 4% обороту). Це НЕ "later" — це launch blocker.

### 📄 Документи

- [x] Privacy Policy — `privacy.html` ✅ v1.0 (липень 2026, на основі фактів кодової бази, health-дані ст. 9)
- [x] Terms of Service — `terms.html` ✅ v1.0 (липень 2026, private/public рецепти, право Польщі)
- [x] Cookie Policy — `cookies.html` ✅ v1.0 (липень 2026, реальні localStorage-ключі)
- [x] Disclaimer "Не є медичною порадою" — на сторінках профілю, контролю ваги, активності, статистики
- [x] Imprint / Impressum — шаблон `imprint.html` створено; заповнення даними оператора лишається відкритим у QA-13.6
- [x] DMCA / copyright complaint procedure — `dmca.html`, посилання у футері всіх сторінок

### 🍪 Cookie consent banner

- [x] Self-built — `js/cookie-consent.js` + `scss/components/_cookie-consent.scss` (auto-init, підключено на всіх 14 публічних сторінках через `build.js`)
- [x] Категорії cookies: Necessary / Analytics / Marketing
- [x] Granular toggles (панель "Налаштувати")
- [x] Reject All на тому ж рівні видимості що Accept All (compliance)
- [x] Збереження вибору на 6 місяців (localStorage)
- [x] Re-prompt при додаванні нових cookies — `CONSENT_VERSION` у `js/cookie-consent.js`, bump при змінах

### 🔐 GDPR — права юзера

- [x] **Data Export endpoint** — `api/gdpr-export.js` → JSON; повнота експорту не закрита (`BLOCKED-GDPR-01`, `DECISION-GDPR-01` у QA-плані)
- [x] **Right to be Forgotten:** soft-delete + 30-денний grace period через `soft_delete_user()`
  - [x] Hard-delete CRON handler і розклад після grace period; захист endpoint перевірено DEP-10/11, повний запуск DEP-12/DEL ще не підтверджений
  - [ ] Анонімізація платіжних записів (TIER 1 → після Фази 19)
- [x] **Data Rectification** — через профіль (вже працює)
- [x] **Формат Data Portability** — JSON export через `/api/gdpr-export`; повнота даних та E2E — QA-13.1
- [x] Логування GDPR-запитів у таблицю `gdpr_requests` — `20260518_1300_gdpr.sql`

### 📑 DPA з усіма sub-processors

- [ ] Supabase (з їх dashboard)
- [ ] Vercel (з settings)
- [ ] Провайдер платежів — після зафіксованого вибору у Фазі 19
- [ ] Resend
- [ ] PostHog (EU hosting!)
- [ ] Sentry
- [x] Список sub-processors — у `privacy.html#processors`

### 🧒 Edge cases

- [x] Клієнтський age/terms checkbox при signup реалізовано (`js/auth.js`)
- [ ] Серверне забезпечення та збереження signup consent — AUTH-01 має FAIL; перевірка лише в браузері не закриває цей пункт
- [x] Disclaimer для weight goals: якщо BMI < 18.5 або ціль <17 → попередження + посилання на лікаря
- [ ] Disclaimer для пенсіонерів/вагітних — частково: згадано в медичному disclaimer terms.html v1.0 (усі 3 мови); контекстне попередження в UI профілю ще не зроблено

### ✅ QA — консолідований ручний чекліст

> Перенесено з окремого `docs/phase13-manual-qa.md`, щоб усі активні задачі Фази 13 жили в одному місці.

**Підтверджено по коду та схемі:**

- [x] `profile.html` містить GDPR-картку в Settings, export і delete-account дії.
- [x] `js/profile.js` підключає `gdprExportBtn` до `GET /api/gdpr-export`, а `deleteAccountBtn` — до confirm → `soft_delete_user`.
- [x] `api/gdpr-export.js` вимагає bearer token, віддає JSON і логує export у `gdpr_requests`.
- [x] Cookie consent зберігається для гостя в `localStorage`, для авторизованого користувача — у `profiles.consent_*`.
- [x] `cookies.html` має кнопку повторного відкриття cookie settings через `reopenCookieBanner()`.
- [x] Signup без age/consent checkbox блокується подвійно: disabled-кнопкою та перевіркою submit у `js/auth.js`.
- [x] `soft_delete_user(uuid)` дозволена `authenticated`/`service_role`, заборонена `anon`/`PUBLIC` і відхиляє виклик без `auth.uid()`.

#### QA-13.1 — GDPR export

**Статус:** endpoint реалізований; повнота експорту заблокована. Після погодження користувачкою 06.10.2026 `recipe_ratings` та `api_rate_limits` додані у JSON з фільтром власника токена (`BLOCKED-GDPR-01 — FIXED LOCAL`, 5/5 регресійних перевірок). Deployment і live GDPR-04 ще не підтверджені. Export/retention для інших пов'язаних даних потребує рішення (`DECISION-GDPR-01`). Див. [QA-план](qa-test-plan.md); до закриття цих пунктів не позначати експорт повним.

Передумови: реальний тестовий акаунт із заповненим профілем, хоча б однією книгою і рецептом; користувач залогінений.

- [ ] Відкрити `profile.html` → Settings → `GDPR і приватність`.
- [ ] Натиснути `Завантажити мої дані` та дочекатися завантаження без падіння сторінки.
- [ ] Перевірити ім'я файлу виду `mintofood-export-XXXXXXXX.json`.
- [ ] Перевірити поточні секції JSON (цей перелік ще не є повним експортом):
  - `exported_at`, `user_id`, `email`, `profile`;
  - `health_profile` (`user_profiles`: age, height, weight, goals, norms);
  - `recipes`, `cookbooks`, `meals`, `water`, `week_meals`;
  - `weight_records`, `activities`, `streaks`;
  - `shopping_lists`, `shopping_items`, `gdpr_requests`;
  - `scanned_product_corrections`, `scanned_product_name_corrections`;
  - `recipe_pending_updates`, `recipe_reports`.
- [ ] Перевірити, що у `gdpr_requests` з'явився свіжий успішний export:

```sql
select type, status, requested_at, completed_at
from gdpr_requests
where user_id = '<USER_ID>'
order by requested_at desc;
```

Очікування: новий рядок `type = 'export'`, після успіху `status = 'completed'`.

#### QA-13.2 — GDPR delete request

**Статус:** код запиту й hard-delete реалізований. Застосування v2/v3 задокументовано нижче та у Фазі 17; повторно застосовувати їх за старою приміткою не потрібно. Ручний delete-flow і авторизований cron залишаються відкритими (DEP-12/DEL); нове очищення приватних джерел має окремий [порядок запуску](saved-recipes-release.md).

Передумови: disposable test account, залогінений і ще не запланований на видалення.

- [x] ✅ Міграцію `20260718_1200_gdpr_hard_delete_v2.sql` застосовано в Supabase (v3 від 29.07 надбудовується на неї, отже v2 точно застосована).
- [ ] Відкрити `profile.html` → Settings → `Запросити видалення акаунту`.
- [ ] Перевірити confirm modal і підтвердити дію.
- [ ] Перевірити, що сторінка не падає, показує заплановану дату, а кнопка стає disabled.
- [ ] Перезавантажити сторінку і переконатися, що scheduled state зберігся.
- [ ] Перевірити БД:

```sql
select id, deletion_requested_at, deletion_scheduled_for
from profiles
where id = '<USER_ID>';

select type, status, requested_at, completed_at
from gdpr_requests
where user_id = '<USER_ID>'
order by requested_at desc;
```

Очікування: `deletion_requested_at` заповнене, `deletion_scheduled_for` приблизно через 30 днів, є новий `gdpr_requests.type = 'delete'`.

#### QA-13.3 — Cookie banner для гостя

**Статус:** display/choice/persistence готові до тесту; analytics suppression заблокована до інтеграції PostHog.

Передумови: чистий профіль браузера або очищене site storage; користувач не залогінений.

- [ ] Відкрити будь-яку public page і переконатися, що банер з'явився.
- [ ] Натиснути `Відхилити все`, перезавантажити сторінку і перевірити, що банер не з'явився повторно для тієї самої consent version.
- [ ] Перевірити `minto_consent` у localStorage: `necessary: true`, `analytics: false`, `marketing: false`, `version: '1'`.
- [ ] На `cookies.html` натиснути `Відкрити налаштування cookies`, увімкнути лише analytics і зберегти.
- [ ] Перевірити, що банер повторно відкрився, а custom choice оновила localStorage.
- [ ] Після інтеграції PostHog: `Відхилити все` → analytics SDK і запити не завантажуються.

#### QA-13.4 — Cookie consent для авторизованого користувача

**Статус:** готово до ручного тесту.

- [ ] Увійти свіжим тестовим акаунтом і вибрати будь-який consent option.
- [ ] Перезавантажити сторінку та відкрити іншу public page — банер не повинен з'являтися знову.
- [ ] За потреби вийти та повторно увійти тим самим акаунтом у тому самому браузері.
- [ ] Перевірити БД:

```sql
select consent_analytics, consent_marketing, consent_version, consent_at
from profiles
where id = '<USER_ID>';
```

Очікування: `consent_version = '1'`, значення analytics/marketing відповідають вибору, `consent_at` заповнене.

#### QA-13.5 — Signup age gate

**Статус:** клієнтська перевірка реалізована. AUTH-01 має FAIL через відсутність серверного забезпечення та збереження consent; лише UI smoke test не закриває цей дефект.

- [ ] Відкрити auth modal → Register, лишити checkbox порожнім і перевірити disabled submit.
- [ ] Увімкнути checkbox → submit стає активним; вимкнути → знову disabled.
- [ ] Перевірити, що consent text веде на `terms.html` і `privacy.html`.
- [ ] Перевірити fallback-валідацію: примусовий submit без checkbox показує age-required error.

#### QA-13.6 — Legal path smoke test

**Статус:** документи v1.0 готові; лишився imprint оператора та юридичне рев'ю перед монетизацією.

- [ ] `privacy.html` у GDPR rights веде користувача до `Профіль → Налаштування → GDPR`.
- [ ] `cookies.html` описує `minto_consent`, analytics cookies і кнопку повторного відкриття settings.
- [x] Privacy/Terms/Cookies переписані на основі фактичної кодової бази; `[ДАТА]` і template warnings прибрані.
- [x] Privacy/Terms/Cookies перекладені UA/EN/PL через `data-lang-block`; `dmca.html` та `imprint.html` поки UA-only.
- [ ] Заповнити `imprint.html` реальними даними оператора: назва ФОП/компанії, адреса, NIP.
- [ ] **Юридичне рев'ю обов'язково перед Фазою 19:** польський юрист, орієнтовно 500–1500 zł; перевірити споживче право ЄС, 14 днів відмови та refund policy.

#### QA-13.7 — Hard delete cron, лише staging

> Не запускати недбало на production. Використовувати disposable account із `deletion_scheduled_for` у минулому.

- [ ] `api/cron/gdpr-hard-delete.js` знаходить користувача, строк якого настав.
- [ ] `hard_delete_user_data()` видаляє app data.
- [ ] Supabase Admin API видаляє рядок з `auth.users`.

#### Exit criteria Phase 13 manual QA

- [ ] GDPR export download пройшов.
- [ ] GDPR delete request пройшов.
- [ ] Cookie banner choice/persistence пройшов для гостя й авторизованого користувача.
- [ ] Signup age gate smoke test пройшов.
- [ ] Legal path smoke test пройшов.

**Тримати відкритим окремо після базового QA:**

- [ ] Analytics suppression proof — після реальної інтеграції PostHog у Фазі 16.
- [ ] Реальні дані оператора в `imprint.html`.
- [ ] Фінальне юридичне рев'ю — перед Фазою 19.

---

## 📧 ФАЗА 14: Email-інфраструктура (Resend) — РАНІШЕ

> **Перенесено вище:** welcome email і password reset потрібні з першого дня живих юзерів, не "після монетизації".

### 🛠 Setup

- [ ] Створити акаунт Resend
- [ ] Verify domain (`mintofood.com` або `mail.mintofood.com`)
- [ ] DNS: **SPF / DKIM / DMARC** (рекомендую `p=quarantine` спочатку, потім `p=reject`)
- [ ] Перевірити через mail-tester.com — має бути 10/10
- [ ] API key у Vercel env vars

### 📝 React Email шаблони — Phase 1 (для launch)

- [ ] Встановити `@react-email/components`
- [ ] Базовий layout: лого, кольори бренду, footer з unsubscribe
- [ ] **Welcome** — після signup
- [ ] **Email confirmation** — Supabase Auth кастомізація
- [ ] **Password reset** — Supabase Auth кастомізація
- [ ] **Account deletion confirmation** (GDPR)

### 📝 React Email шаблони — Phase 2 (для монетизації)

- [ ] **Trial started**
- [ ] **Trial ending in 2 days** ⚠️ (CRON job на Vercel — критичний для conversion)
- [ ] **Trial ended → first payment**
- [ ] **Payment receipt**
- [ ] **Payment failed** (з кнопкою → Customer Portal)
- [ ] **Subscription canceled** (м'яка спроба reactivate)
- [ ] **Subscription reactivated**

### 🌍 Локалізація

- [ ] Усі шаблони у 3 мовах (ua/en/pl)
- [ ] Визначення мови з `profiles.language` або browser fallback
- [ ] Дати/числа форматувати локально

### 📬 Email preferences

- [ ] Сторінка `/profile/notifications`
- [ ] Категорії: Транзакційні (обов'язкові) / Нагадування / Маркетинг / Weekly digest
- [ ] Збереження в `profiles.email_preferences` (JSONB)
- [ ] Unsubscribe link у кожному не-транзакційному листі

### 🚫 Bounce & complaint handling

- [ ] Webhook від Resend на `/api/webhooks/resend`
- [ ] `email.bounced` → позначити невалідний, не слати
- [ ] `email.complained` (юзер позначив як спам) → автоматичний unsubscribe

### ✅ QA

- [ ] Тест відправки кожного шаблону на 3 мовах
- [ ] Тест unsubscribe
- [ ] Тест на mail-tester.com
- [ ] Тест rendering у Gmail / Outlook / Apple Mail / Yahoo

---

## 🔍 ФАЗА 15: SEO + публічні URL рецептів — здебільшого зроблена

### 🔗 Публічні URL рецептів — ✅

- [x] ✅ Колонка `recipes.slug`, бекфіл, тригер на auto-generation
- [x] ✅ Маршрут `/recipe/{slug}`, публічний доступ без login
- [x] ✅ CTA "Зберегти в книгу" → login modal
- [x] ✅ 404 page

### 🏷 Schema.org Recipe markup (JSON-LD) — ✅

- [x] ✅ Усі поля Recipe (name, image, author, nutrition, ingredients, instructions, ratings)
- [x] ✅ prepTime, cookTime, totalTime, recipeYield (міграція seo_timing_migration.sql)
- [x] ✅ Аудит markup по коду: `aggregateRating` використовує динамічні `AVG(rating)` і `COUNT(*)` з окремих голосів у `recipe_ratings`; один голос на користувача, власні рецепти оцінювати не можна, старі одиничні `recipes.rating` не враховуються
- [x] ✅ Міграцію `20260726_1000_recipe_ratings.sql` застосовано в Supabase (підтверджено 30.07.2026: таблиця `recipe_ratings` існує на живій БД) — лишився живий smoke-test RPC `get_recipe_rating_summaries`
- [ ] Тест через Google Rich Results Test (search.google.com/test/rich-results) — потребує deployed URL

### 🌐 Multi-language SEO — ✅

- [x] ✅ hreflang tags (uk/en/pl + x-default)
- [x] ✅ `?lang=` параметр з canonical
- [x] ✅ Canonical URL на кожній сторінці
- [x] ✅ Meta tags локалізовані у 3 мовах

### 🗺 Sitemap.xml & robots.txt — здебільшого ✅

- [x] ✅ Динамічний `/sitemap.xml` (статичні + рецепти + hreflang)
- [x] ✅ Продукти путівника в sitemap — **не додаємо (26.07.2026)**: продукти НЕ мають публічних окремих URL. Путівник рендерить їх модалками на одній сторінці (`product-guide.html`), без slug, deep-link чи канонічних адрес. Додавати fragment-URL (`#...`) у sitemap марно — Google не індексує їх як окремі сторінки. Умова роадмапу «(якщо публічні)» не виконується. Переглянути, якщо в TIER 2+ з'являться публічні сторінки продуктів
- [x] ✅ `/robots.txt` (Allow public, Disallow admin/profile/api)

### 🖼 Open Graph + Twitter Cards

- [x] ✅ OG tags + Twitter Card tags реалізовані; у `recipe.html` початкові значення порожні, `js/recipe-page.js` заповнює їх після завантаження рецепта. Це не підтверджує preview у сервісах поширення
- [ ] **Динамічна OG image** для рецептів — `vercel/og` (recipe.image + бренд оверлей)
- [ ] Тест через opengraph.xyz / Twitter Card validator: перевірити отримані метадані й фото конкретного рецепта; SEO-06/09. Спосіб усунення можливого дефекту потребує окремого рішення

### 🔘 Шерінг

- [x] ✅ Кнопка "Поділитися" (Web Share API + copy link)
- [ ] Тест share у Telegram / Messenger / iOS Messages

### 📈 Search Console + Bing Webmaster

> ⏳ Блокер: реальний домен → див. Фазу 17

- [ ] Зареєструвати в Google Search Console після підключення домену
- [ ] Submit sitemap.xml
- [ ] Bing Webmaster (~5% ринку)

### ✅ QA

- [ ] Тест Rich Results для 3-5 різних рецептів
- [ ] Тест hreflang через Search Console
- [ ] Тест публічної сторінки в incognito
- [ ] Тест шерінгу в соцмережах
- [ ] Lighthouse SEO score 100

---

## 📊 ФАЗА 16: Analytics + Error Tracking + Onboarding

### 📈 PostHog (EU hosting) — код готовий (30.07.2026, виправлено після рев'ю), чекає акаунту

> `js/analytics.js`: auto-init за патерном `cookie-consent.js`, SDK (зафіксована версія `posthog-js@1.203.1`, не floating tag) вантажиться лінькво через jsDelivr лише коли `consent_analytics===true`. Перший стан надходить через **`getConsentReadyState()` / `consentReady`** з `cookie-consent.js`: для залогіненого користувача аналітика чекає завершення синхронізації БД, а не читає localStorage передчасно. Наступні зміни приходять через `consentUpdated`. Last-write-wins та race-safe identify винесені в чистий `js/analytics-consent-gate.js`; повторний однаковий analytics-стан не створює дубль `$pageview`, `SIGNED_OUT` інвалідовує pending identify, а product events після revoke блокуються самим gate. Без ключа (`meta[name="minto-posthog-key"]`) CDN не завантажується. `connect-src`/`script-src` у `vercel.json` CSP дозволяють PostHog + jsDelivr. **Реальне підставлення ключа:** `build.js` інжектить `<meta>` з env var `POSTHOG_KEY`/`POSTHOG_HOST` при `npm run build` (Vercel buildCommand) і змінює runtime-блок лише коли його вміст відрізняється — другий build з тими самими env дає `0 updated`.

- [ ] Створити акаунт (EU-hosting обов'язково для GDPR)
- [x] ✅ Інтеграція через `posthog-js` (CDN-модуль, зафіксована версія, без npm — сайт vanilla JS без бандлера)
- [x] ✅ Респект cookie consent — `getConsentReadyState()`/`consentReady` для першого стану, `consentUpdated` для змін, симетричний `opt_in`/`opt_out_capturing()`
- [x] ✅ Identify users після login — `posthog.identify(uid)` на `SIGNED_IN`, `reset()` на `SIGNED_OUT`. **Це псевдонімізація, не анонімність** — `cookies.html` виправлено в UA/EN/PL: «псевдонімізована» / `pseudonymised` / `pseudonimizowana`
- [x] ✅ **Tracking events (мінімальний набір):**
  - [x] ✅ `signup_started` / `signup_completed` — `js/auth.js` (`signUpWithEmail`)
  - [x] ✅ `recipe_created` — `js/recipe-modal.js` (лише на створення, не на edit)
  - [ ] ⚠️ `recipe_published` — клієнтський код у `recipe-modal.js` виправлено (правильна умова `status==='published'`, не `pending`), АЛЕ подія фактично **ніколи не спрацьовує в реальному потоці**: `api/save-recipe.js` завжди повертає публічний рецепт зі статусом `pending` (модерація), реальний перехід у `published` відбувається пізніше, коли адмін схвалює в `admin-app/src/app/actions/moderation.ts` — окремому застосунку, де PostHog взагалі не підключений. Track-виклик потрібно перенести в admin-app на момент approve (з ID автора рецепта), інакше подія мертва. `recipe_submitted_for_review` (перехід у `pending`) — єдина, що реально спрацьовує зараз
  - [x] ✅ `meal_logged` / `water_logged` / `weight_logged` — `js/meals.js`, `js/profile.js`
  - [x] ✅ `recipe_saved_to_book` / `cookbook_created` — `js/book-selector.js`, `js/cookbook.js`
  - [ ] `paywall_shown` / `checkout_started` / `subscription_*` / `ai_scan_used` — фічі ще не існують (Фаза 19/36), додати разом з ними
- [ ] **Funnels:** signup → first meal → 7-day retention → trial → paid (налаштовується в PostHog dashboard, після акаунту)
- [ ] **Cohort retention** weekly (dashboard, після акаунту)
- [ ] Session recordings з GDPR-маскою (no PII) — `disable_session_recording:true` в коді зараз; увімкнути свідомо окремим кроком з маскою

### 🚨 Sentry — код готовий (30.07.2026, виправлено після рев'ю), чекає акаунту

> Публічний сайт: `js/error-tracking.js` — SDK з **офіційного Sentry CDN** (`browser.sentry-cdn.com`, зафіксована версія `10.69.0`), НЕ jsDelivr/npm: з версії 10.x `@sentry/browser` більше не публікує standalone browser-bundle через npm registry (лише ESM з relative імпортами між файлами — не працює як єдиний CDN `import()`). Офіційний CDN віддає classic IIFE-script (`window.Sentry`), підключається через `<script>` тег, не `import()`. **Breadcrumbs (кліки/навігація/fetch) і BrowserSession явно вилучені з `defaultIntegrations`** — `integrations:[]` дефолтні інтеграції не вимикає. Лишаються технічні дані помилки, URL/user-agent та, після входу, `user.id`; рішення тримати Sentry поза analytics consent потребує окремого підтвердження правової підстави перед додаванням DSN. Admin-app: офіційний Next.js 16 патерн — `src/instrumentation-client.ts` (клієнт, з обов'язковим `onRouterTransitionStart` — інакше build-warning) + `src/instrumentation.ts` (`register()`+`onRequestError`), `next.config.ts` обгорнуто `withSentryConfig` (`webpack.treeshake.removeDebugLogging`, не deprecated `disableLogger`). **`@sentry/nextjs` реально встановлено** (`npm install` виконано, версія `^10` — v8 НЕ підтримує Next.js 16, помилка знайдена рев'ю), `npm run build` в admin-app проходить чисто без попереджень. Без DSN (`SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`/`meta[name="minto-sentry-dsn"]`) — усюди no-op. **Реальне підставлення DSN на публічному сайті:** `build.js` інжектить `<meta>` з env var `SENTRY_DSN_PUBLIC`; runtime-блок оновлюється лише коли значення реально змінилося.

- [ ] Створити акаунт, free tier 5K events/міс
- [x] ✅ `@sentry/browser` у публічному front-end (`js/error-tracking.js`, офіційний CDN, зафіксована версія)
- [x] ✅ `@sentry/nextjs@^10` у admin-app (`src/instrumentation.ts`, `src/instrumentation-client.ts`) — встановлено в `node_modules`+`package-lock.json`, `npm run build` пройдено
- [ ] ⚠️ Source maps upload при білді — `withSentryConfig` **налаштовано** у `admin-app/next.config.ts` (код на місці, `npm run build` компілюється чисто), але **НЕ перевірено фактичне завантаження**: потребує реального `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` і живого Sentry-акаунту, щоб підтвердити, що source maps реально долітають до Sentry, а не просто мовчки no-op через відсутній токен
- [x] ✅ User context після login (без PII у meta — тільки user.id) — публічний сайт: `Sentry.setUser({id})` на `SIGNED_IN`/`SIGNED_OUT`; admin-app: `src/components/SentryUserSync.tsx` (client-компонент у `(admin)/layout.tsx`, той самий патерн)
- [x] ✅ Filter expected errors (network, AbortController) — `ignoreErrors` на обох сторонах (`AbortError`, `Failed to fetch`, `Load failed`, `ResizeObserver loop`)
- [x] ✅ Breadcrumbs (кліки/навігація/URL) явно вимкнені на публічному сайті — правова підстава для "не за cookie-consent" (без цього Sentry збирав би поведінкові дані без згоди)
- [ ] **Alert rules:** >10 errors/5хв → email; new error type → email; webhook crashes → critical (налаштовується в Sentry dashboard, після акаунту)
- [ ] Щоденна перевірка зранку (звичка, не код)

### 🟢 Uptime monitoring

- [ ] **UptimeRobot** (безкоштовний, 5 хв) — достатньо для старту
- [ ] Моніторити: основний домен, `/api/health` endpoint, Supabase REST
- [ ] _Public status page → TIER 3_

### 🌱 Onboarding flow для нових юзерів

> Найдешевший спосіб підняти activation rate. Юзер у момент signup має максимальний інтерес — не втрачаємо його.

- [x] ✅ **Welcome screen** після signup (18.07.2026) — перший екран онбординг-оверлею (`onbValueView` в `js/onboarding.js`): 3 цінності (меню з КБЖУ / книга рецептів / список покупок) → "Почати" → нікнейм. Той самий прапор `welcome_intro_seen`, без нової міграції
- [x] ✅ **Goal setup wizard** — `js/onboarding-wizard.js`: 3 кроки (ціль → параметри тіла → активність), живий розрахунок норми через спільний health-core, збереження в `user_profiles`, skip-прапор `goal_wizard_skipped`
- [x] **Sample data seed — N/A, прибрано за рішенням власниці 07.08.2026.** Новий акаунт починає без прикладового сніданку; див. AUTH-14 у [QA-плані](qa-test-plan.md). Це закрите рішення про видалення функції
- [ ] **Empty states з CTA** (вже частково ✅) — аудит на всіх сторінках
- [x] ✅ **Progress checklist** у sidebar профілю (18.07.2026) — `initOnboardingChecklist()` в `profile.js`: Налаштувати ціль / Додати meal / Створити рецепт / Вода 5 днів (з лічильником N/5). Стан виводиться з реальних даних (нуль нових колонок); коли все виконано — блок зникає
- [x] ✅ **Activation milestones** (18.07.2026) — тост "Ти тримаєш серію {n} днів! 🌿" на 3/7/14/30/100 днів у `streak.js`; спрацьовує лише при рості серії в сесії (після логування їжі), без прапорів у localStorage. Бонус-фікс: картка streak тепер оновлюється одразу після додавання meal

### ✅ QA

- [ ] PostHog events приходять
- [ ] Sentry ловить штучну помилку
- [ ] Cookie reject → analytics не вантажиться
- [ ] Onboarding flow з нуля в incognito
- [ ] Sentry alerts тригеряться

---

## 🌐 ФАЗА 17: Інфраструктура BASIC (важливе для launch)

> Тут залишаємо **тільки те, без чого не запустимось**. Все інше (HSTS preload, A+ securityheaders, public status, trademark) → TIER 3.

### 🔗 Власний домен

- [ ] Перевірити доступність `mintofood.com` (+ `.app`, `.io`, `.co` як backup)
- [ ] Перевірити локальні зони (`mintofood.pl`, `mintofood.com.ua`)
- [ ] **Trademark search** через TMview (не реєстрація, а перевірка що ім'я вільне)
- [ ] **Купити домен** через **Cloudflare Registrar** (за собівартістю, без upsells, з DNS у комплекті)
- [ ] Privacy protection (WHOIS privacy) — обов'язково
- [ ] DNSSEC увімкнути
- [ ] Auto-renew на 2-3 роки наперед

### 🌍 DNS — Cloudflare

- [ ] Cloudflare DNS (free tier достатній)
- [ ] Increase TTL на стабільні записи (3600s+)
- [ ] ⚠️ **CSP-заголовки живуть у `vercel.json` — Cloudflare їх НЕ дублює автоматично.** Домен на Cloudflare — це лише DNS/proxy, самі security headers (HSTS/CSP/тощо) як і раніше віддає Vercel. Якщо колись CSP переїде на Cloudflare-рівень (Workers/Transform Rules) — звірити з `vercel.json`, щоб не розійшлись у два джерела правди

### 🏠 Subdomain — мінімум для launch

- [ ] `mintofood.com` — основний
- [ ] `www.mintofood.com` — redirect
- [ ] `mail.mintofood.com` — DKIM/SPF для transactional email
- [ ] _Інші subdomains (status, blog, help, admin) → TIER 2/3_

### 🔐 SSL / HTTPS

- [ ] Vercel автоматично видає Let's Encrypt — нічого не робити
- [ ] Cloudflare SSL mode = **Full (Strict)** (не Flexible!)
- [ ] ⚠️ **Частково — HSTS header** базовий (`max-age=63072000; includeSubDomains`) — прописано у `vercel.json` + admin `next.config.ts` (24.07.2026), але ще не задеплоєно; на живих Vercel URL поки лише платформний HSTS. Див. блок «Безпека — basic → Security headers»
- [ ] _HSTS preload submission → TIER 3_

### 📧 Email на власному домені

- [ ] Mailboxes: `support@`, `noreply@`, `dmca@`, `privacy@`/`dpo@`
- [ ] **Migadu** ($19/рік необмежено mailbox-ів) — старт
- [ ] Forwarding на твою особисту пошту (поки сама ведеш все)
- [ ] DNS: MX, SPF, DKIM, DMARC
- [ ] Перевірка mail-tester.com

### 💎 Hosting plans

- [ ] **Vercel Pro** ($20/міс) — обов'язково (Hobby забороняє commercial use)
- [ ] **Supabase Pro** ($25/міс) — обов'язково (daily backups + PITR; Free пауза)
- [ ] Cloudflare — free tier
- [ ] Резерв: ~$50-100/міс на інфраструктуру

### 🖼 CDN та оптимізація зображень

- [ ] Перейти на Supabase Storage для всіх юзерських зображень
- [ ] **Image optimization:** Cloudflare Images ($5/міс, 100K) АБО vercel/og
- [x] ✅ Lazy loading (вже зроблено)
- [ ] WebP/AVIF для сучасних браузерів
- [ ] Responsive images через `srcset`
- [ ] CDN caching headers на статичні асети

### 💾 Backup — basic

- [ ] Підтвердити фактичні daily backups / PITR у вибраному Supabase plan і дашборді; поточна конфігурація не перевірена
- [ ] Раз на квартал — перевіряти, що backup можна відновити (на staging)
- [ ] _Backblaze B2 + DR runbook → TIER 3_

### 🔒 Безпека — basic

- [ ] **2FA на ВСІХ критичних акаунтах:** Vercel, Supabase, Cloudflare, Domain registrar, обраний платіжний провайдер (Фаза 19), Resend, Sentry, GitHub
- [ ] Recovery codes зберегти в password manager
- [x] ✅ **Security headers** базові — реалізовано 24.07.2026 (`e8671f9`); public/admin headers підтверджено live у DEP-03/04/05 від 05.08.2026. Admin CSP у цей PASS не входить: його немає в `admin-app/next.config.ts` та `src/proxy.ts`
  - [ ] **Admin CSP:** конфігурація та runtime-перевірка лишаються відкритими; спосіб інтеграції потребує окремого погодження
  - [x] ✅ HSTS (`max-age=63072000; includeSubDomains`) — public + admin
  - [x] ✅ `X-Content-Type-Options: nosniff` — public + admin
  - [x] ✅ `X-Frame-Options: DENY` (+ `frame-ancestors 'none'` у public CSP) — public + admin
  - [x] ✅ `Referrer-Policy: strict-origin-when-cross-origin` — public + admin
  - [x] ✅ **Базовий CSP** (public сайт) — `script-src`/`connect-src`/`style-src`/`font-src` + `object-src 'none'`, `base-uri 'self'`, `upgrade-insecure-requests`. `form-action` дозволяє `'self'` і точний admin-origin (DEP-09a, live 09.08.2026). `connect-src` включає `wss://*.supabase.co` (Realtime). `img-src https:` — свідомо широкий для URL фото й аватарок; повне чинне значення — `vercel.json`
  - [x] ✅ **`script-src` БЕЗ `'unsafe-inline'`** (24.07.2026) — виконано вимогу roadmap. Рефакторинг: inline anti-FOUC theme-скрипт → спільний `js/theme-init.js` (синхронно в `<head>`, без FOUC); inline module scripts (cookies/404) → `js/cookies-page.js`, `js/not-found-page.js`; `onclick` у `500.html` → `js/error-page.js`; inline `onsubmit` у 4 auth-формах прибрано (дублювали наявний `addEventListener('submit')`+preventDefault); inline-handlери з JS-шаблонів (`product-guide.js` onerror → `.onerror=`, `recipe-modal.js` upload onclick → `addEventListener`, `profile.js` delete onclick → делегування на контейнер). `style-src` свідомо лишає `'unsafe-inline'` (сайт активно юзає inline/dynamic styles; roadmap вимагав прибрати саме для скриптів)
    - [x] ✅ `js/theme-init.js` та інжектовані `offline-indicator`/`back-to-top` підключено АБСОЛЮТНИМИ шляхами (`/js/…`) — інакше на rewrite-маршруті `/recipe/:slug` відносний `js/…` резолвиться у `/recipe/js/…` (404) і anti-FOUC/скрипти мовчки не працюють. `build.js` теж інжектить абсолютно + dedup за іменем файла
    - [x] ✅ `theme-init.js` знімає `no-transition` після першого рендеру (double rAF) — інакше колірні transitions лишались би вимкненими назавжди (регресія на profile/cookbook/recipes/shopping-list, які раніше цей клас не отримували; раніше знімав лише `recipe-page.js`)
    - [x] ✅ Повторюваний тест `scripts/csp-theme-check.mjs` (headless Chrome + CSP-заголовок з vercel.json; rewrite-маршрути емулюються з конфігу, не хардкод): на 10 сторінках, включно з `/recipe/test-slug` — **0 CSP violations**; три глобальні виправлені скрипти (theme-init/offline-indicator/back-to-top) не дають 404 на маршруті рецепта; `data-theme=dark` присутнє після завантаження (правильний anti-FOUC порядок гарантує синхронний `theme-init.js` у `<head>` перед CSS — тест не фіксує буквально перший paint); `no-transition` знято після завантаження — усе PASS. Плюс 0 inline `<script>`/handler-атрибутів (grep-sweep); функціональні DOM-тести auth-submit / activity-delete-делегування / recipe-upload / product-onerror — PASS
    - [ ] ⚠️ Повний ручний регрес на релізному деплої: login/register/reset, 500 retry, 404 random recipe, cookies reopen, recipe image picker, profile activity delete, product image fallback, shopping-list realtime. Часткові результати вже є в AUTH/DEP/UI-журналі; локальне завантаження продуктів підтверджено 08.09.2026
- [ ] **Rate limiting — частково реалізовано на відповідних рівнях**. **Аудит (29.07.2026): Login/Signup/Recipe reports НЕ проходять через наш Vercel-домен**, тому Vercel Middleware їх не бачить:
  - [ ] ~~Login (5/хв) / Signup (3/хв з IP)~~ → `supabase.auth.signInWithPassword`/`signUp` ідуть напряму з браузера в Supabase Auth, не через наш домен. Лімітується в Supabase Dashboard → Auth → Rate Limits, АЛЕ два окремі числа "5/хв login" і "3/хв signup" там неможливо виставити буквально: sign-in і sign-up діляться одним per-IP bucket на 5-хвилинне вікно (Supabase docs, `sign_in_sign_ups`). Перевірити фактичні ліміти в дашборді перед launch, а не покладатись на цифри з цього roadmap
  - [ ] Webhook endpoints → ще не існують (з'являться у Фазі 19, лімітувати разом з ними)
  - [ ] AI scan (за тарифом) → ще не реалізовано (TIER 3, Фаза 36)
  - [x] ✅ **Recipe creation (10/хв на користувача, 29.07.2026)** — єдиний пункт, що реально йде через наш `/api/*`. `check_rate_limit` RPC (advisory-lock, той самий патерн що `reserve_moderation_slot` Фази 18) підключено в `api/save-recipe.js`, лімітує лише `editingRecipeId===null` (створення, не редагування). Рахує СПРОБИ створення (виклик до серверної валідації), не лише успішно збережені рецепти — свідомо: типова anti-spam поведінка. Fail-open на DB-помилку. Toast `rmRateLimited` у 3 мовах. Мок-тест 30/30 (`npm run test:save-recipe`) — доводить лише поведінку handler, НЕ живу RPC
    - [x] ✅ **GDPR-очищення (29.07.2026):** `api_rate_limits.user_id` → `REFERENCES auth.users ON DELETE CASCADE` + явний DELETE в `hard_delete_user_data()` v3 (`20260729_1100`, покриває заразом і пропущений раніше `recipe_ratings`). Глобальний cleanup `cleanup_api_rate_limits()` (не per-user-on-hit — той підхід лишав рядки неактивних юзерів назавжди) — **не підключений до крону**, викликати вручну або додати в `vercel.json` crons поруч з `gdpr-hard-delete`
    - [x] ✅ Міграції `20260729_1000` + `20260729_1100` застосовано в Supabase (підтверджено 30.07.2026: `api_rate_limits` існує, `hard_delete_user_data` v3 містить CASCADE на неї)
    - [ ] ⚠️ Живий integration smoke-test лишається: викликати `check_rate_limit` RPC напряму (не мок), перевірити GRANT на `service_role`, прогнати паралельний burst і підтвердити, що advisory-lock реально серіалізує. Мок-тест цього не доводить
  - [ ] Recipe reports (5/год на користувача) → `supabase.from('recipe_reports').insert()` пишеться напряму з клієнта під RLS, тому конкретно Vercel Middleware тут не варіант. Два шляхи (не зроблено, окрема задача): (а) новий серверний endpoint `/api/report-recipe` + міграція, що забороняє прямий client-side insert — якщо ліміт обов'язково має йти через Vercel; (б) або лишити insert клієнтським і зробити ліміт атомарним у SQL — RLS/тригер/RPC на кшталт `check_rate_limit`, що рахує рядки `recipe_reports` цього юзера за вікно і відхиляє insert понад ліміт. (б) простіше і не потребує нового API-файлу
- [ ] ⚠️ **Частково — Secret management**: аудит `.gitignore` (24.07.2026)
  - [x] ✅ `.env`/`*.env`/`.env.*` ігноруються (додано `.env.*` + `!.env.example`), 0 `.env` у git/history
  - [x] ✅ 0 `service_role`/SERVICE_ROLE_KEY у клієнтському коді (лише `process.env` у server API)
  - [ ] Перевірити й за потреби розділити preview/production env у Vercel dashboard; актуальний стан дашборда не підтверджено цією звіркою
- [x] ✅ Виконані RLS-01…10 (08–10.08.2026) та перевірка відсутності service-role у клієнті DEP-08 (08.08.2026); [докази й межі покриття](qa-test-plan.md)
- [ ] Перевірити нові таблиці/операції та grants на deployment, що піде в soft launch; нові `recipe_sources`/Storage мають окремий [release-check](saved-recipes-release.md)

### 🌳 Environment management

> Погоджений план середовищ за [QA-планом](qa-test-plan.md): нинішнє середовище — **pre-production**; перед soft launch створюється новий чистий production, а поточне стає staging. Назва Vercel target `Production` в історичних звітах не означає, що цей перехід уже виконано. Стан дашбордів і перенесення не підтверджено звіркою 27.09.2026.

- [ ] **Production:** `mintofood.com` (main branch, prod Supabase)
- [ ] **Staging:** `staging.mintofood.com` (staging branch, окремий Supabase project)
- [ ] Preview deployments — автоматично для PR
- [ ] Environment vars окремі для кожного середовища
- [ ] Seed-скрипт для staging БД

### 🚀 CI/CD

- [x] ✅ Vercel deploy з git push використовувався — зафіксовано у Фазі 17 для `e8671f9`; успішні deployment є в DEP-журналі. Це не підтверджує deploy останніх локальних змін
- [ ] **Branch protection** на GitHub: main вимагає PR review (від себе самої — заради дисципліни)
- [ ] Lint + format на pre-commit (Husky + Prettier)
- [ ] Уточнити workspace root адмінки: build від 08.09.2026 успішний, але попереджає про inferred workspace root; явні `turbopack.root` / `outputFileTracingRoot` у поточному конфігу відсутні. [QA-звіт](qa/phase22-2026-09-08/report.md)
- [ ] Rollback одним кліком через Vercel

### 📊 Performance моніторинг

- [ ] Vercel Analytics (платний tier — Web Vitals)
- [ ] Supabase: slow query alerts (>1s), CPU monitoring
- [ ] _Lighthouse CI, bundle size monitoring → TIER 2_

### ✅ QA

- [ ] Домен резолвиться, HTTPS, без console warnings
- [ ] Email з `support@` приходить
- [ ] SPF/DKIM/DMARC валідні через mxtoolbox.com
- [ ] securityheaders.com показує хоча б **A** (не обов'язково A+)
- [ ] Rollback працює
- [ ] 2FA на всіх акаунтах

---

## 🖼 ФАЗА 18: Image moderation (НОВА) — ✅ ядро зроблено (24.07.2026)

> UGC платформа без image moderation = NSFW спам у перший тиждень. Це не "after traction".
> **Статус:** провайдер-агностичний пайплайн реалізовано; виправлення описані нижче. Live RLS-07/08 за 08.08.2026 вже перевіряли moderation fields/log/RPC. Повноту схеми й grants звірити за PRE-03…05; не повторювати міграцію лише через старий незакритий текст. Конфігурація реального provider та ручний IMG/FLOW/MOD E2E на релізному deployment залишаються непідтвердженими.
> **Архітектура (v2):** запис рецепта + модерація — **разом на сервері** (`/api/save-recipe`), в одному кроці. Скоринг оцінює САМЕ те фото, що записується → клієнт не може підмінити фото між скорингом і записом. service_role пише moderation-колонки; DB-тригер стирає їх з будь-якого клієнтського запису (виняток — service_role і admin). Оскільки сервер обходить RLS, endpoint сам форсує `user_id=JWT` і перевіряє власника при edit.

- [ ] **Cloudflare Images** має built-in moderation (легко вмикається при upload)
- [ ] АБО **Sightengine** API ($29/міс за 5K зображень) — більший контроль
- [ ] АБО **Hive Moderation** — найкраща точність, але дорожче

  > _Адаптер Sightengine (nudity-2.1) уже написаний у `api/save-recipe.js`. Провайдер вмикається `SIGHTENGINE_USER`+`SIGHTENGINE_SECRET` у Vercel env — БЕЗ змін коду. Без ключів працює `stub` (score 0, пропускає), тож потік живий уже зараз. Cloudflare/Hive → нова гілка в `pickProvider()`._

- [x] ✅ **Інтеграція:**
  - [x] ✅ Збереження рецепта йде через `/api/save-recipe`; нове фото (файл або змінений URL) модерується там-таки перед записом
  - [x] ✅ NSFW score ≥ 0.8 (`IMAGE_NSFW_THRESHOLD`) → `is_image_flagged=true` + `image_nsfw_score`. Публічний flagged → `pending` (у черзі); приватний flagged лишається `draft` (не витікає — публічні листинги фільтрують `status='published'`), позначений для аудиту
  - [x] ✅ Тег "auto-flagged" у черзі — бейдж `🔞 Фото auto-flagged NN%` (`autoFlag.ts` тип `nsfw_image`); черга тягне `status='pending' OR is_image_flagged=true`
- [x] ✅ Auto-flagging (Фаза 10.6) для зображень — той самий `detectFlags()`
- [x] ✅ Логування для audit — `image_moderation_log`; override через `override_image_flag()` + `clearImageFlag`

**Критичні виправлення після аудиту (25.07.2026):**

- [x] ✅ **#1 Підміну фото усунено** — модерація і запис нерозривні на сервері (`/api/save-recipe` оцінює фото з того самого payload, що записує). Прибрано окремий `/api/moderate-image`, який довіряв парі (клієнтське фото + recipe_id)
- [x] ✅ **#2 Приватний рецепт не публікується** — `approveRecipe` тепер відмовляє, якщо `is_public=false` (публікація приватного = витік). Для приватного flagged у UI ховається «Схвалити», натомість «✓ Зняти флаг фото» / «✕ Відхилити фото» (`rejectImage` прибирає фото, лишає рецепт приватним)
- [x] ✅ **#3 override реально спрацьовує** — trigger-guard тепер пропускає не лише service_role, а й admin (`is_admin`); `override_image_flag`/`approveRecipe`/`rejectRecipe` (admin JWT) справді пишуть moderation-колонки
- [x] ✅ **pending_updates розсинхрон** — при edit опублікованого нове фото йде в `recipe_pending_updates`; сервер модерує саме staged-фото і паркує весь update у чергу, якщо воно flagged (адмін бачить те фото, що модерувалось)
- [x] ✅ **approve/reject знімають image-флаг** — інакше рецепт лишався б у черзі назавжди
- [x] ✅ **regex data URI** — `data:image/png;base64,!!!!` та надто короткі payload тепер відхиляються (не шлемо провайдеру)
- [x] ✅ **Rate limiting** — ≥20 provider-викликів/год на юзера (`IMAGE_MOD_RATE_PER_HOUR`) → фото не шлемо провайдеру, рецепт іде в чергу на ручну модерацію (квота захищена, спам ловить людина)
- [x] ✅ **`>=` vs `>`** — свідомо `>=` (суворіше: рівно 0.8 → у чергу); задокументовано
- [x] ✅ **Explicit grant** `service_role` на `image_moderation_log`

**Другий аудит виправлено (26.07.2026) — блокери, що runtime виявив би одразу:**

- [x] ✅ **Модерація мовчки падала** — `NSFW_THRESHOLD` був випадково видалений (ReferenceError ловився в catch → усе проходило як `flagged:false`). Повернено. Причина пропуску: не ганяв ESLint `no-undef` на `api/` і не було runtime-тесту. Обидва додано
- [x] ✅ **Клієнтський `imageIsNew` більше не довіряється** — СЕРВЕР визначає, чи фото нове (create з фото → нове; edit → порівняння з `original.image`). Закрито обхід `imageIsNew:false` для нового фото
- [x] ✅ **status при edit** — сервер перераховує status завжди: create/draft-edit public→pending/private→draft; published→private знімає з ефіру (`status='draft'`). Раніше status при edit не оновлювався (перемикання public/private ламалось, published міг лишитись видимим)
- [x] ✅ **invalid фото → 400**, не зберігається (раніше `provider:'invalid'` + `flagged:false` і зберігалось)
- [x] ✅ **Атомарність published-edit** — усе (direct PATCH + staged INSERT + flag) в одній транзакції через RPC `stage_recipe_update` (раніше 3 окремі REST — часткова невдача лишала пів-оновлення)
- [x] ✅ **Атомарний rate limit** — RPC `reserve_moderation_slot` з `pg_advisory_xact_lock` серіалізує check+reserve per-user (раніше count-then-call мав гонку; бурст обходив ліміт)
- [x] ✅ **staged-фото в адмінці** — черга показує `recipe_pending_updates.changes.image` (бейдж «staged»); `approveRecipe` переносить staged→live; `rejectImage` чистить staged (не видаляє живе фото)
- [x] ✅ **Тип `recipes.id` = integer** (не uuid) — виправлено FK/RPC-параметри/rollback (див. [[project_dead_recipe_columns]] контекст типів)
- [x] ✅ **Runtime-тест** `scripts/save-recipe-check.mjs` — мокає fetch (Supabase+provider), ганяє гілки handler.

**Третій аудит виправлено (26.07.2026) — блокери, що мок-тест маскував:**

- [x] ✅ **GRANT EXECUTE service_role** на 3 нові RPC (`stage_recipe_update`, `reserve_moderation_slot`, `finalize_moderation_slot`) — після `REVOKE ALL` вони були недоступні service_role → published-edit падав би permission-denied, а rate-limit RPC мовчки провалювався (handler ішов fail-open → провайдер БЕЗ ліміту). SECURITY DEFINER не рятує: EXECUTE перевіряється для ролі, що викликає
- [x] ✅ **Clean staged-оновлення потрапляють у чергу** — черга тепер `status=pending OR is_image_flagged OR has_pending_update`. Раніше безпечне нове фото / edited name/steps на published рецепті лишались у БД, але адмін їх не бачив (черга ігнорувала `has_pending_update`)
- [x] ✅ **not-an-image відхиляється** — звичайний рядок (не data-URI, не URL) тепер `invalid`→400, не зберігається (раніше `provider:'none'`, flagged:false, зберігалось)
- [x] ✅ **approveRecipe/rejectImage error-перевірки** — усі читання/delete/update `recipe_pending_updates` перевіряються; після застосування/видалення staged коректно перераховується `has_pending_update`
- [x] ✅ **Тест посилено (22/22)** — додано: RPC-відмова (fail-open спостережуваний), not-an-image БЕЗ запису рецепта, invalid БЕЗ запису, published-edit викликає stage RPC. Мок тепер програмований на помилки (раніше RPC безумовно успішні — маскували блокери)
- [x] ✅ **Скрипти в package.json** — `npm run test:save-recipe` + `npm run lint:api` (`scripts/lint-api.cjs`, no-undef на всіх `api/*.js`) — тепер справді «в процесі»

**Файли:** `supabase/migrations/20260724_1000_image_moderation.sql` (+rollback), `api/save-recipe.js`, `scripts/{save-recipe-check.mjs,lint-api.cjs}`, `package.json`, `js/recipe-modal.js`, `js/i18n.js`, `admin-app`: `lib/autoFlag.ts`, `components/moderation/AutoFlagBadges.tsx`, `app/(admin)/moderation/{page,ModerationClient}.tsx`, `app/actions/moderation.ts`.

**Четвертий аудит виправлено (26.07.2026) — повний staged-workflow:**

> Продуктове рішення: «Схвалити» застосовує ВСІ staged-поля (фото+назва+кроки); «Відхилити» відкидає ЛИШЕ staged (опублікований рецепт лишається — автора не карають).

- [x] ✅ **Admin-flow тепер атомарний** — 2 транзакційні RPC: `apply_pending_update` (мержить усі staged-поля oldest→newest у live, чистить pending, published, знімає флаги — одна транзакція) і `discard_pending_update` (видаляє pending, знімає флаг). `approveRecipe`/`rejectRecipe` — тонкі обгортки: якщо `has_pending_update` → відповідний RPC, інакше звичайна публікація/reject. Раніше admin-flow був послідовністю REST — часткова невдача лишала пів-стану
- [x] ✅ **Text-only staged застосовуються/відхиляються** — `apply_pending_update` мержить name/steps теж (не лише фото); `discard` відкидає весь staged. Раніше approve шукав лише `changes.image` → text-only лишався з `has_pending_update=true` назавжди
- [x] ✅ **rejectRecipe для staged** — тепер `discard_pending_update` (не переводив весь рецепт у rejected, лишаючи pending). `rejectImage` спрощено до live-flagged (staged закриває rejectRecipe)
- [x] ✅ **has_pending_update без гонки** — рахується в транзакції БД (RPC), не зі старого JS-`pendingRows.length`
- [x] ✅ **Тест 24/24** — негативні кейси: stage RPC→500, finalize→200 (best-effort)

**П'ятий аудит виправлено (26.07.2026) — concurrency + чесність тесту:**

- [x] ✅ **Concurrency lost-update** — `apply_pending_update`/`discard_pending_update` тепер БЛОКУЮТЬ `recipes` row `FOR UPDATE` **першою дією** (той самий lock-order, що `stage_recipe_update`) + видаляють лише **snapshot** id прочитаних pending. Раніше різний порядок блокувань → паралельний edit міг втратити зміни (apply видаляв незастосований новий pending; discard лишав його з `has_pending_update=false`)
- [x] ✅ **Edge published→private+staged** — `apply_pending_update` ставить status ЗА `is_public` (`CASE WHEN is_public THEN 'published' ELSE 'draft'`), не сліпо published. `approveRecipe` private-guard тепер лише для non-staged (нова публікація); staged застосовується через RPC, який приватний рецепт не публікує
- [x] ✅ **Edge discard score/time** — `discard_pending_update` тепер обнуляє `image_nsfw_score`+`image_moderated_at` (описували відхилене staged-фото; live-фото лишилось старим)
- [x] ⚠️ **ЧЕСНО про тест:** заяву «видалення GRANT зламає тест» ВІДКЛИКАНО — вона хибна. Тест мокає fetch (`stageFails`→403 за командою), НЕ читає SQL і НЕ виконує Postgres. Тест доводить лише: handler на 403 повертає 500; finalize best-effort. Grants на `apply_pending_update`/`discard_pending_update` статично правильні, але тестом НЕ захищені — перевірка grant можлива лише на живій БД (E2E)

**Хвіст (закрити перед launch):**

- [ ] **Перевірити живий тип** `recipe_pending_updates.recipe_id` (історичний `admin_migration.sql` каже uuid, але запит 25.07 показав integer — підтвердити перед застосуванням; RPC розрахований на integer). SQL: `SELECT column_name,data_type FROM information_schema.columns WHERE table_name='recipe_pending_updates'`
- [x] ✅ Міграцію `20260724_1000_image_moderation.sql` застосовано в Supabase (підтверджено 30.07.2026: `image_moderation_log` існує на живій БД)
- [ ] Зареєструвати акаунт провайдера + env-ключі у Vercel (до цього moderation = stub)
- [ ] Ручний E2E на живій БД: RPC-транзакції, advisory-lock rate limit, staged-flow в реальній адмінці (мок-тест БД не покриває)
- [ ] Rescan наявних фото після підключення провайдера (модеруються лише НОВІ)
- [ ] Відомий борг (передіснуючий): staged name/steps з `recipe_pending_updates` застосовуються лише частково (approve застосовує staged **фото**; загального apply-механізму для name/steps у проєкті нема)

---

## 💳 ФАЗА 19: Монетизація — переосмислена

> **Зміни після аудиту:**
>
> 1. Paywall — НЕ "10 рецептів max", а **AI/intelligence/time-saving фічі**. Storage limits — слабкий продаж.
> 2. Перевірити висновки з Фази 11 (customer interviews) перед фіналізацією.
> 3. Free має бути **повністю usable** (як Spotify Free), Premium = надбудова.

### 🤔 Перед стартом — рішення про провайдера

> Вибір провайдера в репозиторії не зафіксовано. LemonSqueezy нижче — рекомендація, Stripe/Paddle — варіанти. Назви provider-specific файлів далі є чернеткою до рішення, а не реалізованою інтеграцією.

- [ ] **Вибрати:** Stripe vs Paddle/LemonSqueezy (MoR)
- [ ] **Рекомендація з memory:** LemonSqueezy для solo founder у Польщі — вони беруть VAT MOSS на себе
- [ ] Реєстрація + KYC
- [ ] Business profile, brand, support email, return policy URL
- [ ] Pricing decision: монт + рік (-30-40%)
- [ ] Валюти: одна (USD?) чи мульти (PLN, EUR, USD, UAH)

### 🔐 Paywall — переосмислений

> ⚡ **Принцип:** Premium продає **AI / intelligence / автоматизацію**, а не "більше".

**Free (повністю usable):**

- [ ] Безмежно власних рецептів (не 10!)
- [ ] Ручне внесення прийомів їжі
- [ ] Меню на день / тиждень
- [ ] Список покупок
- [ ] Книга рецептів (до 3-х книг — soft limit, перевірити в інтерв'ю)
- [ ] Базовий путівник по продуктах
- [ ] 30 днів історії КБЖУ
- [ ] Базові графіки

**Premium (AI + intelligence):**

- [ ] 🤖 **AI scan рецептів зі скріншотів** (TikTok, Instagram) — 50 сканів/міс
- [ ] 🤖 **AI weekly meal planning** — згенерувати тиждень за 15 сек з твоїх цілей
- [ ] 🤖 **AI grocery optimization** — мінімізувати кількість унікальних продуктів на тиждень
- [ ] 📊 **Розширена аналітика** — безмежна історія, advanced графіки, тренди
- [ ] 🎯 **Smart macro balancing** — авто-підбір страв під залишок макро
- [ ] 📤 **Експорт даних** (PDF, CSV)
- [ ] 👨‍👩‍👧 Family sharing (опційно)
- [ ] 🌟 Priority email support

> _Цей розподіл — draft. Фіналізувати після Фази 11 customer interviews._

### 🗄 Інфраструктура БД

- [ ] Колонки в `profiles`: `subscription_status`, `subscription_id`, `customer_id`, `trial_ends_at`, `current_period_end`, `cancel_at_period_end`, `plan`
- [ ] Таблиця `subscription_events` для idempotency
- [ ] Таблиця `payment_history`
- [ ] RLS: юзер бачить тільки свої події

### 🛒 Провайдер: продукти та ціни

- [ ] Product "MintoFood Premium"
- [ ] Price Monthly з `trial_period_days=3`
- [ ] Price Yearly з тим же тріалом
- [ ] Tax behavior: inclusive чи exclusive
- [ ] Customer Portal (для self-service)

### 🔌 Webhook handler

- [ ] `/api/webhooks/stripe.js` (або lemonsqueezy.js)
- [ ] **Signature verification** — обов'язково
- [ ] **Idempotency** через `subscription_events.event_id`
- [ ] Обробка подій:
  - [ ] checkout completed → trialing
  - [ ] subscription updated → status/period
  - [ ] subscription deleted → canceled → free
  - [ ] invoice paid → продовжити, додати в history
  - [ ] invoice failed → past_due, email
- [ ] Logging
- [ ] Webhook secret у Vercel env

### 🚪 Checkout flow

- [ ] Кнопка "Спробувати безкоштовно" → `/api/create-checkout-session`
- [ ] Vercel function створює Checkout Session
- [ ] Redirect → hosted checkout
- [ ] Success → `/welcome?trial=started`
- [ ] Прив'язка через `auth.uid()` + metadata

### 🧱 JS / Helpers

- [ ] `js/subscription.js` — current status з кешем
- [ ] `js/paywall.js` — `requirePremium(featureName)` → upgrade modal
- [ ] `js/stripe-checkout.js` — wrapper
- [ ] Усі premium-фічі обернути в `requirePremium()`

### 🎨 UI

- [ ] **Pricing page** `/pricing.html` (3 мови, валюти за геолокацією)
  - [ ] Monthly / Yearly toggle з показом економії
  - [ ] Free vs Premium comparison
  - [ ] FAQ (тріал, скасування, refund)
  - [ ] Соціальні докази (як буде кого процитувати — testimonials)
- [ ] **Upgrade модалка** — contextual (пояснює чому ЦЯ фіча Premium)
- [ ] **Account → Підписка:** план, статус, наступне списання, "Управляти" → Customer Portal, історія платежів
- [ ] **Banner "Trial ends in N days"** (останні 2 дні)
- [ ] **Banner "Payment failed"** з кнопкою → Portal
- [ ] **Banner "Cancellation scheduled"** з можливістю reactivate

### 💸 Tax/VAT

- [ ] Якщо Stripe → Stripe Tax АБО VAT MOSS ручний
- [ ] Якщо обрано Paddle/LemonSqueezy → перевірити покриття податків і розподіл обов'язків за умовами конкретного провайдера; рішення й перевірка не завершені
- [ ] Польський бухгалтер для JDG/spółki
- [ ] Зберігати VAT-receipts

### 🔄 Refunds & disputes

- [ ] Refund policy (зазвичай 7 днів no-questions)
- [ ] На pricing page + ToS
- [ ] Chargebacks через dashboard

### 🧪 Тестування

- [ ] Test mode + test cards
- [ ] 3DS challenge
- [ ] Failed payment
- [ ] Webhook idempotency (повторна подія — не дублюється)
- [ ] Повний flow: signup → trial → first payment → cancel → free
- [ ] Paywall на всіх premium-фічах
- [ ] Banner "trial ending"

### 📊 Metrics

- [ ] Trial-to-paid conversion (KPI #1)
- [ ] Monthly churn
- [ ] LTV
- [ ] MRR
- [ ] Failed payment rate
- [ ] Reactivation rate

---

## 🦶 ФАЗА 20: Футер + глобальні UI

> Базовий футер уже реалізований у Фазі 10.8; нижче відмічені його наявні частини. Відкриті пункти описують розширення або QA, а не потребу створити футер заново. Реальний склад посилань — `partials/footer.html`; залежні інтеграції не вважаються готовими.

### 📋 Структура футера

Класичний 4-колонковий layout, акордеон на мобайлі.

**Продукт:** Логотип + tagline / Меню на день / Меню на тиждень / Рецепти / Путівник / Книга рецептів
**Компанія:** Про нас / Pricing / _(Блог, Press, Affiliate → TIER 2/3)_
**Підтримка:** Help/FAQ / Contact (`mailto:support@`) / Feedback / _(Status → TIER 3)_
**Юридичне:** Privacy / Terms / Cookies / Imprint / DMCA / GDPR data export

### 🔻 Нижня лінійка

- [x] © 2026 MintoFood — `partials/footer.html`
- [ ] Made with 🌿 + Made in Poland & Ukraine
- [ ] Версія / build hash (для дебагу)
- [ ] Компанія / NIP (EU compliance)

### 📱 Соцмережі + Локалізація + Тема

- [ ] Іконки IG / TikTok / YouTube / Pinterest
- [ ] `target="_blank"` + `rel="noopener noreferrer"`
- [x] Перемикач мови UA/EN/PL у футері — `partials/footer.html`; runtime-покриття — UI-05
- [ ] (Опційно) перемикач теми

### 📨 Newsletter signup

- [ ] Email input + кнопка
- [ ] `newsletter_subscribers` таблиця
- [ ] Інтеграція з Resend
- [ ] Double opt-in (compliance)

### 📐 Версти

- [x] Desktop: 4 колонки + bottom row — `scss/layout/_footer.scss`
- [x] Tablet: 2x2 — breakpoint 1024px
- [x] Mobile: акордеон — `partials/footer.html`; взаємодію перевірено 08.09.2026
- [ ] Звірити стару вимогу «padding 60–80px, var(--color-bg-secondary)» із чинним дизайном: код має padding `20px 24px 16px` / `16px 20px 0`, gradient і border-top. Автоматично під старий опис не змінювати; рішення про дизайн лишається відкритим
- [x] Локальний гостьовий тест світлої + темної теми — 08.09.2026; повні UI-05/06 і реальні пристрої лишаються відкритими

### 🎯 Розмістити

- [x] На public/legal сторінках включно з `recipe.html` для `/recipe/{slug}` — спільний partial та `build.js`, матриця QA 08.09.2026
- [x] Public-футер не вбудований у `admin-app`, login modal чи onboarding overlay

---

## 🌐 ФАЗА 21: Глобальні UI елементи

- [x] ✅ **404 page** (18.07.2026) — `404.html`, з випадковим рецептом як CTA; Vercel сервить автоматично для неіснуючих шляхів (log у Sentry — після Фази 16)
- [x] ✅ **500 / error page** (18.07.2026) — `500.html` з "Спробувати ще раз" (reference ID — після Sentry, Фаза 16)
- [x] ✅ **Maintenance page** (18.07.2026) — `maintenance.html`, інструкція увімкнення rewrite у коментарі файлу
- [x] ✅ **Offline indicator** + recovery banner (18.07.2026) — `js/offline-indicator.js`, авто-інжект build.js на всі сторінки
- [x] ✅ **Login required** soft-prompts — requireAuth() відкриває модалку (вже було)
- [x] ✅ Skeleton loaders (вже)
- [x] ✅ Loading spinners для дій (18.07.2026) — `setButtonLoading()`/`withButtonLoading()` в `utils.js` + `.btn-spinner` у `_global-ui.scss`; підключено: auth (4 форми), profile (нікнейм/GDPR export/видалення акаунта), збереження рецепта (recipe-modal), корекція назви скан-продукту (meals), onboarding-wizard, нотатки рецепта (add-recipe)
- [x] ✅ Progress bar для довгих дій (18.07.2026) — глобальна смуга `startProgress()`/`setProgress()`/`doneProgress()` в `utils.js` (indeterminate + determinate, prefers-reduced-motion); використано в GDPR-експорті
- [x] ✅ Toast система (`utils.js`)
- [x] ✅ Аудит — всі дії дають feedback (18.07.2026) — пройдено всі async-дії з `disabled`-only станом, скрізь додано спінер; збереження нотаток отримало error-toast (раніше мовчало при помилці)
- [x] ✅ Favicon усі розміри + apple-touch-icon (18.07.2026) — стиль "скло + пульс-М" за референсом; генератор `scripts/gen-icons.mjs`; head-теги інжектить build.js
- [x] ✅ Manifest.json (18.07.2026) — `/manifest.json` (name/short_name, standalone, theme `#4ab584`, icons 192/512 + maskable); `<link rel="manifest">` + `<meta name="theme-color">` інжектить build.js на всі сторінки. PWA-решта (SW, Lighthouse) — TIER 2, Фаза 26
- [x] ✅ OpenGraph default image 1200x630 (18.07.2026) — `img/og-default.png`, той самий стиль; og:image інжектиться на сторінки без власного (абсолютний URL оновити після Фази 17)
- [x] ✅ Smooth scroll + "Back to top" (18.07.2026) — `js/back-to-top.js`, авто-інжект build.js
- [ ] Safari (iOS + macOS) тестування
- [ ] Banner для дуже старих браузерів

---

## 🧪 ФАЗА 22: Pre-launch QA

- [x] ✅ **Локальна автоматизована візуальна QA (18.07.2026)** — headless Chrome (playwright-core + системний Chrome): 17 сторінок × 2 теми × 2 в'юпорти (1440×900, 390×844). Результат: 0 горизонтальних overflow, 0 помилок консолі (після фіксу нижче), футер притиснутий на всіх сторінках/в'юпортах, теми застосовуються коректно. Вибірковий візуальний огляд скриншотів: index/recipes/product-guide/profile у обох темах — чисто
  - [x] ✅ Знайдено й виправлено: `img/placeholder.jpg` не існував (404 на кожному завантаженні product-guide + битий onerror-фолбек карток) — згенеровано з затвердженого icon-512 (градієнт бренду + іконка по центру), у стилі "скло+пульс-М"
  - [x] ✅ Виправлено локально 08.09.2026: profile.html без логіну більше не рендерить секції табів стосом. CSS `[data-profile-section][hidden]` відновлює приховування до auth/initProfileTabs; 12 комбінацій теми/ширини пройшли. Після deployment потрібен live-регрес.
  - Історична примітка 18.07: у тому прогоні рецепти/продукти не завантажились. Її не використовувати як поточний висновок про доступність даних; новіші результати наведено нижче
- [x] ✅ **Повторний локальний гостьовий QA (08.09.2026)** — 17 сторінок × 2 теми × 6 ширин, 204/204 початкових станів пройшли перевірки геометрії, теми, ресурсів і консолі. 68 наявних тестів, обидві збірки та lint пройшли; CSP/theme smoke — 10/10. Виправлено підсвічування активного пункту хедера. [Звіт і докази](qa/phase22-2026-09-08/report.md). Це не закриває авторизовані workflow та реальні пристрої.
  - [x] ✅ **Путівник із даними:** після завантаження `products` пошук `яблу` дав 5 карток; відкриття/закриття модалки — PASS у двох темах на desktop/mobile. Відсутні фото лишаються QA22-02
  - [ ] Авторизовані завантаження та зміни рецептів/книг/меню на релізному deployment — REC/BOOK/DAY/FLOW; старі й часткові PASS не закривають весь сценарій
  - [x] ✅ **QA22-01 — FIXED LOCAL, підсценарій focus/Esc:** [локальний JSON від 22.09](qa-test-plan.md#qa22-local-20260922), перевірений 27.09, підтверджує `authFocusInside`/`authEscape=true` у 8/8 кейсах. Виправлення є в `js/auth.js`; Tab/Shift+Tab, повернення фокусу й вкладені модалки не покриті цими двома assertions. Повний UI-09 та live-регрес лишаються відкритими
  - [ ] **QA22-02:** три фото продуктів відсутні у Storage (`Object not found`); пошук і модалка працюють, відновлення фото/посилань потребує рішення щодо даних.
  - [x] ✅ **QA22-03 — FIXED LOCAL:** `.rp-404` використовує `%glass-surface` (`scss/pages/_recipe.scss`). [Перегляд чотирьох локальних скриншотів 22.09](qa-test-plan.md#qa22-local-20260922) переглянуті 27.09: текст має власну поверхню в обох темах на desktop/mobile. WCAG contrast score не виміряний; deployment цими артефактами не підтверджений
  - [x] ✅ **Повтор початкової гостьової матриці 22.09:** 68 cases, 0 failed/blocked у [локальному JSON](qa-test-plan.md#qa22-local-20260922). Це окремий локальний прогін; Git commit у звіті не зафіксований
- [ ] **BOOK-06 / BOOK-07 — PARTIAL (перегляд 14.09.2026):** попередні 18/18 і 13/13 стосуються спрощеної CSS-модалки та штучного DOM/regex. Повний регрес реальної модалки, вибору обкладинки, body lock, logout, пізніх відповідей і зміни акаунта залишається відкритим; повторний браузерний результат не отримано. Залишок чотирьох фіксів включає BOOK-06/07 разом з ADM-08 і MOD-01. [Межі покриття](qa/book-06-07-review-2026-09-14.md).
- [ ] **Мобільний QA на реальних пристроях:**
  - [ ] iOS Safari (BrowserStack або реальний iPhone)
  - [ ] Android Chrome
  - [ ] iPad Safari
- [ ] Тест workflow адмінки (закрити хвости з Фази 10.5)
- [x] ✅ Гостьові admin redirects і вибрані прямі anon/RLS-перевірки мають evidence: DEP-02, RLS-08/10
- [ ] Повний runtime-тест доступу до адмінки: non-admin → `/unauthorized`, admin → потрібні розділи; прямі table/RPC-перевірки за ADM-01/15. Не вимагати універсального `403`
- [ ] **Soft launch для 20-50 ранніх юзерів** перед публічним:
  - [ ] Запросити з customer interviews
  - [ ] Збирати bug reports через support@
  - [ ] 2 тижні моніторингу
- [ ] Якщо crash rate >0.5% → виправити перед publik

---

---

# 🌱 TIER 2 — Перші 3 місяці після launch (growth focus)

> Це найважливіша частина після launch. Тут — **те, що визначає, чи стане MintoFood реальним продуктом, чи помре між версіями**.

---

## 💞 ФАЗА 23: Social layer (НОВА — найбільша діра в попередньому roadmap)

> **Чому критично:** recipe apps живуть на social proof + sharing. Без цього ти конкуруєш як "ще один nutrition tracker" — і там MyFitnessPal вже виграв.

### 👤 Public author profiles

- [ ] Поле `profiles.is_public` (default false, юзер може зробити публічний)
- [ ] Сторінка `/author/{username}` — рецепти автора, статистика, bio
- [ ] Username (унікальний, slug) у профілі
- [ ] Default аватарка → бренд м'ятна капля

### 👥 Follow / Followers

- [ ] Таблиця `user_follows` (follower_id, following_id, created_at)
- [ ] Кнопка "Слідкувати" на author profile
- [ ] Лічильник підписників на профілі
- [ ] "Підписки" у профілі — рецепти від тих кого follow

### 💚 Social proof на рецептах

- [ ] "Цей рецепт зберегли 214 людей" на recipe card + recipe page
- [ ] Лічильник в БД (denormalized для швидкості, оновлюється тригером)
- [ ] Останні 3 аватарки тих хто зберіг (опційно)

### 📖 Public cookbooks

- [ ] Поле `cookbooks.is_public` (default false)
- [ ] Сторінка `/cookbook/{slug}` публічна
- [ ] Author + опис + список рецептів
- [ ] "Скопіювати в мої книги" кнопка для залогінених

### 🔄 Activity feed (опційно)

- [ ] Якщо follow > 0 → стрічка нових рецептів від тих кого follow
- [ ] На головній або як окрема сторінка

### 💬 Comments / Notes на рецептах

- [ ] Таблиця `recipe_comments` (recipe_id, user_id, body, created_at)
- [ ] Модерація — auto-flagging як зараз
- [ ] Юзер може видалити свій коментар; адмін — будь-який

### 🎴 Shareable nutrition cards

- [ ] Кнопка "Поділитися своїм днем" → генерує красиву картку 1080x1080 (для Instagram Stories)
- [ ] Картка: streak, top рецепт дня, calorie ring
- [ ] `vercel/og` для генерації
- [ ] Soft watermark "mintofood.com"

---

## 🔁 ФАЗА 24: Retention emails + push (без anti-steering)

### 📧 Retention emails

- [ ] **Weekly digest** (опціонально, opt-in за замовчуванням True): твій тиждень — streak, top meals, water avg, рекомендації
- [ ] **Streak save** — "Не забудь занести вечерю, твоя серія 7 днів 🌿" (якщо не логував 18 год)
- [ ] **Water reminder** (опційно — багато бісить юзерів, перевірити в інтерв'ю)
- [ ] **Weight check-in** — раз на тиждень нагадування записати вагу
- [ ] **"Друзі додали рецепти"** — якщо є follows
- [ ] Усі — opt-out з кожного листа

### 🔔 Web Push (Service Worker)

- [ ] Реєстрація SW (буде в Фазі 26 PWA)
- [ ] Opt-in після 2-3 візитів (не auto-prompt)
- [ ] Push типи: streak retention, meal log reminder, friend joined
- [ ] **ЗАБОРОНЕНО** (anti-steering): trial reminders, promo, "знижка на Premium" → тільки email

---

## 🎁 ФАЗА 25: Referral program (НОВА)

> Recipe apps дуже добре ростуть через WOM. Без referral ти втрачаєш найдешевший канал.

- [ ] Унікальний referral код для кожного юзера (`profiles.referral_code`)
- [ ] Сторінка `/r/{code}` → landing з преміумом для нового юзера
- [ ] Таблиця `referrals` (referrer_id, referee_id, status, reward_granted_at)
- [ ] Reward: 1 місяць Premium для обох якщо referee сплатив
- [ ] UI: сторінка "Запросити друзів" у профілі — код + share button + статистика
- [ ] Email шаблон "Friend signed up"
- [ ] Anti-abuse: 1 reward per IP/device per month

---

## 📱 ФАЗА 26: PWA + TWA → Google Play

> Історичний план посилався на Фазу 19 старого roadmap щодо No-IAP/anti-steering. Шлях до того оригіналу не вказаний; у поточному roadmap Фаза 19 — монетизація. Нижче збережено наявний перелік задач, без твердження про завершену перевірку правил платформ.

### Quick summary

- [x] Manifest та його підключення — `manifest.json`, `build.js`; реалізовано у Фазі 21
- [ ] Решта PWA fundamentals: SW і заявлена перевірка Lighthouse PWA
- [ ] TWA через Bubblewrap, Digital Asset Links
- [ ] Google Play Console setup ($25), Verification
- [ ] Графічні матеріали, store listing у 3 мовах
- [ ] **No-IAP compliance audit** (жодних згадок про Premium в app)
- [ ] Beta testing → staged rollout 5% → 20% → 50% → 100%
- [ ] Deep linking з web на app

> ⏰ ~6-8 тижнів від PWA до публічного релізу

---

## 🔎 ФАЗА 27: Search optimization

> Поріг «>500 рецептів» у старому плані не підкріплений вимірюваннями цього проєкту. Відкритий аудит нижче має визначити фактичний p95 і потребу оптимізації; заміна пошуку не погоджена цією звіркою.

- [ ] Аудит швидкості поточного пошуку (`search_products_fuzzy` уже на pg_trgm)
- [ ] Якщо <200ms на p95 — все ОК, нічого не міняємо
- [ ] Якщо повільніше:
  - [ ] **Опція А:** Postgres Full-Text Search (`tsvector` + GIN index) — безкоштовно, добре для української
  - [ ] **Опція B:** Typesense self-hosted — швидко, контроль
  - [ ] **Опція C:** Algolia — найкраща UX, але платно за scale
- [ ] **Filters facets** — multi-language (українська vs англ vs пол) індекси

---

## ✍️ ФАЗА 28: Content strategy (НОВА)

> SEO без контенту = machine без палива. Особливо для recipe app в нішевих мовах.

### 🌾 Starter recipe content

- [ ] **Seed 200-300 базових рецептів** у 3 мовах — української/польської/міжнародної кухні
- [ ] Editorial standards: фото, КБЖУ, час, складність, intro 2-3 речення
- [ ] AI-assist (Claude / GPT-4o) для translations + human review
- [ ] Зробити їх "official" (галочка верифікації)
- [ ] **Featured recipes** — підбірки на головній

### 📅 Editorial calendar

- [ ] Seasonal content: "Recipes for Christmas Eve в Україні", "Wielkanocne potrawy"
- [ ] Health clusters: "Recipes for diabetics", "Anti-inflammatory recipes"
- [ ] Quick wins: "30-min dinners", "5-ingredient lunch"

### 📌 Pinterest funnel

- [ ] Pinterest Business акаунт
- [ ] Pin templates 1000x1500 з brand styling
- [ ] Auto-generate pin для кожного нового рецепту (через `vercel/og`)
- [ ] Rich Pins: клієнтський Schema.org Recipe реалізовано у Фазі 15; читання розмітки Pinterest і результат preview ще не перевірені
- [ ] Цільовий KPI: 100K monthly impressions за 6 міс

### 📝 Blog (опційно)

- [ ] `/blog` секція (можна на тому ж домені)
- [ ] 2 пости/тиждень: "How to count calories accurately", "5 myths about carbs"
- [ ] Internal linking на recipes
- [ ] SEO clusters: "healthy breakfast" → 5-10 пов'язаних статей

---

## 🎨 ФАЗА 29: Design governance (НОВА)

> Токени й placeholders уже є у Фазі 0. Тут лишається формалізація правил і наскрізна перевірка їх застосування; готовий `_design-system.scss` не закриває ці задачі.

> Без цього через 8 міс UI почне "плисти" — різні кнопки, різні spacing, regression повзе.

- [ ] **Component inventory** — Storybook або просто `/dev/components.html` сторінка з усіма компонентами в дії
- [ ] **Forbidden patterns** список (`docs/design-rules.md`):
  - [ ] No custom spacing outside scale (4/8/12/16/20/24/32/40/56)
  - [ ] Погодити правило border-radius з чинними токенами: md/lg/xl = 12/16/20, також є xs/sm/2xl/pill. Старе «тільки 12/16/20» не описує поточну реалізацію
  - [ ] No custom shadows (тільки Level 1/2/3)
- [ ] **Token linting** — stylelint rule, що бере токени з CSS variables
- [ ] **Visual regression testing** — Percy / Chromatic / Playwright screenshots (опційно)
- [ ] **Screenshot QA checklist** перед deploy

---

## 📊 ФАЗА 30: A/B testing (запускати через PostHog flags)

- [ ] PostHog feature flags + experiments
- [ ] Перші тести:
  - [ ] Pricing page copy (3 варіанти headline)
  - [ ] Paywall trigger timing (immediate vs delayed)
  - [ ] Onboarding step order (goals first vs body params first)
  - [ ] Free limits — 30 vs 60 vs 90 днів історії
- [ ] Decision protocol: мінімум 1000 експозицій + 14 днів run + p<0.05

---

---

# 🏔 TIER 3 — Scale stage (після PMF + revenue)

> Сюди йде все, що зараз — overengineering. Робиться коли є revenue ($2-5K MRR) + traffic + real outage pains.

---

## 🛡 ФАЗА 31: Security & compliance enhancement

- [ ] **HSTS preload** submission (hstspreload.org) — після стабільного HSTS
- [ ] **CSP perfection** — securityheaders.com **A+**
- [ ] **Permissions-Policy** — обмежити camera/microphone/geolocation
- [ ] **Hardware security key** (YubiKey) для domain registrar + Cloudflare
- [ ] **Penetration testing** — найняти спеца раз на рік
- [ ] **Bug bounty program** (опційно — HackerOne)

---

## 💾 ФАЗА 32: Disaster recovery + status

- [ ] **Backblaze B2 backup** додатково до Supabase (pg_dump CRON, $0.005/GB)
- [ ] **Quarterly recovery drills** — раз на квартал перевіряти, що backup можна відновити
- [ ] **DR runbook** — окремий документ: що робити якщо Supabase/Vercel/домен падає 24+ год
- [ ] **Status communication plan** — email + push + соцмережі
- [ ] **Public status page** `status.mintofood.com` (UptimeRobot або Better Stack)
- [ ] Migration на **Better Stack** ($10-50/міс, 30 сек інтервал) якщо UptimeRobot не вистачає

---

## 🏷 ФАЗА 33: Brand protection

- [ ] **Trademark registration:**
  - [ ] Польща — UPRP (~$500)
  - [ ] EU — EUIPO (~$1000-1500)
- [ ] Захист на "MintoFood" + лого
- [ ] Соцмережі: @mintofood на IG / TikTok / X / YouTube / LinkedIn
- [ ] Reddit / Producthunt / Discord / Telegram username

---

## 🍎 ФАЗА 34: iOS / App Store

- [ ] Apple Developer Program ($99/рік)
- [ ] Capacitor (не TWA — iOS only)
- [ ] App Tracking Transparency prompt
- [ ] **Reader app exception** — перевірити чи MintoFood кваліфікується (food/recipe — на межі)
- [ ] DMA EU — зовнішні платежі через спецентитлемент
- [ ] TestFlight beta
- [ ] App Store Connect listing
- [ ] iOS anti-steering compliance audit (ще жорсткіший за Google)

---

## 🎯 ФАЗА 35: Advanced ASO + growth

- [ ] AppFollow / AppTweak / Sensor Tower (платні)
- [ ] A/B тести store listing
- [ ] Localized screenshots для 6+ ринків
- [ ] Influencer outreach
- [ ] Paid acquisition: Instagram/TikTok ads з ROAS tracking
- [ ] Affiliate program (опційно)

---

## 🤖 ФАЗА 36: AI деeper integration

- [ ] **AI weekly meal planning** — справжня версія, не stub
- [ ] **AI grocery optimization** — реалізація
- [ ] **AI macro balancing** — авто-підбір страв
- [ ] **AI recipe recommendations** — на основі історії + цілей
- [ ] Native camera через Capacitor (для кращої якості OCR)

---

## 🏗 ФАЗА 37: Infrastructure scaling

- [ ] **Supabase read replicas** — якщо load зросте
- [ ] **Cloudflare Workers** для edge logic
- [ ] **Bundle size monitoring** + Lighthouse CI on PR
- [ ] **Database CPU optimization** + query plan analysis
- [ ] Окремий `admin.mintofood.com` з IP allowlist
- [ ] (Опційно) `api.mintofood.com` для public API

---

---

# 📊 Підсумок: розподіл обсягу

| TIER   | Фази   | Орієнтовний час        | Стан               |
| ------ | ------ | ---------------------- | ------------------ |
| TIER 0 | 0–10.9 | основа реалізована     | QA і governance відкриті |
| TIER 1 | 11-22  | 8-12 тижнів            | Pre-launch         |
| TIER 2 | 23-30  | 12-16 тижнів (3-4 міс) | Post-launch growth |
| TIER 3 | 31-37  | 6-12 місяців           | Scale stage        |

**Бюджет TIER 1:** ~$0-50/рік (iubenda/Termly план) + ~$50-100/міс (Vercel Pro + Supabase Pro + email + monitoring)

---

## 🎯 Ключові принципи v2

1. **Customer validation first.** Інтерв'ю та висновки про попит перед реалізацією платної підписки (Фази 11/19).
2. **GDPR і moderation — це launch blockers**, не "later". В ЄС + UGC платформа.
3. **Paywall продає AI/intelligence**, а не storage. Free має бути usable, Premium — надбудова, що економить час.
4. **Growth layer (social, referral, content) — це не "nice to have"**. Це різниця між life і death для consumer-продукту в конкурентному ринку.
5. **Feature flags + staging + release checklist — з дня 1.** Solo founder без цього страждає вже через 3 міс.
6. **Overengineering parking lot.** HSTS preload, trademark, status page, A+ security — все це **правильно**, але після того як знайдеш PMF. Інакше — sunk cost.

---

## 📝 Нотатки

- **Принцип "фундаментально" залишається** — але тепер з правильним sequencing.
- **Тест двох тем:** кожна нова сторінка має одразу виглядати premium у світлій і темній.
- **Мобайл-first** для нових компонентів.
- **Не чіпаємо те, що працює:** core JS (`meals.js`, `stats.js`, `auth.js`) залишається.
- **Roadmap — це жива істота.** Перегляд раз на місяць, перерозподіл tier-ів за реальними даними.

---

_Остання звірка документації з кодом і наявними доказами: 27.09.2026. Дати окремих QA-прогонів збережені; нового live QA під час цієї звірки не виконували._
