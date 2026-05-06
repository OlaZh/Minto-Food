# 🌿 MintoFood — Roadmap редизайну

> **Статус:** Старт квітень 2026  
> **Палітра:** Соковита м'ята (`#a6d6b8` / `#b8e0c5` / `#4ab584` / `#82bf99` / `#0f2818`)  
> **Принцип:** No MVP thinking. Робимо одразу правильно і фундаментально.  
> **НЕ чіпаємо:** шрифти (Fraunces/Rubik/Mulish), лого, існуючі кольори світлої та темної тем.

---

## 🧭 Форм-система проєкту

Правило premium-додатків (Apple Health, Noom, Lifesum): максимум **2 форми + 1 драматичний акцент**.

- **Rounded rectangles** (r=12–20px) — картки, кнопки, поля, контейнери
- **Одне кільце на сторінку** — тільки для головного показника (наприклад, калорії на "Меню на день")

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

---

## 🏗 ФАЗА 1: Layout-система (каркас)

- [x] ✅ Стандартний десктопний хедер (залишити як є)
- [x] ✅ Стандартний підхедер: заголовок сторінки / breadcrumbs
- [x] ✅ Мобільний хедер (компактний)
- [x] ✅ Мобільний таб-бар: 5 іконок + "Ще" (6-та сторінка)
- [x] ✅ "Ще" — bottom sheet або окрема сторінка
- [x] ✅ Базовий 4-колонковий грід для dashboard
- [x] ✅ Responsive breakpoints: 1200 / 1024 / 768 / 480 px

---

## 🏠 ФАЗА 2: Сторінка "Меню на день"

**Інфраструктура (готово):**

- [x] ✅ Таблиця `user_streaks` в Supabase
- [x] ✅ Функція `get_current_streak()`
- [x] ✅ Автотригер на `meals` для оновлення streak
- [x] ✅ Бекфіл історичних даних виконано

**Верстка:**

- [x] ✅ Горизонтальні дні тижня (pills) під хедером
- [x] ✅ Ліва колонка: велике кільце калорій + streak
- [x] ✅ Центральна колонка: прийоми їжі як аккордеони + разом за день
- [x] ✅ Вузька колонка води: капсула + кнопки +0.25/+0.5/+0.75
- [x] ✅ Права колонка: макро прогрес-бари (Б/Ж/В) + швидкі дії
- [x] ✅ Мобільна версія (1 колонка, компактні плашки КБЖУ/вода/серія, таб-бар знизу)

**JS:**

- [x] ✅ Streak-логіка (`js/streak.js`)
- [x] ✅ Аккордеон-логіка для прийомів їжі
- [x] ✅ Швидкі дії: "Копіювати день", "Вставити день", "Очистити день" (3-крапки меню в заголовку)
- [x] ✅ Тест світлої теми
- [x] ✅ Тест темної теми

---

## 📅 ФАЗА 3: Сторінка "Меню на тиждень"

- [x] ✅ Застосувати нові токени до матриці "дні × прийоми"
- [x] ✅ Дні тижня як pills (консистентно з "Меню на день")
- [x] ✅ Оновити "Разом" колонку під нову систему
- [x] ✅ "Копіювати тиждень" / "Вставити тиждень" — оновити
- [x] ✅ Мобільна версія (аккордеони прийомів їжі, сітка "Весь тиждень" з крапками, навігація по днях)
- [x] ✅ Тест світлої теми
- [x] ✅ Тест темної теми

---

## 🍳 ФАЗА 4: Сторінка "Рецепти"

**Базова верстка:**

- [x] ✅ Картки рецептів до нового стандарту
- [x] ✅ Пошук + чіпи-фільтри під нові токени
- [x] ✅ Рейтинги зірочками (перевірити/оновити)
- [x] ✅ Порожній стан (empty state) з CTA-кнопкою
- [x] ✅ Мобільна версія (2 колонки карток)
- [x] ✅ Тест світлої теми
- [x] ✅ Тест темної теми

**Хедер сторінки:**

- [x] ✅ `[🔥 Нові рецепти]` — `Рецепти` (центр) — `[+ Додати рецепт]`

**🔥 Нові рецепти (drawer):**

- [x] ✅ Drawer справа / bottom sheet на мобільному
- [x] ✅ Рецепти за останні 24 години, без фото
- [x] ✅ Свіжіші (до 2 год) — вгорі, автор бачить свій першим
- [x] ✅ Сортування за рейтингом всередині груп

**Browsing (без пошуку):**

- [x] ✅ Секція "Твої рецепти (N)" — горизонтальний рядок зверху
- [x] ✅ Секція "Загальна база (N)" — основна сітка нижче

**Пошук:**

- [x] ✅ Секція "Мої (N)" + кнопка "Показати всі"
- [x] ✅ Секція "Загальні (N)" + кнопка "Показати всі"
- [x] ✅ Якщо в "Мої" нічого — секція зникає

---

## 🥦 ФАЗА 5: Сторінка "Путівник по продуктах"

- [x] ✅ Оновити картки продуктів (вертикальні, той самий стиль що рецепти)
- [x] ✅ Пошук + чіпи фільтрів
- [x] ✅ Розширені фільтри (Харч. цінність / Глікемічний індекс / Тип / Призначення / Обмеження)
- [x] ✅ Модалка деталей продукту
- [x] ✅ Мобільна версія (2 колонки, як рецепти)
- [x] ✅ Тест світлої теми
- [x] ✅ Тест темної теми

---

## 🛒 ФАЗА 6: Сторінка "Список покупок"

- [x] ✅ Групування по категоріях
- [x] ✅ Чекбокси під нову систему
- [x] ✅ Прогрес "4/9 куплено" — pill-стиль
- [x] ✅ Права колонка дій — "Поділитися", "Очистити", "Друкувати"
- [x] ✅ Додати продукт (швидкий ввід)
- [x] ✅ Мобільна версія
- [x] ✅ Тест світлої теми
- [x] ✅ Тест темної теми

---

## 📚 ФАЗА 7: Сторінка "Книга рецептів"

- [x] ✅ Оновити картки книг
- [x] ✅ "Нещодавно переглянуті" збоку
- [x] ✅ Модалка книги під форм-систему
- [x] ✅ Нотатки, стікери — під нову систему
- [x] ✅ Мобільна версія
- [x] ✅ Тест світлої теми
- [x] ✅ Тест темної теми

---

## 👤 ФАЗА 8: Профіль + підсторінки

- [x] ✅ **Layout + Sidebar** — sidebar → єдина карта-навігація, на мобільному → горизонтальний таб-бар
- [x] ✅ **Мої дані** — форма параметрів, Денна норма справа, BMI-аналіз
- [x] ✅ **Контроль ваги** — запис ваги, графік, прогрес до цілі
- [x] ✅ **Активність** — додавання активностей, сьогодні + баланс, фільтр по датах, графік
- [x] ✅ **Статистика** — діаграми, динаміка КБЖУ, топи, рекомендації
- [x] ✅ **Налаштування** — тема, мова, одиниці, email/ім'я, sign-out, видалення акаунту
- [x] ✅ Streak в профілі (current + longest_streak в sidebar)
- [x] ✅ Мобільна версія всіх підсторінок (таб-бар зверху, layout 1-колонка)
- [x] ✅ Тест світлої теми
- [x] ✅ Тест темної теми

---

## 🧭 ФАЗА 9: Навігація та авторизація

- [x] ✅ Хедер — фінальний вигляд з аватаркою / login
- [x] ✅ Модалка логіну/реєстрації — під нову систему
- [x] ✅ Мобільний таб-бар — 5 іконок + "Ще"
- [x] ✅ Сторінка/меню "Ще" — Путівник, Книга рецептів, Профіль

---

## ✅ ФАЗА 10: Фінальний поліш

- [ ] Повний огляд усіх сторінок у світлій темі
- [ ] Повний огляд усіх сторінок у темній темі
- [x] ✅ Skeleton-loaders замість spinners (рецепти, путівник, книга рецептів)
- [x] ✅ Empty states на всіх сторінках (рецепти, путівник, список покупок, cookbook)
- [x] ✅ Error states (коли API відвалився) — рецепти, путівник
- [x] ✅ Анімації переходів між станами (fade-in при завантаженні карток)
- [x] ✅ Accessibility audit (focus states, ARIA, контраст) — :focus-visible глобально
- [x] ✅ Performance audit (image lazy-load — все коректно, logo above-fold не lazy)
- [ ] Мобільний QA на реальних пристроях (iOS Safari, Android Chrome)

---

## 🛡 ФАЗА 10.5: Адмінка — Центр модерації

> **Мета:** закрити критичну діру в продакшні — обробити скарги юзерів (`recipe_reports` уже працює, але дані лежать без модерації) і модерувати UGC (рецепти + юзерські продукти).
> **Принцип:** desktop-first. Адмінка — професійний tool, не для мобайлу. На <1024px показуємо повідомлення "Адмінка доступна на десктопі".
> **URL:** `/admin.html`, доступ через `profiles.is_admin = true`.

---

### 🗄 Інфраструктура БД (фундамент)

- [ ] Колонка `is_admin BOOLEAN DEFAULT false` в `profiles`
- [ ] Колонка `is_banned BOOLEAN DEFAULT false` в `profiles`
- [ ] Колонка `status TEXT DEFAULT 'pending'` в `recipe_reports` (`pending` / `resolved` / `dismissed`)
- [ ] Колонка `resolved_by UUID REFERENCES auth.users(id)` в `recipe_reports`
- [ ] Колонка `resolved_at TIMESTAMPTZ` в `recipe_reports`
- [ ] Таблиця `admin_actions` для аудиту (хто-що-коли-навіщо) — опційно, але дуже бажано для глобального продукту
- [ ] Встановити `is_admin = true` для власного user_id вручну через SQL

### 🔒 RLS-політики

- [ ] `recipe_reports`: SELECT / UPDATE / DELETE для `is_admin = true`
- [ ] `recipes`: UPDATE (status, content) / DELETE для адмінів — додатково до існуючих політик власника
- [ ] `products`: UPDATE / DELETE для адмінів (модерація юзерських продуктів)
- [ ] `profiles`: SELECT всіх юзерів / UPDATE `is_banned` та `is_admin` для адмінів
- [ ] Тест: звичайний юзер НЕ має доступу до жодної admin-операції (через REST і через Postman)
- [ ] Тест: anon ключ не дає доступу навіть з `is_admin=true` (бо `auth.uid()` = NULL)

### 🚪 Routing & Auth

- [ ] Створити `/admin.html` (skeleton)
- [ ] У `js/auth.js` додати helper `async function isAdmin()` (читає `profiles.is_admin` для поточного юзера, кешує результат на сесію)
- [ ] Захист сторінки: на завантаженні перевірка `isAdmin()` → якщо `false` → redirect на `index.html`
- [ ] Лінк "Адмінка" в хедері (видимий тільки якщо `is_admin=true`)
- [ ] Лінк "Адмінка" в мобільному меню "Ще" (видимий тільки для адмінів)

### 🎨 Layout

- [ ] Sidebar з 4 вкладками: 🚩 Скарги / 🍳 Рецепти / 🥦 Продукти / 👥 Юзери
- [ ] Кожна вкладка з лічильником-badge (невирішене / нове)
- [ ] Top stats bar: 4 pills з ключовими метриками (постійно зверху)
- [ ] Mobile (<1024px): "Адмінка доступна на десктопі" + лінк назад на index
- [ ] SCSS-партіал `scss/pages/_admin.scss` (reuse форм-системи з ФАЗИ 0)
- [ ] Color coding для типів скарг: `copyright` червоний, `spam` помаранчевий, `inappropriate` пурпурний, `incorrect` синій, `other` сірий

### 🚩 Секція 1: Скарги (СТАРТУЄМО ТУТ)

- [ ] Список `recipe_reports WHERE status='pending'` + JOIN на `recipes` (превʼю/назва) і `profiles` (автор + reporter)
- [ ] Сортування: за датою (нові зверху) / за типом / групування за `recipe_id` (якщо >1 скарга на 1 рецепт — згорнути в одну картку)
- [ ] Фільтри: тип скарги, статус (pending/resolved/dismissed), діапазон дат
- [ ] Card per report: превʼю рецепту + автор + тип (color-coded pill) + коментар reporter-а + дата
- [ ] Дії per report:
  - [ ] **Відхилити скаргу** → `status='dismissed'` + `resolved_by` + `resolved_at`
  - [ ] **Прибрати з публіки** → `recipe.status='draft'` + report → `resolved`
  - [ ] **Видалити рецепт** → DELETE recipe (cascade reports), confirmation модалка
  - [ ] **Бан автора** → `profile.is_banned=true` + автоматичне auto-resolve усіх його pending reports + його опубліковані рецепти → `draft`
- [ ] Bulk actions: чекбокси + "Відхилити всі вибрані" / "Вирішити всі вибрані"
- [ ] Превʼю рецепту в правому drawer (reuse `recipe-modal.js` у read-only режимі)
- [ ] Empty state: "Усе чисто 🌿" коли `pending = 0`

### 🍳 Секція 2: Нові рецепти (proactive moderation)

- [ ] Список `recipes WHERE status='published'` за останні 7 днів (default, можна змінити)
- [ ] Фільтри: категорія, мова (`name_ua`/`en`/`pl`), автор (search input), є фото / нема, є інгредієнти / нема
- [ ] Сортування: за датою / за автором (групування) / за рейтингом
- [ ] Quick actions per row:
  - [ ] Перевести в `draft`
  - [ ] Видалити (з confirmation)
  - [ ] Edit (відкрити `recipe-modal` в режимі редагування)
- [ ] Превʼю рецепту в drawer
- [ ] Spam detection: підсвітити автора червоним якщо він створив >10 рецептів за день
- [ ] Пошук по назві/інгредієнтах

### 🥦 Секція 3: Юзерські продукти

- [ ] Список `products WHERE user_id IS NOT NULL`
- [ ] Виявлення дублів через `pg_trgm` similarity (RPC-функція `find_similar_products(name_ua)`)
- [ ] Колонка "Схоже на" — autosuggest з існуючих загальних продуктів
- [ ] Quick actions:
  - [ ] **Схвалити** → `user_id = NULL` (продукт стає загальним)
  - [ ] **Edit КБЖУ** inline (бо часто це саме помилка нутриції)
  - [ ] **Видалити**
  - [ ] **Обʼєднати з існуючим** → модалка пошуку, переносить usage у `product_recipe`/`meals` на target product, потім DELETE source
- [ ] Фільтри: категорія, мова, є фото / нема

### 👥 Секція 4: Користувачі (light)

- [ ] Пошук за email/name з debounce 300ms
- [ ] Таблиця: email, дата реєстрації, кількість рецептів (COUNT з `recipes`), `is_banned`, last_active (з `meals.created_at` MAX)
- [ ] Дії: бан/розбан / видалити акаунт / toggle `is_admin`
- [ ] Click row → детальна сторінка зі статистикою юзера (опційно, можна додати в наступному циклі)

### 📊 Top stats bar (видимий у всіх секціях)

- [ ] **Pill 1:** невирішених скарг (червоний фон якщо >0)
- [ ] **Pill 2:** нових опублікованих рецептів сьогодні
- [ ] **Pill 3:** активних юзерів за 7 днів (DISTINCT `user_id` з `meals`)
- [ ] **Pill 4:** юзерських продуктів на модерації (`products WHERE user_id IS NOT NULL`)
- [ ] COUNT-запити з кешем на 5 хв у `localStorage` (щоб не спамити Supabase при перемиканні вкладок)

### 🧱 JS-модулі

- [ ] `js/admin.js` — головний контролер + routing між вкладками
- [ ] `js/admin-reports.js` — секція 1
- [ ] `js/admin-recipes.js` — секція 2
- [ ] `js/admin-products.js` — секція 3
- [ ] `js/admin-users.js` — секція 4
- [ ] `js/admin-stats.js` — top stats bar
- [ ] `js/admin-utils.js` — admin guard, confirmation модалка, bulk select helper, action logger

### 🛡 Безпека

- [ ] ВСІ admin-запити захищені RLS — не покладатися тільки на front-end `isAdmin()` перевірку
- [ ] Confirmation модалка для всіх destructive дій (видалити, бан)
- [ ] Логування destructive дій у `admin_actions` (target_table, target_id, action_type, payload, admin_id, created_at)
- [ ] Тест penetration: відкрити `/admin.html` без авторизації / з не-admin акаунту → redirect
- [ ] Тест: викликати admin RPC через Postman з anon key → 403

### ✅ QA

- [ ] Тест світлої теми
- [ ] Тест темної теми
- [ ] Тест RLS: звичайний юзер не може робити admin-операції (через UI і через прямі API виклики)
- [ ] Тест workflow: юзер скаржиться → скарга в адмінці → "Прибрати з публіки" → рецепт зникає з "Загальної бази"
- [ ] Тест каскаду: видалення рецепту → автоматичне видалення повʼязаних reports
- [ ] Тест бану: бан юзера → усі його published рецепти стають draft, нові скарги на нього auto-resolved
- [ ] Тест bulk actions: атомарність (або всі, або жодна)
- [ ] Тест empty states у всіх секціях

---

## 🧹 ФАЗА 11 (опційно): Чистка бази даних

- [ ] Розібратись з `profiles` vs `user_profiles` (мерджити?)
- [ ] Видалити `old_products` (якщо мертва таблиця)
- [ ] Видалити `recipetest` (якщо тестова)
- [ ] Розібратись з дублем `cookbook_notes` / `cookbook_n...`
- [ ] Аудит всіх RLS-політик

---

## 💳 ФАЗА 12: Монетизація — тріал та підписка

> **Модель:** 3 дні безкоштовний тріал → місячна підписка (можна додати річну зі знижкою для збільшення LTV).
> **Ключове рішення перед стартом:** Stripe vs Paddle/LemonSqueezy (MoR) — впливає на роботу з VAT в ЄС.
> **Принцип:** ніяких race conditions з webhooks. Усе через `subscription_events` для idempotency.

---

### 🤔 Перед стартом — рішення про провайдера

- [ ] **Вибрати:** Stripe (повний контроль + сама VAT) АБО Paddle/LemonSqueezy (MoR — вони беруть VAT на себе)
- [ ] Зареєструвати акаунт + пройти KYC (для Stripe — займає до 7 днів)
- [ ] Налаштувати business profile, brand (logo, support email, return policy URL)
- [ ] Вирішити pricing: тільки місячна, чи місячна + річна (річна зі знижкою 30-40% — стандарт)
- [ ] Вирішити валюти: одна (USD?) чи мульти (PLN, EUR, USD, UAH)

### 🗄 Інфраструктура БД

- [ ] Колонки в `profiles`:
  - [ ] `subscription_status TEXT DEFAULT 'free'` (`free` / `trialing` / `active` / `past_due` / `canceled` / `incomplete`)
  - [ ] `subscription_id TEXT` — ID підписки в провайдері
  - [ ] `customer_id TEXT` — ID клієнта в провайдері (для Customer Portal)
  - [ ] `trial_ends_at TIMESTAMPTZ`
  - [ ] `current_period_end TIMESTAMPTZ`
  - [ ] `cancel_at_period_end BOOLEAN DEFAULT false`
  - [ ] `plan TEXT` (`free` / `monthly` / `yearly`)
- [ ] Таблиця `subscription_events` для idempotency (event_id, type, payload, processed_at)
- [ ] Таблиця `payment_history` (для UI "минулі платежі" + bookkeeping)
- [ ] RLS: юзер бачить тільки свої події/історію, адмін — все

### 🛒 Провайдер: продукти та ціни

- [ ] Створити Product "MintoFood Premium" в провайдері
- [ ] Price "Monthly" з `trial_period_days=3`
- [ ] (Опційно) Price "Yearly" з тим же тріалом
- [ ] Налаштувати tax behavior: `inclusive` чи `exclusive` (важливо для UI відображення)
- [ ] Customer Portal — увімкнути в Stripe (для self-service: cancel, change card, see invoices)

### 🔌 Webhook handler (Vercel serverless)

- [ ] `/api/webhooks/stripe.js` (Vercel API route)
- [ ] **Signature verification** (Stripe-Signature header) — без цього хто-завгодно може підробити подію
- [ ] **Idempotency:** перевіряти `event.id` у `subscription_events`, якщо вже є — return 200, не обробляти двічі
- [ ] Обробляти події:
  - [ ] `checkout.session.completed` → завести `subscription_id`, `customer_id`, `trial_ends_at`, status='trialing'
  - [ ] `customer.subscription.updated` → оновити status, period_end, cancel_at_period_end
  - [ ] `customer.subscription.deleted` → status='canceled', через певний час → 'free'
  - [ ] `invoice.paid` → продовжити `current_period_end`, додати в `payment_history`
  - [ ] `invoice.payment_failed` → status='past_due', тригер email
- [ ] Logging усіх подій (для debug)
- [ ] Зберігати webhook secret у Vercel env vars (не комітити!)

### 🚪 Checkout flow

- [ ] Кнопка "Спробувати безкоштовно" → виклик `/api/create-checkout-session`
- [ ] Vercel function створює Stripe Checkout Session з `success_url` + `cancel_url`
- [ ] Redirect на Stripe Checkout (hosted)
- [ ] Після успіху → redirect на `/welcome.html` з показом "Тріал активовано на 3 дні 🌿"
- [ ] Прив'язка до `auth.uid()`: Stripe customer створюється з email + metadata `{ user_id: ... }`

### 🔐 Paywall — що за платним муром

> ⚠️ **Це бізнес-рішення.** Те, що в free, має бути achievable, але обмежено. Premium = безмежність + AI.

Чернетка (треба фіналізувати):

- **Free:**
  - [ ] До 10 власних рецептів
  - [ ] Ручне внесення прийомів їжі
  - [ ] Меню на день / тиждень — до 7 днів історії
  - [ ] Список покупок
  - [ ] Книга рецептів — 1 книга
  - [ ] Базовий путівник по продуктах
- **Premium:**
  - [ ] Безмежно власних рецептів
  - [ ] AI-розпізнавання рецептів зі скріншотів (з лімітом на день — 20-50 сканів)
  - [ ] Безмежна історія КБЖУ + графіки
  - [ ] Безмежно книг рецептів
  - [ ] Експорт даних (PDF, CSV)
  - [ ] Розширені фільтри в путівнику
  - [ ] Family sharing (опційно)

### 🧱 JS / Helpers

- [ ] `js/subscription.js` — отримання поточного статусу, кеш на сесію
- [ ] `js/paywall.js` — helper `requirePremium(featureName)` → показує upgrade модалку якщо free
- [ ] `js/stripe-checkout.js` — wrapper для створення сесії checkout
- [ ] Всі premium-only фічі в коді обернути в `requirePremium()` guard

### 🎨 UI

- [ ] **Pricing page** `/pricing.html` (3 мови: ua/en/pl, валюти за геолокацією або вибором)
  - [ ] Toggle Monthly / Yearly з показом економії
  - [ ] Free vs Premium comparison table
  - [ ] FAQ (тріал як працює, скасування, refund policy)
- [ ] **Upgrade модалка** — викликається при тригері paywall, contextually пояснює чому ця фіча Premium
- [ ] **Account → Підписка** в профілі:
  - [ ] Поточний план + статус + дата наступного списання
  - [ ] Кнопка "Управляти підпискою" → Customer Portal
  - [ ] Історія платежів (з `payment_history`)
- [ ] **Banner "Trial ends in N days"** в хедері (показується останні 2 дні тріалу)
- [ ] **Banner "Payment failed"** якщо `past_due` (з кнопкою "Оновити карту")
- [ ] **Banner "Cancellation scheduled"** якщо `cancel_at_period_end=true` з можливістю reactivate

### 📧 Transactional emails (потребує email-провайдера — див. далі)

- [ ] Welcome (after signup)
- [ ] Trial started (after checkout)
- [ ] Trial ending in 2 days ⚠️ (сильно знижує churn)
- [ ] Trial ended → first payment
- [ ] Payment receipt (після кожного списання)
- [ ] Payment failed (з посиланням на Customer Portal)
- [ ] Subscription canceled (з можливістю reactivate)
- [ ] Subscription reactivated
- [ ] Усі шаблони у 3 мовах

### 💸 Tax/VAT

- [ ] **Якщо Stripe:** увімкнути Stripe Tax АБО налаштувати руками VAT MOSS (Польща → ЄС)
- [ ] **Якщо Paddle/LS:** вони все роблять самі ✅
- [ ] Перевірити з польським бухгалтером, як це все ляже на JDG/spółkę
- [ ] Зберігати VAT-receipts (Stripe генерує, але треба архівувати)

### 🔄 Refunds & disputes

- [ ] Сформулювати refund policy (зазвичай 7 днів no-questions-asked)
- [ ] Опублікувати на pricing page + у ToS
- [ ] Обробляти chargebacks через dashboard провайдера

### 🧪 Тестування

- [ ] Stripe test mode + test cards (`4242 4242 4242 4242`)
- [ ] Test 3DS challenge (`4000 0027 6000 3184`)
- [ ] Test failed payment (`4000 0000 0000 0002`)
- [ ] Тест webhook idempotency: повторно відправити подію — не має дублюватися
- [ ] Тест повного flow: signup → trial → first payment → cancel → free
- [ ] Тест paywall на всіх premium-фічах
- [ ] Тест банера "trial ending"

### 📊 Metrics для трекінгу

- [ ] Trial-to-paid conversion rate (KPI #1)
- [ ] Monthly churn rate
- [ ] LTV (lifetime value)
- [ ] MRR (monthly recurring revenue)
- [ ] Failed payment rate
- [ ] Reactivation rate

---
# 🚀 Pre-Launch блок — Фази 13-16

> Ці фази повинні бути готові ДО публічного запуску. Без них глобальний продукт або юридично вразливий, або сліпий, або невидимий у пошуку, або втрачає юзерів на онбордингу.

---

## ⚖️ ФАЗА 13: Юридичне + GDPR

> **Контекст:** ти базуєшся в ЄС → GDPR обов'язковий. Штрафи реальні (до €20M або 4% обороту), і compliance-перевірки трапляються після скарг від юзерів. Краще зробити все одразу.

### 📄 Документи

- [ ] Privacy Policy у 3 мовах (ua/en/pl) — описує які дані збираєш, навіщо, як зберігаєш, з ким ділишся (Supabase, Vercel, провайдер платежів, аналітика)
- [ ] Terms of Service у 3 мовах — правила користування, обмеження відповідальності, refund policy, припинення акаунту
- [ ] Cookie Policy у 3 мовах — які кукі, навіщо, як відключити
- [ ] Disclaimer "Не є медичною порадою" — на сторінках профілю, контролю ваги, активності, статистики
- [ ] Imprint / Impressum — обов'язково в ЄС (адреса, NIP, контакт)
- [ ] (Опційно) DMCA / copyright complaint procedure — для глобального продукту з UGC

### 🍪 Cookie consent banner

- [ ] Self-built АБО готове рішення (Cookiebot, Termly, Iubenda)
- [ ] Категорії cookies: Strictly Necessary / Analytics / Marketing
- [ ] Granular toggles (юзер може погодитися тільки на частину)
- [ ] Reject All — обов'язково на тому ж рівні, що і Accept All (у ЄС не можна "Accept All" робити більш видимим)
- [ ] Збереження вибору на 6-12 місяців
- [ ] Re-prompt при додаванні нових cookies

### 🔐 GDPR — права юзера

- [ ] **Data Export** — у профілі кнопка "Завантажити мої дані" → Vercel function збирає всі дані юзера з Supabase → JSON-файл
- [ ] **Right to be Forgotten** — повне видалення акаунту:
  - [ ] Видалення всіх даних з усіх таблиць (recipes, meals, cookbooks, reports тощо)
  - [ ] Soft-delete з 30-денним grace period (юзер може передумати)
  - [ ] Hard-delete після grace period
  - [ ] Анонімізація даних, які треба зберігати юридично (платежі, аудит)
- [ ] **Data Rectification** — юзер може правити свої дані (вже працює через профіль)
- [ ] **Data Portability** — експорт у машино-читаному форматі (JSON ✅)
- [ ] Логування всіх GDPR-запитів у `gdpr_requests` таблицю (compliance trail)

### 📑 Data Processing Agreements (DPA)

- [ ] DPA з Supabase (доступне в їх dashboard)
- [ ] DPA з Vercel (доступне в settings)
- [ ] DPA з провайдером платежів (Stripe/Paddle/LS — мають свої)
- [ ] DPA з email-провайдером (Resend і т.д.)
- [ ] DPA з аналітикою (PostHog має EU hosting)
- [ ] Список усіх sub-processors на окремій публічній сторінці `/privacy/processors`

### 🧒 Compliance specific edge cases

- [ ] Age gate at signup: "Тобі є 16+?" (у деяких країнах ЄС — 13/14/15, перевір по списку)
- [ ] Disclaimer для weight goals: якщо BMI < 18.5 або ціль <17 → попередження + посилання на лікаря
- [ ] Disclaimer для пенсіонерів/вагітних: "Перед застосуванням рекомендацій консультуйтеся з лікарем"

### ✅ QA

- [ ] Тест GDPR data export — отримуєш всі свої дані
- [ ] Тест GDPR delete — акаунт видаляється повністю
- [ ] Тест cookie banner — refuse all → не вантажиться analytics
- [ ] Тест: signup без accept Terms → блокується
- [ ] Юридичний review — рекомендовано пройти з юристом перед launch (~€200-500 одноразово)

---

## 📧 ФАЗА 14: Email-інфраструктура (Resend)

> **Чому Resend:** найкращий DX серед сучасних транзакційних провайдерів. React Email шаблони, простий API, EU-hosting. Альтернативи: Postmark (стабільніший, дорожчий), SendGrid (стандарт, громіздкий).

### 🛠 Setup

- [ ] Створити акаунт Resend
- [ ] Verify domain (`mintofood.com` або subdomain `mail.mintofood.com`)
- [ ] Налаштувати DNS:
  - [ ] **SPF** — дозволяє Resend відправляти від твого імені
  - [ ] **DKIM** — підпис листів (Resend дає ключі)
  - [ ] **DMARC** — політика для отримувачів (рекомендую `p=quarantine` спочатку, потім `p=reject`)
- [ ] Перевірити через mail-tester.com — має бути 10/10
- [ ] API key зберегти у Vercel env vars

### 📝 React Email шаблони

- [ ] Встановити `@react-email/components`
- [ ] Базовий layout-компонент з логотипом, кольорами бренду, footer-ом
- [ ] **Welcome** — після signup
- [ ] **Email confirmation** — Supabase Auth (можна кастомізувати їх default)
- [ ] **Password reset** — Supabase Auth
- [ ] **Trial started** — після першого checkout
- [ ] **Trial ending in 2 days** ⚠️ — критичний для conversion (CRON job на Vercel)
- [ ] **Trial ended → first payment** — підтвердження
- [ ] **Payment receipt** — після кожного списання
- [ ] **Payment failed** — з кнопкою "Оновити карту" → Customer Portal
- [ ] **Subscription canceled** — підтвердження + м'яка спроба reactivate
- [ ] **Subscription reactivated** — раді, що ти повернулась
- [ ] (Опційно) **Weekly digest** — твій тиждень у MintoFood (графіки, streak, топ рецепти)

### 🌍 Локалізація

- [ ] Усі шаблони у 3 мовах (ua/en/pl)
- [ ] Визначення мови з `profiles.language` або browser fallback
- [ ] Дати/числа форматувати локально

### 📬 Email preferences

- [ ] Сторінка `/profile/notifications` — юзер обирає що отримувати
- [ ] Категорії: Транзакційні (обов'язкові, не вимикаються) / Нагадування / Маркетинг / Weekly digest
- [ ] Збереження в `profiles.email_preferences` (JSONB)
- [ ] Перевірка перед відправкою кожного листа
- [ ] **Unsubscribe link** у кожному не-транзакційному листі (compliance)

### 🚫 Bounce & complaint handling

- [ ] Webhook від Resend на `/api/webhooks/resend`
- [ ] Обробка `email.bounced` → позначити email як невалідний, не слати більше
- [ ] Обробка `email.complained` (юзер позначив як спам) → автоматичний unsubscribe
- [ ] Reputation monitoring — Resend dashboard

### ✅ QA

- [ ] Тест відправки кожного шаблону на 3 мовах
- [ ] Тест unsubscribe — повна зупинка не-транзакційних листів
- [ ] Тест на mail-tester.com (DKIM/SPF/DMARC + спам-скор)
- [ ] Тест: bounce → email blocklisted
- [ ] Тест rendering у Gmail / Outlook / Apple Mail / Yahoo

---

## 🔍 ФАЗА 15: SEO + публічні URL рецептів

> **Чому критично:** зараз твої рецепти живуть всередині SPA — Google їх не індексує. Кожен опублікований рецепт може стати органічним джерелом трафіку. Schema.org Recipe markup → Google показує твої картки з зіркою рейтингу і фото в пошуку.

### 🔗 Публічні URL рецептів

- [ ] Колонка `recipes.slug TEXT UNIQUE` (генерується з `name_ua` + transliteration)
- [ ] Бекфіл slug для існуючих опублікованих рецептів
- [ ] Тригер на INSERT/UPDATE для авто-генерації slug
- [ ] Маршрут `/recipe/{slug}` (Vercel rewrites або hash routing з SSR fallback)
- [ ] Сторінка рецепту рендериться **без login** (публічний доступ)
- [ ] CTA "Зберегти в книгу" → відкриває login modal для незалогінених
- [ ] 404 page для неіснуючих slug

### 🏷 Schema.org Recipe markup (JSON-LD)

> **Це найважливіше для SEO.** Google розпізнає Recipe markup і показує rich result-картки з фото + зіркою + часом приготування прямо в пошуку.

- [ ] JSON-LD блок на кожній публічній сторінці рецепту:
  - [ ] `@type: Recipe`
  - [ ] `name`, `image`, `author`, `datePublished`
  - [ ] `description`, `prepTime`, `cookTime`, `totalTime`, `recipeYield`
  - [ ] `recipeCategory`, `recipeCuisine`
  - [ ] `nutrition` (калорії, білки, жири, вуглеводи з твоїх полів!)
  - [ ] `recipeIngredient[]`, `recipeInstructions[]`
  - [ ] `aggregateRating` (з твоєї системи рейтингу)
- [ ] Тест через Google Rich Results Test (search.google.com/test/rich-results)

### 🌐 Multi-language SEO

- [ ] **hreflang tags** на всіх сторінках для 3 мов
- [ ] Окремі URL для кожної мови: `/uk/recipe/...`, `/en/recipe/...`, `/pl/recipe/...` (АБО `?lang=` параметр з canonical)
- [ ] **Canonical URL** на кожній сторінці
- [ ] Meta tags локалізовані (title, description) у 3 мовах

### 🗺 Sitemap.xml & robots.txt

- [ ] Динамічний `/sitemap.xml` (Vercel function):
  - [ ] Усі статичні сторінки (index, pricing, about, etc.)
  - [ ] Усі опубліковані рецепти (дата оновлення = `recipes.updated_at`)
  - [ ] Усі продукти з путівника (якщо публічні)
  - [ ] Multi-language sitemap або hreflang всередині
- [ ] `/robots.txt`:
  - [ ] Allow public pages
  - [ ] Disallow: `/admin*`, `/profile*`, `/api/*`
  - [ ] Sitemap location

### 🖼 Open Graph + Twitter Cards

- [ ] OG tags на кожній сторінці (title, description, image, type)
- [ ] Twitter Card tags (summary_large_image)
- [ ] **Динамічна OG image** для рецептів — `vercel/og` або статичні (recipe.image + бренд оверлей)
- [ ] Тест через opengraph.xyz / twitter card validator

### 🔘 Шерінг

- [ ] Кнопка "Поділитися" на recipe-картці (Web Share API з fallback на copy link)
- [ ] Тест share у Telegram / Messenger / iOS Messages → красива preview-картка

### 📈 Search Console + Bing Webmaster

- [ ] Зареєструвати `mintofood.com` у Google Search Console
- [ ] Submit sitemap.xml
- [ ] Зареєструвати у Bing Webmaster (~5% ринку, але зайве не буде)
- [ ] Моніторити impressions/clicks/CTR щотижня

### ✅ QA

- [ ] Тест Rich Results для 3-5 різних рецептів
- [ ] Тест hreflang через Search Console
- [ ] Тест публічної сторінки в incognito (без login) — все рендериться
- [ ] Тест шерінгу в соцмережах — preview-картка виглядає правильно
- [ ] Lighthouse SEO score 100 на recipe-сторінках

---

## 📊 ФАЗА 16: Analytics + Error Tracking + Onboarding

> **Без даних ти не знатимеш чому юзери не платять, а без error tracking — що в них ламається.** Onboarding — найдешевший спосіб підняти activation rate, бо ловить юзера в момент максимального інтересу.

### 📈 Аналітика — PostHog

- [ ] Створити акаунт PostHog (EU-hosting обов'язково для GDPR)
- [ ] Інтеграція через `posthog-js` SDK
- [ ] Респект cookie consent (трекати тільки якщо юзер погодився)
- [ ] **Identify users** після login (`posthog.identify(user.id, { email, plan })`)
- [ ] **Tracking events** (мінімальний набір):
  - [ ] `signup_started` / `signup_completed`
  - [ ] `recipe_created`
  - [ ] `meal_logged`
  - [ ] `water_logged`
  - [ ] `weight_logged`
  - [ ] `recipe_saved_to_book`
  - [ ] `cookbook_created`
  - [ ] `paywall_shown` (з `feature` property)
  - [ ] `checkout_started`
  - [ ] `subscription_started` (з `plan`)
  - [ ] `subscription_canceled` (з `reason`)
  - [ ] `ai_scan_used` (готуємо для AI OCR)
  - [ ] `feature_used` (generic для дрібних дій)
- [ ] **Funnels** в PostHog dashboard:
  - [ ] Signup → first meal → 7-day retention → trial → paid
  - [ ] Recipe create funnel: open form → fill ingredients → save → publish
- [ ] **Cohort retention** — еженедельний відсік юзерів, що повертаються
- [ ] Session recordings (для UX research) — з GDPR-маскою (no PII)

### 🚨 Error tracking — Sentry

- [ ] Створити Sentry-проект (free tier 5K events/міс)
- [ ] Інтеграція `@sentry/browser` у front-end
- [ ] Інтеграція `@sentry/node` у Vercel functions (webhooks, API)
- [ ] Source maps upload при білді (для читабельних stack traces)
- [ ] User context (`Sentry.setUser({ id, email })`) після login
- [ ] Filter expected errors (network errors, AbortController) щоб не забивати квоту
- [ ] **Alert rules:**
  - [ ] >10 errors за 5 хв → email
  - [ ] New error type → email
  - [ ] Webhook handler crashes → critical alert (Slack/Telegram)
- [ ] Перевірка кожен ранок — це твій product health pulse

### 🟢 Uptime monitoring

- [ ] UptimeRobot (безкоштовний, 5 хв інтервал) АБО Better Stack (платний, 30 сек)
- [ ] Моніторити: `mintofood.com`, `/api/health` (створи endpoint), Supabase REST endpoint
- [ ] (Опційно) Public status page на `status.mintofood.com`

### 🌱 Onboarding flow для нових юзерів

> Зараз юзер заходить → бачить порожній dashboard → не розуміє що робити → йде. Onboarding це лікує.

- [ ] **Welcome screen** після першого signup — пояснити value (3 кроки максимум)
- [ ] **Goal setup wizard:**
  - [ ] Крок 1: ціль (схуднути / набрати / підтримати / здорове харчування)
  - [ ] Крок 2: параметри тіла (вже є форма в профілі — переюзаєм)
  - [ ] Крок 3: рівень активності
  - [ ] Авто-розрахунок норм + збереження
- [ ] **Sample data seed** — 1 sample meal "Сніданок: вівсянка з ягодами" щоб dashboard не виглядав мертвим
- [ ] **Tooltip tour** по головних розділах (можна `intro.js` або self-built)
- [ ] **Empty states з CTA** на всіх сторінках:
  - [ ] Меню на день: "Додайте перший прийом їжі →"
  - [ ] Рецепти: "Створіть свій перший рецепт →" або "Збережіть рецепт із загальної бази"
  - [ ] Книга рецептів: "Створіть першу книгу →"
  - [ ] Список покупок: "Додайте інгредієнти з рецепту"
- [ ] **Progress checklist** у sidebar профілю: ✅ Налаштувати ціль / ✅ Додати перший meal / ⬜ Створити перший рецепт / ⬜ Залогувати воду 5 днів поспіль
- [ ] **Activation milestones** — святкувати моменти ("Ти на 7-денному streak! 🌿")

### 🔬 A/B testing infrastructure (на майбутнє)

- [ ] PostHog має вбудовані feature flags
- [ ] Налаштувати framework для A/B тестів (без конкретних тестів зараз)
- [ ] Перші тести після launch: pricing page copy, paywall trigger timing, onboarding step order

### ✅ QA

- [ ] Тест: events приходять у PostHog при діях юзера
- [ ] Тест: Sentry ловить штучну помилку (`throw new Error('test')`)
- [ ] Тест: cookie reject → analytics не вантажиться
- [ ] Тест onboarding flow з нуля (incognito): signup → goal setup → first meal → бачить контент
- [ ] Тест empty states на всіх сторінках без даних
- [ ] Тест: Sentry alerts тригеряться при критичних помилках

---

## 📅 Орієнтовна оцінка обсягу

| Фаза | Складність | Час (приблизно) |
|---|---|---|
| 13 — Юридичне + GDPR | Середньо (треба юриста) | 1-2 тижні + €200-500 на юриста |
| 14 — Email-інфра | Середньо | 1 тиждень |
| 15 — SEO + публічні URL | Високо (нова архітектура маршрутів) | 2-3 тижні |
| 16 — Analytics + Sentry + Onboarding | Середньо | 1-2 тижні |

**Усього:** ~6-8 тижнів якщо паралельно з фазою 12 (монетизація). Можна оптимізувати, виключивши деякі опційні пункти на старті.

---

# 🏗 Фази 17-18 — Інфраструктура та глобальні UI

> Ці фази часто пропускаються бо здаються "не цікавими" — але саме вони визначають, чи твій продакшн стабільний, безпечний і виглядає професійно.

---

## 🌐 ФАЗА 17: Інфраструктура та DevOps

> **Мета:** перевести MintoFood з "проєкт на vercel.app" у "production-ready глобальний продукт" з власним брендом, нормальним моніторингом і безпекою.

---

### 🔗 Власний домен

- [ ] **Перевірити доступність** `mintofood.com` (а також `.app`, `.io`, `.co` як backup)
- [ ] Перевірити інші локальні зони: `mintofood.pl`, `mintofood.com.ua`, `mintofood.eu` (для майбутнього бренд-захисту)
- [ ] **Trademark search:** перевір через TMview (EU + global) і UAH databases чи "MintoFood" нігде не зайнято
- [ ] **Купити домен** через надійного registrar:
  - **Cloudflare Registrar** — за собівартістю (~$10/рік для `.com`), без upsells, з якісним DNS у комплекті
  - Namecheap — стандарт, дешевий, нормальний
  - Porkbun — startup-friendly
  - ⚠️ НЕ використовувати GoDaddy (поганий UX, агресивні upsells)
- [ ] Купити основні захисні домени (опційно): `.app`, `.io`, `.eu` — щоб ніхто не зловив бренд
- [ ] **Privacy protection** (WHOIS privacy) — увімкнути обов'язково (не показувати свою адресу публічно)
- [ ] **DNSSEC** увімкнути (захист від DNS spoofing)
- [ ] **Auto-renew** увімкнути на 2-3 роки наперед (щоб домен не висмикнули, якщо забудеш заплатити)

### 🌍 DNS-провайдер

- [ ] **Cloudflare DNS** (безкоштовно, найшвидший, з DDoS-захистом і аналітикою)
- [ ] Перевести nameservers на Cloudflare (якщо домен куплений не там)
- [ ] Increase TTL на стабільні записи (3600s+)

### 🏠 Subdomain-стратегія

- [ ] `mintofood.com` — основний продукт
- [ ] `www.mintofood.com` — redirect на основний (або навпаки, обрати канонічний)
- [ ] `mail.mintofood.com` — DKIM/SPF записи для transactional email
- [ ] `status.mintofood.com` — public status page (UptimeRobot робить безкоштовно)
- [ ] (Опційно) `blog.mintofood.com` або `mintofood.com/blog` — content marketing
- [ ] (Опційно) `help.mintofood.com` — help center / FAQ
- [ ] (Опційно — пізніше) `api.mintofood.com` — для public API
- [ ] (Опційно — для безпеки) `admin.mintofood.com` — окремо від основного домену з додатковим IP allowlist

### 🔐 SSL / HTTPS

- [ ] Vercel автоматично видає Let's Encrypt сертифікати — нічого не робити
- [ ] Якщо через Cloudflare proxy: SSL mode = **Full (Strict)** (не Flexible — це vulnerability!)
- [ ] **HSTS header** (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`)
- [ ] Подати mintofood.com у HSTS preload list (hstspreload.org) — після того, як HSTS працює стабільно

### 📧 Email на власному домені

- [ ] Створити mailbox-и на `@mintofood.com`:
  - [ ] `support@` — підтримка юзерів
  - [ ] `hello@` або `info@` — маркетинг / партнерство
  - [ ] `noreply@` — системні листи
  - [ ] `dmca@` — для copyright complaints (compliance)
  - [ ] `privacy@` або `dpo@` — GDPR-запити (compliance)
- [ ] **Провайдер inbox-ів:**
  - **Migadu** ($19/рік за необмежено mailbox-ів) — найкращий для startups
  - **Fastmail** ($60/рік) — преміум якість
  - **Google Workspace** (~$72/рік) — стандарт, але громіздкий
  - **Zoho Mail** (безкоштовно до 5 юзерів) — бюджетний варіант
- [ ] Налаштувати DNS:
  - [ ] **MX records** — куди приходить пошта
  - [ ] **SPF** (`v=spf1 ...`) — хто може слати від твого імені
  - [ ] **DKIM** — підпис листів
  - [ ] **DMARC** (`v=DMARC1; p=quarantine; rua=mailto:dmarc@mintofood.com;`) — політика
- [ ] Перевірити через mail-tester.com — має бути 10/10
- [ ] Forwarding: твоя особиста пошта → support@ (поки ти одна, не треба окремий inbox)

### 💎 Hosting plans (платні — не уникнути для production)

- [ ] **Vercel Pro** ($20/міс) — для production обов'язковий:
  - [ ] Hobby plan забороняє commercial use (можуть забанити після launch)
  - [ ] Краща швидкість, більше bandwidth, advanced analytics
  - [ ] Password protection для preview deployments
  - [ ] Support
- [ ] **Supabase Pro** ($25/міс) — для production обов'язковий:
  - [ ] Daily backups (без них — катастрофа очікує)
  - [ ] Point-in-time recovery (відкат на потрібну хвилину)
  - [ ] No pause при низькій активності (Free плани засинають!)
  - [ ] 8GB DB, 100GB storage, 250GB bandwidth
  - [ ] Read replicas (опційно)
- [ ] **Cloudflare** — безкоштовний tier достатній для старту
- [ ] **Резервний фонд:** ~$50-100/міс на інфраструктуру (Vercel + Supabase + email + monitoring)

### 🖼 CDN та оптимізація зображень

- [ ] Зараз recipe-фото зберігаються як URL (Pexels/Unsplash) або base64 — потрібно структурувати
- [ ] Перейти на Supabase Storage для всіх юзерських зображень
- [ ] **Image optimization:**
  - **Vercel Image Optimization** (вбудовано в Vercel, через `<Image>` теги — але у тебе Vanilla, треба адаптувати)
  - **Cloudflare Images** ($5/міс за 100K зображень, рекомендую)
  - **Cloudinary** — потужно, але дорого
- [ ] **Lazy loading** на всіх зображеннях (`loading="lazy"`) — ✅ вже зроблено
- [ ] **WebP/AVIF formats** — для сучасних браузерів
- [ ] **Responsive images** через `srcset` для різних розмірів екрану
- [ ] **CDN caching headers** на статичні асети (1 рік для версіонованих)

### 💾 Backup та disaster recovery

- [ ] **Supabase Pro** робить daily backups + PITR (Point-in-Time Recovery)
- [ ] Додатковий self-managed backup: Vercel CRON job → `pg_dump` → завантаження в **Backblaze B2** ($0.005/GB)
- [ ] Зберігати backup мінімум 30 днів
- [ ] **Тест recovery!** — раз на квартал відновлювати backup на staging БД, перевіряти, що дані цілі (без цього бекапи можуть бути broken і ти про це не знатимеш)
- [ ] **Disaster recovery план** — окремий документ з відповідями:
  - [ ] Що робити, якщо Supabase впаде на 24+ години?
  - [ ] Що робити, якщо Vercel впаде?
  - [ ] Що робити при втраті домену (hijacking, expiration)?
  - [ ] Що робити при компрометації admin акаунту?
  - [ ] Контакти support усіх critical провайдерів
- [ ] **Status communication plan** — як швидко повідомити юзерів через email + status page + соцмережі

### 🔒 Безпека

- [ ] **2FA на ВСІХ критичних акаунтах:** Vercel, Supabase, Cloudflare, Domain registrar, Stripe/Paddle/LS, Resend, Sentry, GitHub
- [ ] **Hardware security key** (YubiKey) для domain registrar і Cloudflare — найкраще проти phishing
- [ ] **Security headers** через Vercel `vercel.json`:
  - [ ] `Strict-Transport-Security` (HSTS)
  - [ ] `Content-Security-Policy` (CSP) — обмежує які скрипти можуть вантажитися
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `X-Frame-Options: DENY` (захист від clickjacking)
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`
  - [ ] `Permissions-Policy` — обмежує API (camera, microphone, geolocation)
- [ ] Тест через **securityheaders.com** — мета A+
- [ ] **Rate limiting** через Vercel Edge Middleware:
  - [ ] Login attempts (5/хв)
  - [ ] Signup attempts (3/хв з одного IP)
  - [ ] AI scan endpoint (за тарифом)
  - [ ] Webhook endpoints (захист від abuse)
- [ ] **Secret management:**
  - [ ] Усі API keys у Vercel Environment Variables
  - [ ] Окремі ключі для preview / production
  - [ ] Аудит — що в кодбазі, що повинно бути в env (особливо Stripe webhooks!)
  - [ ] Ніколи не комітити `.env` файли (перевір `.gitignore`)
- [ ] **Supabase security:**
  - [ ] Аудит RLS — кожна таблиця має політики
  - [ ] Перевір, що anon key не дає доступу до приватних даних
  - [ ] Service role key — тільки на сервері (Vercel functions), ніколи у фронтенді

### 🌳 Environment management

- [ ] **Production:** `mintofood.com` (Vercel main branch, Supabase prod project)
- [ ] **Staging:** `staging.mintofood.com` (Vercel staging branch, окремий Supabase project)
- [ ] **Preview deployments:** автоматично для кожного PR (Vercel робить сам)
- [ ] Environment variables окремі для кожного середовища
- [ ] **Безпечно перевіряти зміни на staging перед merge у production**
- [ ] Seed-скрипт для staging БД (мінімальні тестові дані)

### 🚀 CI/CD

- [ ] Vercel робить deploy автоматично з git push
- [ ] **Branch protection** на GitHub: main вимагає PR review
- [ ] Lint + format check на pre-commit (Husky + Prettier)
- [ ] (Опційно) GitHub Actions для додаткових перевірок (security scan, bundle size)
- [ ] **Rollback стратегія:** Vercel дозволяє одним кліком відкотитися на попередній deployment

### 📊 Performance моніторинг

- [ ] **Vercel Analytics** (платний tier дає Web Vitals) — увімкнути
- [ ] **Lighthouse CI** — autorun на кожний PR (опційно, але рекомендую)
- [ ] **Bundle size monitoring** — попередження якщо JS бандл росте >10%
- [ ] **Supabase query monitoring:**
  - [ ] Slow query alerts (>1s)
  - [ ] Database CPU monitoring
  - [ ] Connection pool monitoring
  - [ ] Index usage analysis (раз на місяць)

### 🏷 Brand protection (опційно, але корисно)

- [ ] **Trademark registration** — у Польщі через UPRP, у ЄС через EUIPO ($1000-1500 одноразово)
- [ ] Захист на ключових словах: "MintoFood" + лого
- [ ] Реєстрація на основних соцмережах (навіть якщо не плануєш активно):
  - [ ] Instagram: @mintofood
  - [ ] TikTok: @mintofood
  - [ ] Twitter/X: @mintofood
  - [ ] YouTube: @mintofood
  - [ ] LinkedIn (для бізнесу)
- [ ] Реєстрація `mintofood` username на: Reddit, Producthunt, Discord, Telegram

### ✅ QA

- [ ] Тест: домен резолвиться, HTTPS працює, без warnings у консолі
- [ ] Тест email: відправити з `support@` — приходить, отримати у `support@` — приходить
- [ ] Тест: SPF/DKIM/DMARC валідні через mxtoolbox.com
- [ ] Тест: securityheaders.com показує A+
- [ ] Тест: можеш відкатити deployment одним кліком
- [ ] Тест: backup можна відновити на staging
- [ ] Тест: 2FA працює на всіх акаунтах (включно з recovery codes збереженими в безпечному місці!)

---

## 🦶 ФАЗА 18: Футер + глобальні UI

> Ти відкладала футер на фініш — тепер це має сенс, бо до цього часу будуть готові всі юридичні документи (фаза 13). Але треба не забути також про дрібні глобальні елементи, які повинні бути всюди.

---

### 📋 Структура футера

Класичний layout: 4 колонки на десктопі, акордеон на мобільному.

**Колонка 1 — Продукт:**
- [ ] Логотип + tagline ("Глобальна платформа для рецептів і нутриції 🌿")
- [ ] Меню на день
- [ ] Меню на тиждень
- [ ] Рецепти
- [ ] Путівник
- [ ] Книга рецептів

**Колонка 2 — Компанія:**
- [ ] Про нас (`/about`)
- [ ] Блог (`/blog`) — якщо буде
- [ ] Pricing (`/pricing`)
- [ ] (Пізніше) Affiliate / Partners
- [ ] (Пізніше) Press kit

**Колонка 3 — Підтримка:**
- [ ] Help Center / FAQ (`/help`)
- [ ] Contact (`mailto:support@mintofood.com`)
- [ ] Status (`status.mintofood.com`)
- [ ] (Опційно) Roadmap / Changelog
- [ ] Feedback / Feature request

**Колонка 4 — Юридичне:**
- [ ] Privacy Policy (`/privacy`)
- [ ] Terms of Service (`/terms`)
- [ ] Cookie Policy (`/cookies`)
- [ ] Imprint (`/imprint`) — обов'язково в ЄС
- [ ] DMCA / Copyright (`/dmca`) — для UGC платформи
- [ ] DPA / GDPR (`/gdpr`) — посилання на data export/delete

### 🔻 Нижня лінійка футера

- [ ] **Copyright:** `© 2026 MintoFood. Усі права захищені.`
- [ ] **Made with 🌿** — людський елемент бренду
- [ ] (Опційно) `Made in Poland & Ukraine` — твій особистий штрих
- [ ] **Версія / build hash** — корисно для дебагу юзерів ("Версія 2.1.4")
- [ ] **Компанія / NIP** — обов'язково в ЄС якщо JDG/spółka:
  - `MintoFood [твоя legal entity], NIP: PL...`

### 📱 Соцмережі

- [ ] Іконки: Instagram, TikTok, YouTube (опційно — Twitter/X, Pinterest)
- [ ] Усі ведуть на `@mintofood` акаунти
- [ ] `target="_blank"` + `rel="noopener noreferrer"` (security)
- [ ] Tooltip з назвою при hover

### 🌍 Локалізація

- [ ] Перемикач мови (UA / EN / PL) — якщо ще не в хедері
- [ ] Перемикач валюти (опційно, якщо буде показ цін)
- [ ] Усі тексти у футері — у 3 мовах через i18n

### 🌗 Тема

- [ ] Перемикач світла/темна тема (опційно — якщо вирішиш дублювати з хедера)

### 📨 Newsletter signup (опційно)

- [ ] Простий input "Email" + кнопка "Підписатися"
- [ ] Збереження в `newsletter_subscribers` (separate табл)
- [ ] Інтеграція з Resend для розсилки
- [ ] Double opt-in (compliance!)

### 📐 Verstka

- [ ] Десктоп: 4 колонки + bottom row
- [ ] Tablet: 2x2 grid
- [ ] Mobile: акордеон (кожна колонка згорнута, тапнув = відкрилась)
- [ ] Padding: 60-80px зверху/знизу
- [ ] Background: `var(--color-bg-secondary)` для м'якого розділення з контентом
- [ ] Тонка border зверху (`border-top: 1px solid var(--color-border)`)
- [ ] Тест на світлій і темній темі

### 🎯 Розмістити футер

- [ ] На ВСІХ сторінках з основним лейаутом:
  - [ ] index.html (Меню на день)
  - [ ] week-menu.html
  - [ ] recipes.html
  - [ ] product-guide.html
  - [ ] shopping-list.html
  - [ ] cookbook.html
  - [ ] profile/* (усі підсторінки)
  - [ ] pricing.html (нова)
  - [ ] /recipe/{slug} (публічні рецепти — особливо важливо для SEO + trust!)
- [ ] **НЕ розміщувати** у:
  - [ ] Login/Signup модалках
  - [ ] Адмінці (вона desktop-only професійний tool)
  - [ ] Onboarding flow (відволікає)

---

## 🌐 Глобальні UI елементи (про які часто забувають)

> Це не повноцінна фаза, а перевірочний список. Без цього UX продакшну виглядає недоробленим.

### 🚫 404 Page

- [ ] `/404.html` (Vercel автоматично використовує)
- [ ] Дружелюбна копія: "Цей рецепт ще не приготовано 🌿"
- [ ] Кнопка "Повернутися додому"
- [ ] (Опційно) Випадковий рецепт як CTA "Спробуй замість цього"
- [ ] Збереження URL у логах (Sentry показує найчастіші 404 — корисно для виявлення битих посилань)

### ⚠️ 500 / Error Page

- [ ] Загальна сторінка помилки сервера
- [ ] "Щось пішло не так. Ми вже знаємо і працюємо над цим"
- [ ] Кнопка "Спробувати ще раз" + "Повернутися"
- [ ] Контакт support з reference ID (для тікетів)

### 🛠 Maintenance Page

- [ ] Шаблон `/maintenance.html` на випадок планового downtime
- [ ] "MintoFood на короткому технічному обслуговуванні. Будемо на лінії за ~30 хвилин"
- [ ] Перемикання через Vercel rewrite

### 🌐 Offline indicator

- [ ] Banner коли юзер втратив з'єднання: "Ви офлайн. Деякі функції недоступні"
- [ ] Recovery banner коли з'єднання повернулося

### 🔐 Login required state

- [ ] На захищених сторінках для незалогінених — show login modal або redirect (вже є?)
- [ ] Soft-prompt "Увійдіть, щоб зберігати рецепти" замість hard wall на доступних сторінках

### 🔄 Loading states

- [ ] Skeleton-loaders скрізь (✅ вже зроблено для рецептів/путівника)
- [ ] Loading spinner для дій (save, delete, upload)
- [ ] Progress bar для довгих операцій (upload фото, AI scan)

### ✅ Success/error toast системи

- [ ] Уніфікований toast (✅ є в `utils.js`)
- [ ] Аудит — усі дії показують feedback (success або error)

### 🎨 Favicon + manifest

- [ ] Favicon у різних розмірах: 16x16, 32x32, 180x180 (apple-touch-icon)
- [ ] `manifest.json` для PWA:
  - [ ] `name`, `short_name`
  - [ ] `theme_color`, `background_color`
  - [ ] Icons 192x192, 512x512
  - [ ] `start_url`, `display: standalone`
- [ ] OpenGraph default image для шерінгу (1200x630)

### 📜 Scroll behavior

- [ ] Smooth scroll для anchor-links
- [ ] "Back to top" кнопка на довгих сторінках (рецепти/блог)

### 🌐 Browser support

- [ ] Перевірити в Safari (iOS + macOS) — найкапризніший
- [ ] Chrome, Firefox, Edge
- [ ] Banner для дуже старих браузерів (IE / стара Safari): "Оновіть браузер для кращого досвіду"

### ✅ QA глобальних UI

- [ ] Тест 404 з невалідного URL
- [ ] Тест offline (DevTools → Network → Offline)
- [ ] Тест PWA installable (chrome://flags + "Add to Home Screen")
- [ ] Тест favicon у різних місцях (tab, bookmark, home screen)
- [ ] Тест шерінгу — OG image вантажиться
- [ ] Тест на iPhone Safari + Android Chrome

---


# 📱 ФАЗА 19: Мобільний додаток — Google Play (App Store пізніше)

> **Стратегія:** PWA → TWA-обгортка → Google Play. 100% Vanilla JS codebase + тонкий native shell.
> **Монетизація:** **no-IAP стратегія** (як Netflix / Spotify / Patreon) — підписка тільки на сайті, app — read-only оболонка для зареєстрованих юзерів. Жодних згадок про підписку в app (anti-steering compliance).
> **iOS:** відкладаємо. $99/рік + триваліша перевірка + жорсткіші anti-steering правила Apple.

---

## 🚫 No-IAP стратегія — фундаментальне правило

> Це не "хитрість, як обдурити Google" — це легальна і поширена стратегія. Великі: Netflix, Spotify, Amazon Kindle, Patreon, Substack. Усі вони НЕ дозволяють купити підписку в app.

### Anti-steering — що це і чому критично

Google і Apple кажуть: якщо НЕ використовуєш їхній платіжний механізм (Google Play Billing / Apple IAP), то **взагалі не можеш у app натякати**, що десь можна заплатити. Порушення → app банять.

### ❌ Що заборонено в app

- [ ] Кнопка "Підписатися" / "Upgrade" / "Купити Premium" / "Перейти на Pro"
- [ ] Показ цін у валюті ($5/міс, €4.99/міс)
- [ ] Посилання на `pricing.mintofood.com` або `mintofood.com/pricing`
- [ ] Текст "Дізнатися більше про Premium"
- [ ] QR-коди або deep links на оплату
- [ ] Promo banner "Перші 3 дні безкоштовно"
- [ ] Натяки типу "Перейдіть на сайт, щоб..."
- [ ] Trial countdown timer з CTA у app

### ✅ Що дозволено в app

- [ ] Показ поточного плану ("Ваш план: Free" або "Ваш план: Premium")
- [ ] Заблокована фіча з повідомленням "Недоступно у вашому плані" (**БЕЗ кнопок** куди йти, БЕЗ опису як отримати доступ)
- [ ] Login через email / Google
- [ ] Signup безкоштовного акаунту
- [ ] Будь-який функціонал, що **не є покупкою**
- [ ] Інформативне повідомлення "Trial завершився" (без CTA)

### 🎯 Канали привести юзера на сайт (поза app)

- [ ] Email-розсилка (welcome flow, trial reminders, weekly digest з CTA)
- [ ] SEO трафік на сайт (фаза 15 — публічні URL рецептів)
- [ ] Платна реклама (Instagram/TikTok ads → сайт)
- [ ] Соцмережі (`@mintofood` контент)
- [ ] Реферальна програма
- [ ] Push notifications **без прямого CTA на покупку** (наприклад: "Твій тиждень готовий — глянь")

> **Логіка:** app = retention engine для існуючих юзерів. Web = acquisition engine для платників. Юзер дізнається про підписку до того, як завантажить app, або через email уже як юзер.

---

## 🛣 Вибір технології

### Варіант A: TWA (Trusted Web Activity) ⭐ — рекомендую

- Найшвидший шлях: PWA → Bubblewrap CLI → Android `.aab` → Google Play
- 100% web codebase, мінімум native коду
- Auto-update без store review (бо це твій сайт)
- Підходить для більшості функцій MintoFood

**Обмеження:**
- Камера через web `getUserMedia` — працює, але менш стабільно за нативну
- Push через web standard — на Android ОК
- Не має нативних API типу biometric auth (не критично для MintoFood)

### Варіант B: Capacitor — більше native API

- Шар поверх web app з доступом до native (camera, file system, push, biometrics)
- Більше роботи, але повний контроль
- Потрібен якщо AI camera scan стане ключовою фічею (нативна камера стабільніша)
- iOS build потім — простіше, ніж переписувати все

### 🎯 Рекомендація

- [ ] Старт: **TWA через Bubblewrap**
- [ ] Якщо AI scan вимагатиме native camera (через рік-два) — мігрувати на Capacitor

---

## 🌱 Підготовка PWA — фундамент

> Без повноцінного PWA нічого не запрацює. Це pre-requisite для TWA.

### 📋 Manifest.json

- [ ] `name: "MintoFood — Recipes & Nutrition"`
- [ ] `short_name: "MintoFood"` (≤12 символів)
- [ ] `description` (3 мови — окремі manifests або dynamic)
- [ ] `start_url: "/?source=pwa"` (UTM для трекінгу)
- [ ] `display: "standalone"` (без браузерної рамки)
- [ ] `theme_color: "#4ab584"` (твій м'ятний accent)
- [ ] `background_color: "#a6d6b8"` (соковита м'ята)
- [ ] `orientation: "portrait"` (mobile-first)
- [ ] `lang: "uk"` (з fallback)
- [ ] `categories: ["food", "health", "lifestyle"]`
- [ ] **Icons:**
  - [ ] 192x192 (мінімум)
  - [ ] 512x512 (для splash screen)
  - [ ] **Maskable icons** (для Android adaptive icons — обов'язково)
  - [ ] Apple touch icon 180x180 (про запас для майбутнього iOS)

### 🛠 Service Worker

- [ ] Реєстрація SW у `index.html`
- [ ] **Caching strategy:**
  - [ ] Static assets (CSS, JS, fonts) — `cache-first`
  - [ ] API requests до Supabase — `network-first` з fallback на cache
  - [ ] Зображення — `stale-while-revalidate`
- [ ] **Offline fallback** — статична сторінка "Ви офлайн. Перевірте з'єднання"
- [ ] Service Worker оновлення без проміжних кліків (skipWaiting)
- [ ] Workbox для управління — простіше за raw SW

### 🚀 Lighthouse PWA score

- [ ] Цільовий score: **90+** (мінімум для TWA)
- [ ] Перевірити через Chrome DevTools → Lighthouse → PWA category
- [ ] Виправити всі issues:
  - [ ] HTTPS ✅ (Vercel дає)
  - [ ] Service Worker реєструється
  - [ ] Manifest валідний
  - [ ] Icons коректних розмірів
  - [ ] Apple meta tags для iOS
  - [ ] Theme color у `<meta>`

### 🎨 Splash screen

- [ ] Android: автоматично з manifest (`background_color` + 512x512 icon)
- [ ] (Опційно) custom splash через JS на першому завантаженні

### 📲 Add to Home Screen prompt

- [ ] Custom prompt замість дефолтного браузерного (краще UX)
- [ ] Показувати після 2-3 візитів (не на першому)
- [ ] Не нав'язливо — close-кнопка + "більше не показувати"

---

## 📦 TWA через Bubblewrap

### Setup

- [ ] Встановити Bubblewrap CLI: `npm i -g @bubblewrap/cli`
- [ ] Встановити Java JDK 11+ (потрібно для build)
- [ ] Встановити Android SDK (через Android Studio або command-line tools)
- [ ] `bubblewrap init --manifest=https://mintofood.com/manifest.json`
- [ ] Заповнити поля: app name, package name (зазвичай `com.mintofood.app`), versionCode, signing key

### Digital Asset Links — обов'язково!

- [ ] Згенерувати SHA256 fingerprint signing key
- [ ] Створити `/.well-known/assetlinks.json` на сайті:
  ```json
  [{
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.mintofood.app",
      "sha256_cert_fingerprints": ["..."]
    }
  }]
  ```
- [ ] Перевірити через `https://developers.google.com/digital-asset-links/tools/generator`
- [ ] **Без цього файлу TWA показуватиметься з браузерним адресним рядком** — виглядає непрофесійно

### Build & test

- [ ] `bubblewrap build` → отримуєш `.aab` (Android App Bundle)
- [ ] Тест на реальному пристрої через `adb install`
- [ ] Перевірити: app відкривається без браузерної панелі (це signal, що Asset Links працюють)
- [ ] Тест offline режиму (PWA service worker має кешувати)
- [ ] Тест back button → не виходить з app, навігує всередині

### App icon + branding

- [ ] App icon (512x512) — твоє лого з padding для adaptive icons
- [ ] Splash screen background — `#a6d6b8` (соковита м'ята)
- [ ] Status bar color — `#4ab584` (accent)

---

## 🛒 Google Play Console

### Setup акаунту

- [ ] Зареєструватися на [play.google.com/console](https://play.google.com/console)
- [ ] **Заплатити $25** (одноразово, на все життя розробника)
- [ ] Verification: Google перевіряє developer ідентичність — паспорт або company docs (для JDG/spółki)
- [ ] Чекати схвалення (1-3 дні)
- [ ] **Important:** реєструй на ту саму legal entity, що і платіжний провайдер (Stripe/LS)

### Створення app listing

- [ ] **Назва:** "MintoFood — Recipes & Nutrition" (50 символів максимум)
- [ ] **Short description** (80 символів) — у 3 мовах
- [ ] **Full description** (4000 символів) — у 3 мовах, з ключовими словами для ASO
- [ ] **App category:** Food & Drink (primary), Health & Fitness (secondary)
- [ ] **Content rating** — заповнити questionnaire (для food/recipe app буде "Everyone")

### Графічні матеріали

- [ ] **App icon** 512x512 PNG (без прозорості)
- [ ] **Feature graphic** 1024x500 — банер для топу listing
- [ ] **Screenshots** — мінімум 2, максимум 8:
  - [ ] Phone screenshots (різні екрани: меню на день, рецепти, профіль)
  - [ ] 7-inch tablet (опційно)
  - [ ] 10-inch tablet (опційно)
- [ ] (Опційно) **Promo video** YouTube link — 30 сек огляд
- [ ] У 3 мовах — окремі screenshots з UA / EN / PL текстом

### Privacy & compliance

- [ ] **Privacy Policy URL** — обов'язково (з фази 13!)
- [ ] **Data Safety form** — заповнити, які дані збираєш:
  - [ ] Email, name → для акаунту
  - [ ] Health data (вага, КБЖУ) → для функціоналу
  - [ ] Photos (рецепти) → для функціоналу
  - [ ] Усі дані шифровані in transit (HTTPS) і at rest (Supabase)
  - [ ] Юзер може видалити дані (GDPR delete з фази 13)
- [ ] **Target audience** — 13+ або 16+ (для ЄС GDPR)
- [ ] **Ads declaration** — "No ads" (бо у тебе freemium, не ad-supported)

### Content rating

- [ ] Заповнити IARC questionnaire — для food/recipe app буде "Everyone" / 3+

---

## 🚀 Реліз стратегія

### Beta-тестування (обов'язково перед production)

- [ ] **Internal testing track** — до 100 testers, миттєвий доступ
  - [ ] Запросити 5-10 близьких людей перевірити на реальних пристроях
  - [ ] Тест на різних Android версіях (8, 10, 12, 14)
  - [ ] Тест на різних розмірах екранів
- [ ] **Closed testing track** — до 1000 testers, ручне затвердження
  - [ ] Запросити 20-50 знайомих + ранніх юзерів з вебу
  - [ ] Збирати feedback через email або через in-app form
- [ ] **Open testing track** — будь-хто може приєднатися
  - [ ] Опційно — для wider beta перед public

### Production release

- [ ] **Staged rollout** — 5% → 20% → 50% → 100% (поступово)
- [ ] Це дозволяє відловити критичні баги до того, як їх отримають усі юзери
- [ ] Якщо crash rate > 0.5% — зупинити rollout, виправити, повторити
- [ ] **Версіонування:** semver (1.0.0 для launch, 1.0.1 для hotfix, 1.1.0 для features)

### Пост-релізний моніторинг

- [ ] **Crash rate** у Play Console — мета <1%
- [ ] **ANR rate** (App Not Responding) — мета <0.5%
- [ ] **App reviews** — моніторити щодня, відповідати на 1-2 ★ протягом 24 годин
- [ ] **Install/uninstall rate** — якщо uninstall > 30% за тиждень → серйозна проблема

---

## 🎯 ASO — App Store Optimization

> Бренд "MintoFood" нікому невідомий, тож юзери знаходитимуть тебе через ключові слова. ASO це SEO для апсторів.

### Keyword research

- [ ] Інструменти: **AppFollow**, **AppTweak**, **Sensor Tower** (мають free trials)
- [ ] Цільові keywords:
  - [ ] "calorie counter", "nutrition tracker", "meal planner"
  - [ ] "recipe app", "cookbook", "meal prep"
  - [ ] Українські: "калорії", "рецепти", "харчування"
  - [ ] Польські: "kalorie", "przepisy", "dieta"
- [ ] Insertion: title + short description + first 200 символів full description (Google враховує це найбільше)

### A/B тестування store listing

- [ ] Google Play Console дозволяє A/B тести: icon, screenshots, descriptions
- [ ] Тест 1: іконка з логотипом vs з фото їжі
- [ ] Тест 2: перший screenshot — функція vs lifestyle shot
- [ ] Тест 3: short description варіанти

---

## 🔔 Push notifications (без anti-steering порушень)

- [ ] **Web Push API** через Service Worker (TWA підтримує)
- [ ] FCM (Firebase Cloud Messaging) для бекенда
- [ ] Підписка на push з opt-in (не auto-prompt)
- [ ] **Дозволені типи нотифікацій:**
  - [ ] "Твій тиждень готовий!" (engagement)
  - [ ] "Не забудь занести вечерю 🌿" (streak retention)
  - [ ] "Друг доєднався до MintoFood" (social)
  - [ ] "Новий рецепт у твоїй книзі" (engagement)
- [ ] **ЗАБОРОНЕНО в push-нотифікаціях:**
  - [ ] "Trial закінчується завтра — підпишись!" (це anti-steering у Google інтерпретації)
  - [ ] "20% знижка на Premium" (та сама причина)
- [ ] Trial reminders → тільки через email, не через push

---

## 🔗 Deep linking

- [ ] `mintofood.com/recipe/{slug}` → відкриває в app (не в браузері)
- [ ] Налаштувати через Digital Asset Links (вже є для TWA)
- [ ] Тест: send собі посилання в Telegram → клік відкриває app
- [ ] Fallback: якщо app не встановлений → відкриває браузер
- [ ] Universal sharing: "Поділитися рецептом" з app генерує URL, який працює і на вебі, і в app

---

## 🛡 No-IAP compliance — final review перед launch

> **Останній чекліст перед submit.** Якщо хоч один пункт порушено — Google може забанити app.

- [ ] Жодної кнопки "Subscribe" / "Upgrade" / "Buy" в app
- [ ] Жодних цін у валюті в app interface
- [ ] Жодних посилань з app на pricing-сторінку сайту
- [ ] Заблоковані фічі показують просто "Недоступно", без call-to-action
- [ ] Push-нотифікації НЕ містять CTA на покупку
- [ ] In-app messages не містять промо
- [ ] Пройти listing review — переглянути screenshots, чи не показують ціни/CTA
- [ ] Тестовий submit на closed testing → реакція Google

---

## ✅ QA

- [ ] Тест PWA на реальному телефоні (не emulator) — Android
- [ ] Lighthouse PWA score 90+
- [ ] TWA build відкривається без браузерної панелі
- [ ] Asset Links верифіковані
- [ ] Deep links працюють
- [ ] Push notifications приходять
- [ ] Offline mode (увімкнути airplane mode) — show cached
- [ ] Onboarding flow працює (signup в app)
- [ ] Login через Google працює
- [ ] Анти-steering audit — пройти listing очима Google reviewer-а
- [ ] Тест: безкоштовний юзер бачить заблоковані фічі без CTA
- [ ] Тест: підписався на сайті → після перезаходу в app бачить Premium

---

## 🍎 iOS / App Store — план на потім

> Не на launch. Але треба тримати в голові, щоб не зробити рішень, які закриють шлях.

- [ ] **Apple Developer Program** — $99/рік
- [ ] iOS reviewers ще жорсткіші щодо anti-steering — треба буде ще ретельніше переглядати
- [ ] PWA через Capacitor (TWA — це Android-only)
- [ ] Apple історично відхиляв "thin web wrappers" — Capacitor з native splash і кількома native фічами проходить краще
- [ ] **App Tracking Transparency** — обов'язково prompt для iOS 14+
- [ ] **Reader app exception** — Apple має категорію "Reader apps" з пом'якшеними правилами для медіа-додатків. Треба перевірити, чи MintoFood кваліфікується (food/recipe — на межі)
- [ ] **TestFlight** для бета-тестування
- [ ] **DMA в ЄС:** Apple теж дозволив зовнішні платежі через спецентитлемент — можна розглянути для EU юзерів

---

## 📅 Орієнтовна оцінка

| Етап | Час |
|---|---|
| PWA preparation (manifest, SW, Lighthouse 90+) | 1-2 тижні |
| TWA build + Digital Asset Links | 2-3 дні |
| Google Play Console setup + Listing | 3-5 днів (включно з очікуванням Verification) |
| Графічні матеріали (icons, screenshots, feature graphic) | 1 тиждень |
| Beta testing (Internal → Closed) | 2-3 тижні |
| Production rollout (staged) | 1-2 тижні |

**Усього:** ~6-8 тижнів від готового web-app до публічного релізу в Google Play.

**Бюджет:**
- Google Play Developer fee: $25 (одноразово)
- Графіка: $0 (сама зробиш) або $200-500 (фрилансер)
- ASO tools: $0 (free trials) або $50-100/міс

---

## 📝 Нотатки

- **Принцип "фундаментально":** ніяких стабів, плейсхолдерів, "потім допишемо". Кожен крок робимо як для production.
- **Тест двох тем:** кожна сторінка має одразу виглядати однаково premium і в світлій, і в темній.
- **Мобайл-first:** для нових компонентів спочатку продумуємо як виглядатиме на телефоні, потім масштабуємо на десктоп.
- **Не чіпаємо те, що працює:** існуюча логіка `meals.js`, `stats.js`, `auth.js` залишається. Міняємо тільки селектори CSS та HTML-розмітку.

---

_Останнє оновлення: квітень 2026_
