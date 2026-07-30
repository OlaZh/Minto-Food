# 🌿 MintoFood — Roadmap v2 (після аудиту)

> **Статус:** травень 2026
> **Палітра:** Соковита м'ята (`#a6d6b8` / `#b8e0c5` / `#4ab584` / `#82bf99` / `#0f2818`)
> **Принцип:** No MVP thinking, але правильне sequencing. Робимо фундаментально, але в правильному порядку — щоб не потонути в інфраструктурі до того, як продукт зустріне юзерів.
> **НЕ чіпаємо:** шрифти (Fraunces/Rubik/Mulish), лого, існуючі кольори світлої та темної тем.

---

## 🧭 Структура roadmap

Документ розбито на 3 TIER-и за пріоритетністю:

- **TIER 0 — Зроблено** (Фази 0-10.8): редизайн + адмінка + 10.9 структурний рефакторинг
- **TIER 1 — MUST до публічного launch**: без цього не запускаємось
- **TIER 2 — Перші 3 місяці після launch**: growth, retention, мобайл
- **TIER 3 — Scale stage**: коли є revenue + traction

> Цей порядок не означає "TIER 2 = не важливо". Він означає: спершу довести продукт до юзерів, побачити що працює, а потім полірувати. Інакше ризик 6+ місяців без feedback loop.

---

## 🧭 Форм-система проєкту

Правило premium-додатків (Apple Health, Noom, Lifesum): максимум **2 форми + 1 драматичний акцент**.

- **Rounded rectangles** (r=12–20px) — картки, кнопки, поля, контейнери
- **Одне кільце на сторінку** — тільки для головного показника (наприклад, калорії на "Меню на день")

---

# ✅ TIER 0 — Зроблено

> Усе, що вже завершено в рамках сайтового редизайну та адмінки. Збережено як reference і для closure відкритих хвостів.

---

## 🎨 ФАЗА 0: Дизайн-система (фундамент)

**Форм-система:**

- [ ] Визначити стандарти rounded rectangles (r=12/16/20)
- [ ] Правило "одне кільце на сторінку"

**SCSS компоненти (mixins/placeholders):**

- [ ] `%card-premium` — стандарт картки з hover
- [ ] `%button-primary` — основна кнопка
- [ ] `%button-secondary` — вторинна кнопка
- [ ] `%button-ghost` — прозора / утилітарна кнопка
- [ ] `%chip-filter` (категорії "Рецепти", "Путівник")
- [ ] `%chip-day` — дні тижня
- [ ] `%pill-badge` — streak, статуси
- [ ] `%progress-bar` — горизонтальний бар для макро
- [ ] `%ring-hero` — велике кільце калорій
- [ ] `%water-capsule` — вертикальна капсула води

**Spacing system:**

- [ ] Зафіксувати шкалу: 4, 8, 12, 16, 20, 24, 32, 40, 56 px
- [ ] Усі компоненти використовують тільки ці значення

**Shadow/elevation system:**

- [ ] Level 1 — картки (ледь піднято)
- [ ] Level 2 — hover state
- [ ] Level 3 — модалки, dropdowns

> 💬 _Цю фазу формально не закривали, але вона де-факто реалізована через Фази 1-9. Винесено в Tier 2 як "Design governance" (фаза 22) — щоб формалізувати те, що вже існує._

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

## 🏠 ФАЗА 2: "Меню на день" — ✅ повністю готова

- [x] ✅ Таблиця `user_streaks`, `get_current_streak()`, автотригер на `meals`, бекфіл
- [x] ✅ Дні тижня pills, кільце калорій + streak, аккордеони meals, вода, макро-бари
- [x] ✅ Мобільна версія (1 колонка)
- [x] ✅ JS: streak-логіка, аккордеони, копіювати/вставити/очистити день
- [x] ✅ Тест світлої + темної теми

---

## 📅 ФАЗА 3: "Меню на тиждень" — ✅ повністю готова

- [x] ✅ Матриця "дні × прийоми", pills днів тижня, "Разом" колонка
- [x] ✅ Копіювати/вставити тиждень
- [x] ✅ Мобільна версія (аккордеони, сітка "Весь тиждень" з крапками)
- [x] ✅ Тест світлої + темної теми

---

## 🍳 ФАЗА 4: "Рецепти" — ✅ повністю готова

- [x] ✅ Картки, пошук + чіпи-фільтри, рейтинги, empty state
- [x] ✅ Мобільна версія (2 колонки)
- [x] ✅ Хедер: `[🔥 Нові рецепти]` — `Рецепти` — `[+ Додати рецепт]`
- [x] ✅ Drawer "Нові рецепти" (за 24 год, без фото, сортування за свіжістю + рейтингом)
- [x] ✅ Browsing: "Твої рецепти" + "Загальна база"
- [x] ✅ Пошук: "Мої (N)" + "Загальні (N)" з "Показати всі"
- [x] ✅ Тест світлої + темної теми

---

## 🥦 ФАЗА 5: "Путівник по продуктах" — ✅ повністю готова

- [x] ✅ Картки продуктів, пошук + фільтри, розширені фільтри, модалка деталей
- [x] ✅ Мобільна версія (2 колонки)
- [x] ✅ Тест світлої + темної теми

---

## 🛒 ФАЗА 6: "Список покупок" — ✅ повністю готова

- [x] ✅ Групування по категоріях, чекбокси, прогрес, дії (поділитися/очистити/друк)
- [x] ✅ Швидке додавання продукту
- [x] ✅ Мобільна версія
- [x] ✅ Тест світлої + темної теми

---

## 📚 ФАЗА 7: "Книга рецептів" — ✅ повністю готова

- [x] ✅ Картки книг, "Нещодавно переглянуті", модалка книги, нотатки/стікери
- [x] ✅ Мобільна версія
- [x] ✅ Тест світлої + темної теми

---

## 👤 ФАЗА 8: Профіль + підсторінки — ✅ повністю готова

- [x] ✅ Layout + Sidebar (на мобільному — горизонтальний таб-бар)
- [x] ✅ Мої дані / Контроль ваги / Активність / Статистика / Налаштування
- [x] ✅ Streak в профілі (current + longest_streak)
- [x] ✅ Мобільна версія всіх підсторінок
- [x] ✅ Тест світлої + темної теми

---

## 🧭 ФАЗА 9: Навігація та авторизація — ✅ повністю готова

- [x] ✅ Хедер з аватаркою / login
- [x] ✅ Модалка логіну/реєстрації
- [x] ✅ Мобільний таб-бар + "Ще"

---

## ✅ ФАЗА 10: Фінальний поліш — майже готова

- [x] ✅ Повний огляд усіх сторінок у світлій темі (18.07.2026, автоматизований прохід + вибірковий візуальний огляд — див. Фазу 22)
- [x] ✅ Повний огляд усіх сторінок у темній темі (18.07.2026, там само)
- [x] ✅ Skeleton-loaders (рецепти, путівник, книга)
- [x] ✅ Empty states (всі сторінки)
- [x] ✅ Error states (рецепти, путівник)
- [x] ✅ Анімації переходів (fade-in)
- [x] ✅ Accessibility audit (:focus-visible глобально)
- [x] ✅ Performance audit (lazy-load)
- [ ] Мобільний QA на реальних пристроях (iOS Safari, Android Chrome) — **перенесено в TIER 1 → "Pre-launch QA"**

---

## 🛡 ФАЗА 10.5: Адмінка — Центр модерації — ✅ повністю готова

> Next.js `admin-app/`, Server Actions + Supabase SSR, доступ через `profiles.is_admin = true`.

**Зроблено:**

- [x] ✅ Інфраструктура БД (`is_admin`, `is_banned`, `recipe_reports` колонки, `admin_actions` таблиця)
- [x] ✅ RLS-політики (reports, recipes, products, profiles)
- [x] ✅ Routing & Auth (middleware, login, OAuth callback, transfer, unauthorized)
- [x] ✅ Layout: sidebar + mobile block
- [x] ✅ Секція "Скарги" (з bulk actions, drawer, групування, фільтри)
- [x] ✅ Секція "Нові рецепти" (spam detection >10/день, inline edit)
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
- [ ] Тест: anon ключ → 403 (runtime, на deployed URL)
- [ ] QA-тести (workflow, каскади, бан, bulk, empty)
- [ ] Тест світлої + темної теми

---

## 🛡 ФАЗА 10.6: Адмінка — Розширені інструменти модерації — ✅ повністю готова

- [x] ✅ Shadow ban (`is_shadow_banned`, нові рецепти → draft)
- [x] ✅ Архів порушень (soft delete: `deleted_at`, `app/(admin)/archive/`)
- [x] ✅ "Переглянути як користувач" (іконка в ReportsClient/ModerationClient)
- [x] ✅ Mini-history автора
- [x] ✅ Причина модерації (`ModerationReasonDialog` з категоріями)
- [x] ✅ Undo action (`lib/undoToast.ts`, 5 сек)
- [x] ✅ Auto-flagging inappropriate content + suspicious links

---

## ✅ ФАЗА 10.7: PRIVATE vs PUBLIC архітектура рецептів

> **Статус:** ✅ Повністю реалізовано (червень 2026) — ядро + UX-полірування (бейдж, кнопка "Зробити публічним", фільтр) + серверна валідація. Лишилось: застосувати міграцію `20260608_1300` у Supabase + візуальна QA.
> **Принцип:** PRIVATE = особиста кулінарна книга (будь-який контент), PUBLIC = спільнота (проходить модерацію).

### Правила

**PRIVATE рецепти** — дозволено все:

- незавершений контент, відсутні кроки/інгредієнти, короткі назви
- зовнішні посилання (TikTok, Instagram, YouTube, Telegram, Notion, блоги)
- масовий імпорт / quick save
- NO auto-flagging, NO бани за кількість

**PUBLIC рецепти** — тільки для "Поділитися зі спільнотою":

- обов'язкова назва
- хоча б інгредієнти АБО кроки приготування
- блокуються: scam / adult / gambling / phishing
- всі йдуть через чергу модерації

### ✅ Зроблено

- [x] ✅ **DB default** — `is_public DEFAULT false` (нові рецепти приватні) + backfill (`supabase/private_public_recipes.sql`)
- [x] ✅ **`is_public` у payload** — `recipe-modal.js` передає `is_public: isPublicSubmission` при збереженні
- [x] ✅ **Валідація публікації** — перед submit як PUBLIC: перевірка назви + (інгредієнти або кроки)
- [x] ✅ **Auto-flagging scope** — `detectFlags()` викликається тільки в moderation queue і reports (тільки PUBLIC контент)
- [x] ✅ **Bot activity detection видалено** — масовий import приватних рецептів є нормальною поведінкою

### 🔮 Наступна черга

- [x] ✅ **Окрема валідація на сервері** — DB trigger `validate_public_recipe` (`20260608_1300`): публічний `pending` без назви або без інгредієнтів/кроків → reject. Приватні (`is_public=false`) НЕ валідуються — будь-який контент дозволено
- [x] ✅ **"Зробити публічним" для існуючих приватних рецептів** — кнопка `recipe-card__make-public` на власних приватних рецептах (валідація назва+контент → `is_public=true, status=pending`)
- [x] ✅ **Позначення в UI** — бейдж `iconLock`/`iconGlobe` (`recipe-card__visibility`) на власних рецептах, обидва стани, у фірмовому стилі іконок
- [x] ✅ **Фільтр у "Твої рецепти"** — чіпи `recipe-own-filter` (Усі / Приватні / Публічні / На модерації), клієнтська фільтрація кешованих власних рецептів

---

## 🏗 ФАЗА 10.9: Структурний рефакторинг HTML/SCSS — уніфікація layout

> **Статус:** ✅ HTML-рефакторинг зроблено (травень 2026) — залишилася тільки фінальна QA (теми/мобайл).
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

#### 📄 `index.html` (Меню на день) — НАЙСКЛАДНІШИЙ

**Поточна структура:**
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

**Поточна структура:**
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

**Поточна структура:**
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

**Поточна структура:**
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

**Поточна структура:**
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

**Поточна структура:**
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

**Поточна структура:**
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

**Поточна структура:**
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

### Порядок виконання

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

> **Статус:** ядро зроблено (травень 2026) — залишився тільки тест тем.
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

**Bottom row:** `© 2026 MintoFood · Харчові звички набувають форми`

### ✅ Зроблено

- [x] ✅ HTML-компонент `partials/footer.html`
- [x] ✅ SCSS `scss/layout/_footer.scss` — десктоп 4 колонки, tablet 2×2, mobile акордеон
- [x] ✅ Підключено до 15 сторінок (усі public + юридичні: `index.html`, `recipes.html`, `recipe.html`, `week-menu.html`, `product-guide.html`, `shopping-list.html`, `shared-list.html`, `cookbook.html`, `profile.html`, `privacy.html`, `terms.html`, `cookies.html`, `imprint.html`, `dmca.html`)
- [x] ✅ Тест світлої + темної теми (18.07.2026, автоматизований QA-прохід Фази 22 — обидві теми, desktop+mobile)

### 🔮 Відкладено (залежності або TIER 2/3)

- [ ] **Newsletter signup** → залежить від Resend (Фаза 14)
- [ ] **Pricing посилання** → коли з'явиться сторінка (Фаза 19)
- [ ] **Соцмережі** (IG / TikTok / Pinterest / YouTube) → коли з'являться акаунти
- [ ] **Перемикач мови** → якщо не буде в хедері (Фаза 21)
- [ ] **Blog / Press / Affiliate** → TIER 2/3
- [ ] **Status page** → TIER 3

---

# 🚀 TIER 1 — MUST до публічного launch

> Без цього не запускаємось. Усе тут має бути зроблено фундаментально, без скорочень.
> **Орієнтовно:** 8-12 тижнів роботи (включно з генерацією документів і beta-тестуванням).

---

## 🎯 ФАЗА 11: Customer validation (НОВА, критична)

> **Чому це перше:** перш ніж писати paywall, налаштовувати Stripe і генерувати pricing page — треба переконатись, що те, що ти будеш продавати, реально хочуть купити. 10 інтерв'ю врятують 3 місяці хибної роботи.

### 📞 Customer interviews

- [x] Сформулювати target persona: жінки 25-45, ЄС + Україна, цікавляться харчуванням, користувались MyFitnessPal/Yazio/Lifesum
- [ ] Знайти 15 респондентів: соцмережі, ком'юніті, знайомі, Reddit r/MealPrep / r/loseit, українські Telegram-групи
- [x] Підготувати скрипт інтерв'ю (30-45 хв):
  - [ ] Що зараз використовуєш для трекінгу харчування? Чому саме це?
  - [ ] Що в цьому додатку бісить? Що б змінила?
  - [ ] Чи платиш за щось у цій сфері? Скільки? За що саме?
  - [ ] Якби була магічна фіча для харчового додатку — що б це було?
  - [ ] Показ MintoFood (3 хв demo) → чесна реакція
  - [ ] За що в MintoFood ти б заплатила $5/міс? А за що точно не заплатила б?
- [ ] Провести 10-15 інтерв'ю (1 на день, 2 тижні)
- [ ] Транскрибувати + позначити паттерни (Notion/Miro)

### 📊 Висновки → рішення

- [ ] **Top 3 болі** з інтерв'ю → що з них вирішує MintoFood вже?
- [ ] **Top 3 фічі**, за які люди готові платити → це і є основа Premium (а НЕ "10 рецептів max")
- [ ] Скласти **value proposition** одним реченням: "MintoFood — це [що] для [кого], тому що [unique value]"
- [ ] Зафіксувати: ціна (стрес-тест на $3 / $5 / $7 / $10) — за що готові, за що ні
- [x] Документувати все у `docs/customer-research.md` — оновлювати кожні 3 міс

### 💡 Outcome

- [ ] Переписана Фаза 16 (монетизація) на основі реальних insights
- [ ] Реалістична Free vs Premium розбивка
- [ ] Перший draft messaging для pricing page

> ⚡ _Якщо інтерв'ю покажуть, що ніхто не платить за recipe app — це теж результат. Краще дізнатись зараз, ніж після 3 міс на Stripe._

---

## 🧹 ФАЗА 12: Чистка БД + Migration safety (РОЗШИРЕНА)

> Старий план — просто "почистити стале". Новий — додати інфраструктуру для безпечних змін на майбутнє. Це найдешевший момент: поки таблиць мало.

### 🧽 Чистка

- [x] `profiles` vs `user_profiles` — різні ролі, обидві активні (profiles = auth/admin, user_profiles = health data)
- [x] Видалити `old_products` — замінена новою таблицею products
- [x] Видалити `recipetest`, `cookbook_notes`, `cookbook_notebooks`, `shopping_list`, `meals_backup_before_streaks`, `product_similar`
- [x] Аудит RLS — всі public таблиці захищені ✅

### 🧬 Migration safety (НОВЕ — критичне для solo founder)

- [x] **Naming convention:** `YYYYMMDD_HHMM_description.sql` — зафіксовано у `supabase/migrations/README.md`
- [x] Тримати всі міграції у `supabase/migrations/` + у git
- [x] **Migration policy документ** `docs/migrations.md` — checklist, типи операцій, алгоритм NOT NULL
- [x] **Rollback стратегія:** для кожної міграції — окремий `_rollback.sql`
- [x] **Staging DB sync:** скрипт, що клонує prod schema на staging (без даних або з анонімізованими)

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
- [x] Imprint / Impressum — `imprint.html` (шаблон, заповнити реальними даними)
- [x] DMCA / copyright complaint procedure — `dmca.html`, посилання у футері всіх сторінок

### 🍪 Cookie consent banner

- [x] Self-built — `js/cookie-consent.js` + `scss/components/_cookie-consent.scss` (auto-init, підключено на всіх 14 публічних сторінках через `build.js`)
- [x] Категорії cookies: Necessary / Analytics / Marketing
- [x] Granular toggles (панель "Налаштувати")
- [x] Reject All на тому ж рівні видимості що Accept All (compliance)
- [x] Збереження вибору на 6 місяців (localStorage)
- [x] Re-prompt при додаванні нових cookies — `CONSENT_VERSION` у `js/cookie-consent.js`, bump при змінах

### 🔐 GDPR — права юзера

- [x] **Data Export** — `api/gdpr-export.js` → JSON (`SUPABASE_SERVICE_ROLE_KEY` додано у Vercel ✅)
- [x] **Right to be Forgotten:** soft-delete + 30-денний grace period через `soft_delete_user()`
  - [x] Hard-delete CRON job після grace period
  - [ ] Анонімізація платіжних записів (TIER 1 → після Фази 19)
- [x] **Data Rectification** — через профіль (вже працює)
- [x] **Data Portability** — JSON export через `/api/gdpr-export`
- [x] Логування GDPR-запитів у таблицю `gdpr_requests` — `20260518_1300_gdpr.sql`

### 📑 DPA з усіма sub-processors

- [ ] Supabase (з їх dashboard)
- [ ] Vercel (з settings)
- [ ] Провайдер платежів (Stripe/Paddle/LS)
- [ ] Resend
- [ ] PostHog (EU hosting!)
- [ ] Sentry
- [x] Список sub-processors — у `privacy.html#processors`

### 🧒 Edge cases

- [x] Age gate at signup: "Тобі є 16+?" (ЄС default; деякі країни — 13-15)
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

**Статус:** готово до ручного E2E-тесту.

Передумови: реальний тестовий акаунт із заповненим профілем, хоча б однією книгою і рецептом; користувач залогінений.

- [ ] Відкрити `profile.html` → Settings → `GDPR і приватність`.
- [ ] Натиснути `Завантажити мої дані` та дочекатися завантаження без падіння сторінки.
- [ ] Перевірити ім'я файлу виду `mintofood-export-XXXXXXXX.json`.
- [ ] Перевірити, що JSON містить усі персональні дані:
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

**Статус:** готово до ручного тесту запиту; hard-delete потребує застосування виправної міграції.

Передумови: disposable test account, залогінений і ще не запланований на видалення.

- [ ] **Застосувати в Supabase вручну** міграцію `20260718_1200_gdpr_hard_delete_v2.sql`.
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

**Статус:** логіка підтверджена по коду, потрібен короткий ручний smoke test.

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
- [ ] ⚠️ **Застосувати міграцію `20260726_1000_recipe_ratings.sql` у Supabase вручну** (+ rollback поруч) — до цього RPC `get_recipe_rating_summaries` не існує на живій БД → оцінки повертають 0, оцінювання падає. Як [[project_image_moderation]] і [[project_gdpr_pipeline]], міграція чекає ручного застосування
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

- [x] ✅ OG tags + Twitter Card tags
- [ ] **Динамічна OG image** для рецептів — `vercel/og` (recipe.image + бренд оверлей)
- [ ] Тест через opengraph.xyz / Twitter Card validator

### 🔘 Шерінг

- [x] ✅ Кнопка "Поділитися" (Web Share API + copy link)
- [ ] Тест share у Telegram / Messenger / iOS Messages

### 📈 Search Console + Bing Webmaster

> ⏳ Блокер: реальний домен → див. Фазу 18

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

### 📈 PostHog (EU hosting)

- [ ] Створити акаунт (EU-hosting обов'язково для GDPR)
- [ ] Інтеграція через `posthog-js`
- [ ] Респект cookie consent
- [ ] Identify users після login
- [ ] **Tracking events (мінімальний набір):**
  - [ ] `signup_started` / `signup_completed`
  - [ ] `recipe_created` / `recipe_published`
  - [ ] `meal_logged` / `water_logged` / `weight_logged`
  - [ ] `recipe_saved_to_book` / `cookbook_created`
  - [ ] `paywall_shown` (з `feature` property)
  - [ ] `checkout_started` / `subscription_started` / `subscription_canceled`
  - [ ] `ai_scan_used`
- [ ] **Funnels:** signup → first meal → 7-day retention → trial → paid
- [ ] **Cohort retention** weekly
- [ ] Session recordings з GDPR-маскою (no PII)

### 🚨 Sentry

- [ ] Free tier 5K events/міс
- [ ] `@sentry/browser` у front-end
- [ ] `@sentry/node` у Vercel functions (webhooks)
- [ ] Source maps upload при білді
- [ ] User context після login (без PII у meta — тільки user.id)
- [ ] Filter expected errors (network, AbortController)
- [ ] **Alert rules:** >10 errors/5хв → email; new error type → email; webhook crashes → critical
- [ ] Щоденна перевірка зранку

### 🟢 Uptime monitoring

- [ ] **UptimeRobot** (безкоштовний, 5 хв) — достатньо для старту
- [ ] Моніторити: основний домен, `/api/health` endpoint, Supabase REST
- [ ] _Public status page → TIER 3_

### 🌱 Onboarding flow для нових юзерів

> Найдешевший спосіб підняти activation rate. Юзер у момент signup має максимальний інтерес — не втрачаємо його.

- [x] ✅ **Welcome screen** після signup (18.07.2026) — перший екран онбординг-оверлею (`onbValueView` в `js/onboarding.js`): 3 цінності (меню з КБЖУ / книга рецептів / список покупок) → "Почати" → нікнейм. Той самий прапор `welcome_intro_seen`, без нової міграції
- [x] ✅ **Goal setup wizard** — `js/onboarding-wizard.js`: 3 кроки (ціль → параметри тіла → активність), живий розрахунок норми через спільний health-core, збереження в `user_profiles`, skip-прапор `goal_wizard_skipped`
- [x] ✅ **Sample data seed** (18.07.2026) — після завершення wizard сіється 1 сніданок "Вівсянка з ягодами (приклад)" у `meals` (тільки якщо meals порожній); подія `minto:meals-seeded` перемальовує "Меню на день" без reload
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

- [ ] Supabase Pro робить daily backups + PITR ✅
- [ ] Раз на квартал — перевіряти, що backup можна відновити (на staging)
- [ ] _Backblaze B2 + DR runbook → TIER 3_

### 🔒 Безпека — basic

- [ ] **2FA на ВСІХ критичних акаунтах:** Vercel, Supabase, Cloudflare, Domain registrar, Stripe/LS, Resend, Sentry, GitHub
- [ ] Recovery codes зберегти в password manager
- [ ] ⚠️ **Частково — Security headers** базові (24.07.2026). Написані/зроблені локально — ⚠️ ще НЕ задеплоєні на Vercel (git uncommitted): перевірка на живих URL лишається. admin-app окремим деплоєм отримав HSTS/nosniff/DENY/Referrer-Policy + `X-Robots-Tag: noindex` через `next.config.ts` (адмінський CSP поки не додано: строгий CSP потребує окремої nonce/hash-конфігурації Next.js 16 і не входить у цей підпункт)
  - [x] ✅ HSTS (`max-age=63072000; includeSubDomains`) — public + admin
  - [x] ✅ `X-Content-Type-Options: nosniff` — public + admin
  - [x] ✅ `X-Frame-Options: DENY` (+ `frame-ancestors 'none'` у public CSP) — public + admin
  - [x] ✅ `Referrer-Policy: strict-origin-when-cross-origin` — public + admin
  - [x] ✅ **Базовий CSP** (public сайт) — строгі `script-src`/`connect-src`/`style-src`/`font-src` + `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`. `connect-src` включає `wss://*.supabase.co` (Realtime). `img-src https:` — свідомо широкий, бо продукт дозволяє довільні URL фото рецептів + Google OAuth аватарки (`lh3.googleusercontent.com`)
  - [x] ✅ **`script-src` БЕЗ `'unsafe-inline'`** (24.07.2026) — виконано вимогу roadmap. Рефакторинг: inline anti-FOUC theme-скрипт → спільний `js/theme-init.js` (синхронно в `<head>`, без FOUC); inline module scripts (cookies/404) → `js/cookies-page.js`, `js/not-found-page.js`; `onclick` у `500.html` → `js/error-page.js`; inline `onsubmit` у 4 auth-формах прибрано (дублювали наявний `addEventListener('submit')`+preventDefault); inline-handlери з JS-шаблонів (`product-guide.js` onerror → `.onerror=`, `recipe-modal.js` upload onclick → `addEventListener`, `profile.js` delete onclick → делегування на контейнер). `style-src` свідомо лишає `'unsafe-inline'` (сайт активно юзає inline/dynamic styles; roadmap вимагав прибрати саме для скриптів)
    - [x] ✅ `js/theme-init.js` та інжектовані `offline-indicator`/`back-to-top` підключено АБСОЛЮТНИМИ шляхами (`/js/…`) — інакше на rewrite-маршруті `/recipe/:slug` відносний `js/…` резолвиться у `/recipe/js/…` (404) і anti-FOUC/скрипти мовчки не працюють. `build.js` теж інжектить абсолютно + dedup за іменем файла
    - [x] ✅ `theme-init.js` знімає `no-transition` після першого рендеру (double rAF) — інакше колірні transitions лишались би вимкненими назавжди (регресія на profile/cookbook/recipes/shopping-list, які раніше цей клас не отримували; раніше знімав лише `recipe-page.js`)
    - [x] ✅ Повторюваний тест `scripts/csp-theme-check.mjs` (headless Chrome + CSP-заголовок з vercel.json; rewrite-маршрути емулюються з конфігу, не хардкод): на 10 сторінках, включно з `/recipe/test-slug` — **0 CSP violations**; три глобальні виправлені скрипти (theme-init/offline-indicator/back-to-top) не дають 404 на маршруті рецепта; `data-theme=dark` присутнє після завантаження (правильний anti-FOUC порядок гарантує синхронний `theme-init.js` у `<head>` перед CSS — тест не фіксує буквально перший paint); `no-transition` знято після завантаження — усе PASS. Плюс 0 inline `<script>`/handler-атрибутів (grep-sweep); функціональні DOM-тести auth-submit / activity-delete-делегування / recipe-upload / product-onerror — PASS
    - [ ] ⚠️ Ручна перевірка на живому деплої після коміту: login/register/reset, 500 retry, 404 random recipe, cookies reopen, recipe image picker, profile activity delete, product image fallback, shopping-list realtime (локально Supabase-дані недоступні)
- [ ] **Rate limiting** через Vercel Edge Middleware — ⚠️ **аудит (29.07.2026): Login/Signup/Recipe reports НЕ проходять через наш Vercel-домен**, тому Middleware їх фізично не бачить і не може лімітувати:
  - [ ] ~~Login (5/хв) / Signup (3/хв з IP)~~ → `supabase.auth.signInWithPassword`/`signUp` ідуть напряму з браузера в Supabase Auth, не через наш домен. Лімітується в Supabase Dashboard → Auth → Rate Limits, АЛЕ два окремі числа "5/хв login" і "3/хв signup" там неможливо виставити буквально: sign-in і sign-up діляться одним per-IP bucket на 5-хвилинне вікно (Supabase docs, `sign_in_sign_ups`). Перевірити фактичні ліміти в дашборді перед launch, а не покладатись на цифри з цього roadmap
  - [ ] Webhook endpoints → ще не існують (з'являться у Фазі 19, лімітувати разом з ними)
  - [ ] AI scan (за тарифом) → ще не реалізовано (TIER 3, Фаза 36)
  - [x] ✅ **Recipe creation (10/хв на користувача, 29.07.2026)** — єдиний пункт, що реально йде через наш `/api/*`. `check_rate_limit` RPC (advisory-lock, той самий патерн що `reserve_moderation_slot` Фази 18) підключено в `api/save-recipe.js`, лімітує лише `editingRecipeId===null` (створення, не редагування). Рахує СПРОБИ створення (виклик до серверної валідації), не лише успішно збережені рецепти — свідомо: типова anti-spam поведінка. Fail-open на DB-помилку. Toast `rmRateLimited` у 3 мовах. Мок-тест 30/30 (`npm run test:save-recipe`) — доводить лише поведінку handler, НЕ живу RPC
    - [x] ✅ **GDPR-очищення (29.07.2026):** `api_rate_limits.user_id` → `REFERENCES auth.users ON DELETE CASCADE` + явний DELETE в `hard_delete_user_data()` v3 (`20260729_1100`, покриває заразом і пропущений раніше `recipe_ratings`). Глобальний cleanup `cleanup_api_rate_limits()` (не per-user-on-hit — той підхід лишав рядки неактивних юзерів назавжди) — **не підключений до крону**, викликати вручну або додати в `vercel.json` crons поруч з `gdpr-hard-delete`
    - [ ] ⚠️ **Міграції `20260729_1000` + `20260729_1100` чекають ручного застосування в Supabase** — після застосування обов'язковий живий integration smoke-test: викликати `check_rate_limit` RPC напряму (не мок), перевірити GRANT на `service_role`, прогнати паралельний burst і підтвердити, що advisory-lock реально серіалізує. Мок-тест цього не доводить
  - [ ] Recipe reports (5/год на користувача) → `supabase.from('recipe_reports').insert()` пишеться напряму з клієнта під RLS, тому конкретно Vercel Middleware тут не варіант. Два шляхи (не зроблено, окрема задача): (а) новий серверний endpoint `/api/report-recipe` + міграція, що забороняє прямий client-side insert — якщо ліміт обов'язково має йти через Vercel; (б) або лишити insert клієнтським і зробити ліміт атомарним у SQL — RLS/тригер/RPC на кшталт `check_rate_limit`, що рахує рядки `recipe_reports` цього юзера за вікно і відхиляє insert понад ліміт. (б) простіше і не потребує нового API-файлу
- [ ] ⚠️ **Частково — Secret management**: аудит `.gitignore` (24.07.2026)
  - [x] ✅ `.env`/`*.env`/`.env.*` ігноруються (додано `.env.*` + `!.env.example`), 0 `.env` у git/history
  - [x] ✅ 0 `service_role`/SERVICE_ROLE_KEY у клієнтському коді (лише `process.env` у server API)
  - [ ] Розділити preview/production env у Vercel dashboard (ручне)
- [ ] Supabase: аудит RLS, service_role тільки на сервері

### 🌳 Environment management

- [ ] **Production:** `mintofood.com` (main branch, prod Supabase)
- [ ] **Staging:** `staging.mintofood.com` (staging branch, окремий Supabase project)
- [ ] Preview deployments — автоматично для PR
- [ ] Environment vars окремі для кожного середовища
- [ ] Seed-скрипт для staging БД

### 🚀 CI/CD

- [ ] Vercel deploy з git push ✅ за замовчуванням
- [ ] **Branch protection** на GitHub: main вимагає PR review (від себе самої — заради дисципліни)
- [ ] Lint + format на pre-commit (Husky + Prettier)
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
> **Статус:** провайдер-агностичний пайплайн реалізовано. Після аудиту (25.07.2026) архітектуру **переписано** — три критичні діри закрито (див. нижче). Лишилось: зареєструвати провайдера (env-ключ) + ручний E2E на deployed URL + застосувати міграцію.
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
- [ ] Застосувати міграцію `20260724_1000_image_moderation.sql` у Supabase вручну
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
- [ ] Якщо Paddle/LS → вони все роблять ✅
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

### 📋 Структура футера

Класичний 4-колонковий layout, акордеон на мобайлі.

**Продукт:** Логотип + tagline / Меню на день / Меню на тиждень / Рецепти / Путівник / Книга рецептів
**Компанія:** Про нас / Pricing / _(Блог, Press, Affiliate → TIER 2/3)_
**Підтримка:** Help/FAQ / Contact (`mailto:support@`) / Feedback / _(Status → TIER 3)_
**Юридичне:** Privacy / Terms / Cookies / Imprint / DMCA / GDPR data export

### 🔻 Нижня лінійка

- [ ] © 2026 MintoFood
- [ ] Made with 🌿 + Made in Poland & Ukraine
- [ ] Версія / build hash (для дебагу)
- [ ] Компанія / NIP (EU compliance)

### 📱 Соцмережі + Локалізація + Тема

- [ ] Іконки IG / TikTok / YouTube / Pinterest
- [ ] `target="_blank"` + `rel="noopener noreferrer"`
- [ ] Перемикач мови (якщо не в хедері)
- [ ] (Опційно) перемикач теми

### 📨 Newsletter signup

- [ ] Email input + кнопка
- [ ] `newsletter_subscribers` таблиця
- [ ] Інтеграція з Resend
- [ ] Double opt-in (compliance)

### 📐 Версти

- [ ] Desktop: 4 колонки + bottom row
- [ ] Tablet: 2x2
- [ ] Mobile: акордеон
- [ ] Padding 60-80px, border-top, var(--color-bg-secondary)
- [ ] Тест на світлій + темній теміi

### 🎯 Розмістити

- [ ] На всіх public сторінках включно з `/recipe/{slug}` (важливо для SEO + trust)
- [ ] НЕ в адмінці / login modals / onboarding

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
  - [ ] Дрібний баг (не блокер): profile.html без логіну рендерить усі секції табів стосом (initProfileTabs викликається лише після auth) — за модалкою логіну; поправити при нагоді
  - [ ] Примітка: дані з Supabase локально не завантажились (0 рецептів/продуктів) — empty states при цьому виглядають правильно; перевірити завантаження даних на deployed URL
- [ ] **Мобільний QA на реальних пристроях:**
  - [ ] iOS Safari (BrowserStack або реальний iPhone)
  - [ ] Android Chrome
  - [ ] iPad Safari
- [ ] Тест workflow адмінки (закрити хвости з Фази 10.5)
- [ ] Тест penetration адмінки (не-admin → redirect, anon → 403)
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

- [ ] Реєстрація SW (буде в Фазі 25 PWA)
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

> Зберігаємо повністю всю Фазу 19 з оригінального roadmap. No-IAP strategy, anti-steering compliance. Не повторюю детально тут — див. оригінал.

### Quick summary

- [ ] PWA fundamentals: manifest, SW, Lighthouse PWA 90+
- [ ] TWA через Bubblewrap, Digital Asset Links
- [ ] Google Play Console setup ($25), Verification
- [ ] Графічні матеріали, store listing у 3 мовах
- [ ] **No-IAP compliance audit** (жодних згадок про Premium в app)
- [ ] Beta testing → staged rollout 5% → 20% → 50% → 100%
- [ ] Deep linking з web на app

> ⏰ ~6-8 тижнів від PWA до публічного релізу

---

## 🔎 ФАЗА 27: Search optimization

> Якщо буде >500 рецептів — Postgres LIKE/ilike починає гальмувати. Готуємось завчасно.

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
- [ ] Rich Pins (Pinterest читає Schema.org Recipe — вже ✅)
- [ ] Цільовий KPI: 100K monthly impressions за 6 міс

### 📝 Blog (опційно)

- [ ] `/blog` секція (можна на тому ж домені)
- [ ] 2 пости/тиждень: "How to count calories accurately", "5 myths about carbs"
- [ ] Internal linking на recipes
- [ ] SEO clusters: "healthy breakfast" → 5-10 пов'язаних статей

---

## 🎨 ФАЗА 29: Design governance (НОВА)

> Без цього через 8 міс UI почне "плисти" — різні кнопки, різні spacing, regression повзе.

- [ ] **Component inventory** — Storybook або просто `/dev/components.html` сторінка з усіма компонентами в дії
- [ ] **Forbidden patterns** список (`docs/design-rules.md`):
  - [ ] No custom spacing outside scale (4/8/12/16/20/24/32/40/56)
  - [ ] No arbitrary border-radius (тільки 12/16/20)
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
| TIER 0 | 0-10.7 | вже зроблено           | ✅ 95% done        |
| TIER 1 | 11-22  | 8-12 тижнів            | Pre-launch         |
| TIER 2 | 23-30  | 12-16 тижнів (3-4 міс) | Post-launch growth |
| TIER 3 | 31-37  | 6-12 місяців           | Scale stage        |

**Бюджет TIER 1:** ~$0-50/рік (iubenda/Termly план) + ~$50-100/міс (Vercel Pro + Supabase Pro + email + monitoring)

---

## 🎯 Ключові принципи v2

1. **Customer validation first.** 10 інтерв'ю перед Stripe — це не "втрачений час", це найкраще ROI з усього roadmap.
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

_Останнє оновлення: травень 2026 (v2 після аудиту)_
