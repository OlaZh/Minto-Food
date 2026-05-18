## 🏗 ФАЗА 10.9: Structural Refactor HTML/SCSS — canonical shell, BEM, design-system adoption

> **Статус:** в процесі (травень 2026).
> **Проблема:** public-сайт виглядає як набір окремих сторінок, а не як один продукт. Зараз різняться HTML-shell, порядок wrapper-ів, використання `<main>`, відступи, типи кнопок, стилі форм, модалки, іконки та локальні CSS-рішення. Частина сторінок використовує `div.app-bg > div.app-shell`, частина живе без канонічного `<main>`, частина має inline styles або великий inline CSS. Через це сайт виглядає непослідовно, ламає sticky-footer, ускладнює підтримку і вбиває відчуття "професійного продукту".
> **Принцип:** одна канонічна структура, один shared shell, один набір UI-примітивів, нуль випадкових локальних рішень.

---

### Scope

- [x] canonical HTML-shell для всіх public pages
- [x] єдиний sticky-footer contract
- [x] валідний HTML без вкладених `<main>`
- [x] shared header/footer/mobile shell
- [x] BEM-governance для layout і shared components
- [x] design-system adoption: buttons, cards, inputs, modals, chips, badges
- [x] прибирання inline styles і page-local layout CSS
- [x] включення всіх public entry points, а не тільки основних сторінок

---

### Канонічна структура для всіх public pages

```html
<body class="page page--{page-name}">
  <header class="header">...</header>

  <main class="main">
    <div class="container">
      <!-- page content -->
    </div>
  </main>

  <!-- page-level overlays / drawers / modals -->

  <footer class="site-footer">...</footer>
</body>
```

**Непорушні правила:**

- [x] `body.page` = `display: flex; flex-direction: column; min-height: 100vh`
- [x] `main.main` = єдиний page wrapper з `flex: 1`
- [x] `div.container` = єдине обмеження ширини public content
- [x] модалки, drawer-и, confirm overlays живуть поза `<main>`, перед `<footer>` — перевірено на всіх сторінках
- [x] жодного `div.app-bg`
- [x] жодного `div.app-shell`
- [x] жодного вкладеного `<main>`
- [x] жодного inline `style=""` для layout і spacing
- [x] жодного великого page-local inline `<style>` без окремо зафіксованого винятку

---

### Shared shell contract

Після 10.9 public-сайт повинен мати один shell, а не набір ручних копій.

- [x] один спільний контракт для `header.header` — структура вирівняна по всіх сторінках
- [x] один спільний контракт для `footer.site-footer` — footer ідентичний на всіх сторінках
- [x] однаковий active state у nav — перевірено, кожна сторінка підсвічує правильний пункт
- [x] однаковий auth/profile entrypoint — `#headerAuthBtn` у `header__right` з `data-i18n="login"` на всіх 7 сторінках
- [x] однаковий burger/mobile-nav behavior — перевірено: однаковий HTML + mobile-nav.js на всіх сторінках
- [x] однаковий language switcher у footer — ідентичний на всіх сторінках
- [x] зміни в shell вносяться один раз у shared source, а не вручну по всіх HTML — `partials/` + `build.js`

---

### BEM / naming rules

- [x] block не залежить від HTML-тега
- [x] modifier тільки через `--modifier`
- [x] state тільки через `is-*` або вже прийнятий state pattern
- [x] layout-рівень стандартизований навколо `.page`, `.main`, `.container`, `.page-header`, `.site-footer`
- [x] жодних "тимчасових" wrapper-класів без архітектурної причини
- [x] жодних inline layout styles у markup

---

### Design-system adoption

Ця фаза не створює нову систему, а доводить до реального використання вже існуючі tokens/placeholders.

- [x] buttons використовують shared button primitives
- [x] cards використовують shared card primitives
- [x] inputs / textarea / select мають один ритм, radius і focus style
- [x] chips / badges / pills використовують shared tokens
- [x] hardcoded `font-family`, `padding`, `border-radius`, `box-shadow` проходять ревізію
- [x] локальні винятки або прибираються, або документуються як intentional exceptions

---

### Public pages, що входять у фазу

- [x] `index.html`
- [x] `week-menu.html`
- [x] `recipes.html`
- [x] `recipe.html`
- [x] `shopping-list.html`
- [x] `product-guide.html`
- [x] `cookbook.html`
- [x] `profile.html`
- [x] `shared-list.html`

---

### Файл за файлом

#### `index.html`

- [x] прибрати `app-bg/app-shell`
- [x] зробити один верхньорівневий `<main class="main">`
- [x] замінити inner grid-column `<main class="main">` на `<div class="meals-column">`
- [x] оновити closing tags після перестановки wrapper-ів
- [x] оновити SCSS-селектори, де `.main` означав саме meals column

#### `week-menu.html`

- [x] прибрати `app-bg/app-shell`
- [x] привести shell до `main.main > div.container`
- [x] виправити wrapper order і closing tags

#### `recipes.html`

- [x] прибрати `app-bg/app-shell`
- [x] привести до `main.main.recipe-page`
- [x] винести inline display states у CSS classes / JS state classes
- [x] перевірити, що drawer / modal / confirm overlays живуть поза `<main>`

#### `shopping-list.html`

- [x] прибрати `app-bg/app-shell`
- [x] привести до `main.main.shop-page`
- [x] перевірити overlays після shell refactor

#### `product-guide.html`

- [x] прибрати `app-bg/app-shell`
- [x] залишити `main.main > div.container`
- [x] перевірити modal placement

#### `cookbook.html`

- [x] замінити bare `<main>` на `<main class="main">`
- [x] звірити spacing з іншими public pages
- [x] звірити modal contract

#### `profile.html`

- [x] outer profile wrapper перевести в `<main class="main"><div class="container">`
- [x] inner `<main class="profile-main">` замінити на `<div class="profile-main">`
- [x] винести inline styles у SCSS
- [x] прибрати layout dependence on old `.profile-container`

#### `recipe.html`

- [x] обгорнути `#recipeRoot` у `<main class="main">`
- [x] винести великий inline `<style>` у SCSS partial
- [x] перевести top bar `rp-bar` на повний `header.header` з nav, burger, theme toggle, auth
- [x] звірити typography, spacing, buttons, meta blocks і footer rhythm з рештою сайту

#### `shared-list.html`

- [x] офіційно включити у public shell system
- [x] прибрати `app-bg/app-shell`
- [x] повний public shell: header + footer додані, `page--shared-list` modifier встановлено
- [x] вирівняти loading / error / empty / content states з shared primitives

---

### Зміни в SCSS

#### `scss/layout/_layout.scss`

- [x] лишити один canonical sticky-footer contract: `.page` + `.main`
- [x] прибрати тимчасове правило `.app-bg, .page > main, #recipeRoot { flex: 1 }`
- [x] прибрати залежність layout від `.app-bg` / `.app-shell`
- [x] додати `.meals-column` як офіційний layout primitive

#### `scss/base/_base.scss`

- [x] прибрати `.app-bg {}` і `.app-shell {}` разом зі стилями

#### `scss/layout/_header.scss`

- [x] ревізія spacing/radius/shadow/token usage
- [x] вирівняти desktop/mobile shell

#### `scss/layout/_footer.scss`

- [x] footer має бути однаковим на всіх public pages
- [x] spacing, accordion і language switcher не повинні відрізнятися між сторінками

#### `scss/pages/_day-menu.scss`

- [x] замінити старе трактування `.main` як grid-column на `.meals-column`

#### `scss/pages/_profile.scss`

- [x] перенести все, що залежало від `.profile-container`, на canonical shell або block-level класи
- [x] прибрати дублікат `.container, .profile-container` з `_profile.scss`
- [x] responsive overrides переведено з `.profile-container` на `.page--profile .container`

#### `scss/pages/_recipes.scss`, `_shopping-list.scss`, `_product-guide.scss`, `_cookbook.scss`, `_week-menu.scss`

- [x] пройтися по button/card/input/chip usage
- [x] перевести локальні рішення на shared primitives там, де вже можна

#### `scss/components/_auth.scss`, `_modal.scss`, `_inputs.scss`, `_recipe-add.scss` та інші shared components

- [x] ревізія hardcoded `font-family`, `padding`, `radius`, `shadow`
- [x] заміна на tokens / placeholders або documented exception

---

### Reuse / JS layer

- [x] перевірити, де вже можна використати `js/ui-components.js` для modal / confirm / loading / empty
- [x] прибрати дубльовані локальні реалізації там, де це безболісно
- [x] зафіксувати один pattern для loading state
- [x] зафіксувати один pattern для empty state
- [x] зафіксувати один pattern для destructive confirm flow

---

### Іконки / візуальна консистентність

- [x] SVG-first для системних іконок
- [x] emoji не використовуються як основа системного UI без причини
- [x] пройти ревізію `×`, `✏️`, `📷`, `🔥` та інших символів

---

### Порядок виконання

1. [x] Зафіксувати canonical shell contract і BEM rules.
2. [x] Почистити `scss/layout/_layout.scss`, щоб прибрати тимчасові винятки.
3. [x] Перевести `index.html`, бо це найризикованіша сторінка.
4. [x] Перевести `week-menu.html`, `recipes.html`, `shopping-list.html`, `product-guide.html`.
5. [x] Перевести `cookbook.html`, `profile.html`, `recipe.html`, `shared-list.html`.
6. [x] Зробити shared shell pass: header/footer/mobile/auth/lang.
7. [x] Зробити design-system adoption pass.
8. [x] Провести light-theme, dark-theme і mobile QA.

---

### Критерії завершення

- [x] жодного `app-bg` у public HTML
- [x] жодного `app-shell` у public HTML
- [x] кожна public page має один прямий `<main class="main">` під `body.page`
- [x] немає вкладених `<main>`
- [x] `recipe.html` не має великого page-local inline `<style>`
- [x] `profile.html` не має inline layout styles у markup
- [x] `shared-list.html` входить у ту саму shell system, а не живе окремо
- [x] footer притискається донизу через один canonical contract
- [x] відступи `header ↔ main ↔ footer` однакові по всіх public pages
- [x] header/footer/nav/auth/lang не розходяться між сторінками
- [x] shared UI-примітиви виглядають і поводяться консистентно
- [x] light theme, dark theme і mobile viewport проходять без regressions
- [x] HTML залишається структурно валідним

---

### Результат після фази

Після завершення 10.9 public-сайт має виглядати як один продукт, а не як набір сторінок, написаних у різний час різними людьми:

- [x] одна структура сторінки
- [x] один shell
- [x] один ритм відступів
- [x] один набір кнопок / карток / форм / модалок
- [x] одна візуальна мова
- [x] нуль відчуття "кожна сторінка живе за своїми правилами"
