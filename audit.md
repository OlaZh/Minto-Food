# План полагодження проєкту (аудит JS + компоненти)

> **ГОЛОВНЕ ПРАВИЛО: МИ НЕ ЛАМАЄМО ТЕ, ЩО ВЖЕ ПРАЦЮЄ.**
> Кожен пункт супроводжується поміткою ризику й тим, як перевірити, що нічого не зламалось.
> Робимо по одному пункту → перевіряємо в браузері → тільки потім наступний.

Зведено з двох пар незалежних аудитів:
- **Аудит #1** — мертвий код, дублі, баги в JS (39/35 файлів).
- **Аудит #2** — перевикористання компонентів і стилів (модалки, кнопки, дропдауни).

Усі рядки/факти нижче перевірені прямо в коді.

---

## 🔴 БЛОК A. Функціональні баги (виправити першими — вони псують дані/поведінку)

### A1. Подвійне масштабування Б/Ж/В при редагуванні страви
**Файл:** [meals.js:476](js/meals.js#L476) + [meals.js:1031](js/meals.js#L1031)
**Що не так:** при відкритті страви на редагування нормалізується назад тільки `kcal`
(`item.kcal / (item.weight/100)`), а `protein/fat/carbs` лишаються абсолютними (на стару вагу).
Потім на :1031 вони множаться на `factor = grams/100` ще раз → **хибні Б/Ж/В**.
**Фікс:** нормалізувати на 100 г усі чотири макроси в `selectedFood` (рядок 476):
```js
selectedFood = item ? {
  ...item,
  kcal:    item.kcal    / (item.weight / 100),
  protein: item.protein / (item.weight / 100),
  fat:     item.fat     / (item.weight / 100),
  carbs:   item.carbs   / (item.weight / 100),
} : null;
```
**Ризик зламати:** низький, але треба перевірити **додавання нової** страви (там `selectedFood`
приходить з пошуку вже на 100 г — переконатись, що ділення не застосовується двічі).
**Перевірка:** додати страву 200 г → відредагувати вагу на 100 г → Б/Ж/В мають стати рівно вдвічі менші, а не вчетверо.

### A2. recipe-page: не вантажаться `name_pl` і `steps_ua`
**Файл:** [recipe-page.js:59](js/recipe-page.js#L59) (select), використання на [:153](js/recipe-page.js#L153), [:328](js/recipe-page.js#L328), [:380](js/recipe-page.js#L380)
**Що не так:** `select(...)` бере `name_en` і `steps`, але **не** `name_pl` і `steps_ua`,
хоча рендер на них розраховує. Плюс `_getLocalizedName` для `pl` повертає `name_en`.
**Колонки в БД існують** (перевірено: згадуються в міграціях і інших JS) — тож фікс безпечний.
**Фікс:**
1. Додати `name_pl, steps_ua` у select на :59.
2. Виправити [_getLocalizedName:328](js/recipe-page.js#L328):
   `if (lang === 'pl') return recipe.name_pl || recipe.name_ua || 'Przepis';`
   `if (lang === 'en') return recipe.name_en || recipe.name_ua || 'Recipe';`
**Ризик:** мінімальний — додаємо поля, нічого не прибираємо. `||`-фолбеки лишають UA, якщо PL порожній.
**Перевірка:** відкрити рецепт `?lang=pl` → польська назва й кроки; `?lang=ua` → без змін.

### A3. pendingAction губиться після Google OAuth
**Файл:** [auth.js:181](js/auth.js#L181) (зберігає), [auth.js:583](js/auth.js#L583) (виконує тільки після submit форми), гілка `SIGNED_IN` [auth.js:81](js/auth.js#L81) (не виконує)
**Що не так:** відкладена дія (напр. «зберегти в книгу після логіну») працює для email/password,
але після Google OAuth гілка `SIGNED_IN` її не запускає.
**Фікс:** у гілці `SIGNED_IN` після успішного логіну перевірити й виконати збережений `pendingAction`
(винести виконання в спільну функцію `runPendingAction()` і викликати з обох місць).
**Ризик:** середній — не виконати дію двічі. Очищати `pendingAction` одразу після запуску.
**Перевірка:** розлогінитись → натиснути «зберегти в книгу» → залогінитись через Google → дія має виконатись один раз.

### A4. shopping-list: подвійна синхронізація (realtime + polling)
**Файл:** [shopping-list.js:50-51](js/shopping-list.js#L50) — викликаються **і** `subscribeToMainList()` (realtime), **і** `startPolling()` (кожні 5 с)
**Що не так:** обидва пишуть в `activeItems` і ререндерять. Зайве навантаження + зайві ререндери.
**Фікс (обережний):** лишити realtime як основний, а polling зробити **fallback**.
Запускати polling не лише коли `.subscribe()` повернув помилку/таймаут, **а й коли realtime
тихо відвалився пізніше** — тобто:
- статус підписки `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` → увімкнути polling;
- realtime підключився, але довго не дає жодної події й heartbeat загублено → теж fallback на polling.
Не покладатись тільки на момент `subscribe()`, бо тихий відвал після успішного підключення інакше не зловиться.
**Ризик:** середній — realtime може мовчки не підключитись (RLS, мережа) АБО відвалитись уже після конекту, тоді без polling список «замерзне».
Тому **не видаляти polling повністю**, а зробити умовним і слухати зміни статусу каналу, а не лише первинний результат.
**Перевірка:** відкрити список у двох вкладках → зміна в одній зʼявляється в іншій; вимкнути realtime (девтулз) → polling підхоплює.

### A5. XSS у toast через innerHTML
**Файл:** [utils.js:34](js/utils.js#L34) — `message` вставляється через `innerHTML`; виклики з даними з БД, напр. [shopping-list.js:682](js/shopping-list.js#L682) (`data.name`), [book-selector.js:138](js/book-selector.js#L138)
**Що не так:** назва книги/списку (користувацький ввід) потрапляє в `innerHTML` без екранування.
**Фікс:** екранувати текст у `showToast` — іконка лишається HTML, текст через `textContent`:
```js
toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text"></span>`;
toast.querySelector('.toast-text').textContent = message;
```
**Ризик:** мінімальний. Перевірити, що жоден виклик `showToast` навмисно не передає HTML (схоже, ні).
**Перевірка:** створити список з назвою `<img src=x onerror=alert(1)>` → у toast має показатись текст, без алерту.

### A6. GDPR export тихо повертає `[]` при помилці
**Файл:** [gdpr-export.js:11](js/gdpr-export.js#L11), [gdpr-export.js:20](js/gdpr-export.js#L20)
**Що не так:** будь-який non-200 → повертає `[]`, тобто помилка маскується під «даних немає».
Для експорту персональних даних це небезпечно (віддає неповний архів мовчки).
**Фікс:** при non-200 кидати/прокидувати помилку нагору і показувати користувачу «не вдалося сформувати експорт, спробуйте ще раз», **не** віддавати порожній архів як успіх.
**Ризик:** низький; це лише робить наявну помилку видимою.
**Перевірка:** заблокувати один із запитів (девтулз) → експорт має показати помилку, а не «успішно».

### A7. shared-list: оптимістичний UI без rollback
**Файл:** [shared-list.js:58](js/shared-list.js#L58) (одразу міняє UI), [shared-list.js:63](js/shared-list.js#L63) (чекає RPC)
**Що не так:** UI міняється до підтвердження RPC; при помилці стан бреше.
**Фікс:** при помилці RPC — відкотити UI у попередній стан + toast про помилку.
**Ризик:** низький.
**Перевірка:** обірвати RPC → чекбокс має повернутись назад.

---

## 🟡 БЛОК B. Локалізація (контент показується не тією мовою)

### B1. product-guide рендерить `name_ua`/`short_desc` напряму
**Файл:** [product-guide.js:142-143](js/product-guide.js#L142), [product-guide.js:447](js/product-guide.js#L447), [product-guide.js:459](js/product-guide.js#L459)
**Що не так:** картки й модалка беруть `name_ua` напряму, ігноруючи мову з localStorage.
**Фікс:** додати локалізований геттер (як у recipe) і вживати його замість прямого `name_ua`.
**Ризик:** низький — фолбек на UA лишається.

### B2. parse-food: пошук не по `name_pl`
**Файл:** [parse-food.js:367](js/parse-food.js#L367), [parse-food.js:527](js/parse-food.js#L527)
**Що не так:** прямий пошук інгредієнтів іде по `name_ua`/`name_en`, але не по `name_pl` → гірше розпізнавання для PL.
**Фікс:** додати `name_pl` у пошукові умови.
**Ризик:** низький.

### B3. mobile-tab-bar захардкоджені укр. підписи
**Файл:** [mobile-tab-bar.js:40](js/mobile-tab-bar.js#L40)
**Що не так:** підписи нижньої навігації не локалізуються.
**Фікс:** взяти підписи з i18n-словника.
**Ризик:** низький.

### B4. recipe-page: тіло сторінки завжди українською
**Файл:** [recipe-page.js](js/recipe-page.js) — `CATEGORY_LABELS`, хардкод «Інгредієнти»/«Приготування»
**Що не так:** EN/PL-словники використані лише в `<meta>`/Schema.org, а видимі лейбли — UA.
**Фікс:** у `_renderRecipe` обрати словник за `_getLang()`.
**Ризик:** низький. Робити **після A2** (бо A2 теж про recipe-page).

---

## 🟠 БЛОК C. Уніфікація модалок (найбільший архітектурний борг)

> Це найбільша робота. Робимо **поступово й адитивно** — спочатку додаємо спільні
> плейсхолдери, мігруємо модалки по одній, нічого не видаляючи, поки не переведені всі.

### Поточний стан (3 паралельні системи + окремі):
| Система | Класи | Показ | z-index | Де |
|---|---|---|---|---|
| A «day» | `.modal/.modal__*` | `[hidden]` | 1000 | їжа, створення продукту, product-guide |
| B «recipes» | `.modal-overlay/.modal-card` | `.is-active` | 2000 | recipe-modal, book-selector, report-modal, cookbook, shopping-list |
| C «scanner» | `.scanner-modal/__*` | `[hidden]` | 2100 | сканер ШК |
| окремі | `.auth-modal`, `.onb-card`, `.bottom-sheet`, `.cookbook-modal`, `.admin-confirm-modal` | свої | різні | auth, onboarding, mobile, admin |

Підтверджено в коді: z-index 1000/2000/2100 ([_modal.scss:8/451/556](scss/components/_modal.scss#L8)),
а `openModal` ([ui-components.js:187](js/ui-components.js#L187)) для підстраховки додає `'active'`, `'is-active'` **і** `hidden=false` одночасно — ознака, що JS не знає контракту.

### C1. Ввести z-index шкалу в токени (зробити ПЕРШИМ — безпечно)
**Файл:** [scss/base/_tokens.scss](scss/base/_tokens.scss) (або `_variables.scss`)
**Фікс:** додати `--z-dropdown: 500; --z-modal: 1000; --z-modal-top: 2000; --z-scanner: 2100; --z-toast: 10000;`
і поступово замінити магічні числа на змінні.
**Ризик:** мінімальний, якщо зберегти ті самі числові значення → візуально нічого не зміниться.

### C2. Створити спільні плейсхолдери (адитивно, нічого не ламає)
**Файл:** [scss/utils/_design-system.scss](scss/utils/_design-system.scss)
**Фікс:** додати `%overlay` (fixed+inset:0+flex center+blur) і `%modal-card`.
**На цьому кроці нічого не мігруємо** — лише створюємо інструмент.
**Ризик:** нульовий (новий код, ніхто ще не вживає).

### C3. Уніфікувати JS-контракт відкриття/закриття
**Файл:** [ui-components.js:183](js/ui-components.js#L183)
**Фікс:** одна пара `openModal/closeModal` з **одним** класом стану (напр. `.is-open`).
**Ризик:** ВИСОКИЙ — `openModal` зараз навмисно додає три варіанти, бо різні модалки слухають різні.
**Тому:** спочатку мігрувати CSS усіх модалок на `.is-open` (по одній, C4), і лише **в кінці**
прибрати зайві `'active'/'is-active'/hidden` з `openModal`. До того моменту — не чіпати цю функцію.
**❗️ЖОРСТКЕ ПРАВИЛО:** `openModal`/`closeModal` чіпати ВИКЛЮЧНО після того, як КОЖНА конкретна модалка
переведена на новий CSS-контракт (`.is-open`). Не раніше — поки хоч одна модалка слухає старий клас,
зміна спільної функції її зламає. Це останній крок усього блоку C, не передостанній.

### C4. Мігрувати модалки на `%overlay`+`%modal-card`+`.is-open` — ПО ОДНІЙ
Порядок (від простих до складних): scanner → product/day → book-selector/report → recipe-modal → auth → onboarding/admin.
**Після кожної:** перевірити відкриття/закриття/клік по фону/Esc/scroll-lock саме цієї модалки.
**Ризик:** середній на кожній, але ізольований — ламається максимум одна модалка, одразу видно.

---

## 🟢 БЛОК D. Кнопки/чіпи/картки (дублі стилів — косметика, але борг)

> Правило з [_buttons.scss:4](scss/components/_buttons.scss#L4): нові кнопки — через `@extend`. Порушено в кількох місцях.

### D1. Прибрати override `.btn-danger`
**Файл:** [_book-selector.scss:488](scss/components/_book-selector.scss#L488) — `.report-modal .btn-danger` перемальовує глобальну [.btn-danger](scss/components/_buttons.scss#L70).
**Фікс:** прибрати локальний блок, лишити глобальну; якщо потрібен відступ — лише його, без кольору.
**Ризик:** низький — звірити вигляд кнопки в report-modal до/після.

### D2. Перевести вручну-намальовані кнопки на `@extend`
**Файли:** `settings-theme/lang/unit-btn`, `period-btn`, `settings-edit-btn`, `settings-action-btn`,
[settings-delete-btn](scss/pages/_profile.scss#L2200), `auth-modal__submit`, `week-modal__manual-submit`, `profile-actions__btn`.
**Фікс:** outline-pill → `@extend %chip-filter` (існує, але вживається лише 1 раз!), головні зелені → `@extend %button-primary`, `.modal__confirm` → `@extend %button-primary`.
**⚠️ НЕ робити масову заміну всіх pill-кнопок на `%chip-filter` одним махом.** Візуальна схожість ≠ семантика:
`%chip-filter` — це фільтр/перемикач, а `settings-delete-btn`, `settings-action-btn` тощо — це **дії**, не чіпи.
Розбити на групи за СЕНСОМ: справжні перемикачі (`period-btn`, `settings-theme/lang/unit-btn` з `.active`-станом) → `%chip-filter`;
кнопки-дії → `%button-secondary`/`%button-primary`. Кожну групу мігрувати окремо й звіряти вигляд.
**Ризик:** низький-середній — звіряти вигляд кожної групи; робити по одній групі, не гуртом.

### D3. Дропдауни/меню — звести до одного компонента (велике, низький пріоритет)
**Файли:** language/user dropdown ([_header.scss:115/312](scss/layout/_header.scss#L115)), recipe-actions ([_book-selector.scss:266](scss/components/_book-selector.scss#L266)), shopping ([_shopping-list.scss:630](scss/pages/_shopping-list.scss#L630)), week-mobile ([_week-menu.scss:1236](scss/pages/_week-menu.scss#L1236)), bottom-sheet, ingredient-picker — 7 окремих реалізацій.
**Фікс:** єдиний `%dropdown`/`%menu` плейсхолдер; мігрувати по одному.
**Ризик:** середній. Робити **після** модалок або взагалі окремим етапом.

### D4. custom-select fork у profile
**Файл:** [profile.js:1356](js/profile.js#L1356) (ручна логіка activity select) поряд з shared `initCustomSelect` [profile.js:2108](js/profile.js#L2108)
**Фікс:** перевести activity select на shared `initCustomSelect`, прибрати ручну гілку.
**Ризик:** середній — перевірити, що зміна активності зберігається.

---

## ⚪ БЛОК E. Мертвий код (видаляти ОБЕРЕЖНО — спершу переконатись, що 0 використань)

> Перед видаленням кожного перевіряти **ТРИ** місця, не два:
> 1. grep по `js/` (імпорти, виклики);
> 2. grep по `*.html` (inline `onclick`/`onchange`);
> 3. **inline-генерація в шаблонних рядках** — у цьому репо реально трапляється
>    (підтверджено: [profile.js:1600](js/profile.js#L1600) `onclick="deleteActivity(${...})"` усередині template literal).
>    Звичайний grep за іменем функції це ловить, АЛЕ якщо виклик динамічний (`window[name]`, зібране ім'я через конкатенацію) — текстовий пошук проґавить. Тому для кожного кандидата окремо грепнути ще й `window\.` + саме ім'я та перевірити, чи воно не складається динамічно.
> Видаляти по одному, комітити окремо.

### Підтверджено мертве (безпечно):
- **Файли цілком:** [lang-switcher-ui.js](js/lang-switcher-ui.js), [feature-flag.js](js/feature-flag.js) — 0 підключень у js/html.
- `searchOwnShowAll` — [add-recipe.js:58](js/add-recipe.js#L58) — оголошена+скидається, ніде не читається.
- `openClearCellConfirm()` — [week-menu.js:243](js/week-menu.js#L243) — 1 входження (саме оголошення).
- `openCoverPicker()`+`createCoverPickerModal()` — [cookbook.js:767](js/cookbook.js#L767) — не викликаються.
- Мертві імпорти: `removeRecipeFromBook/removeRecipeFromAllBooks/getRecipeBooks` у [add-recipe.js:29](js/add-recipe.js#L29); `iconCheck/iconVeg/iconPlate` у [meals.js:2](js/meals.js#L2); `getWeightHistory/addWeightRecord` у profile.js.
- Невикористані експорти: `setIngredients` [recipe-ingredients.js:604](js/recipe-ingredients.js#L604), `getBooks/removeRecipeFromAllBooks` [book-selector.js:55](js/book-selector.js#L55).
- Константи `WEIGHT_HISTORY_KEY/ACTIVITY_HISTORY_KEY` — [profile.js:54](js/profile.js#L54).

### ⚠️ УВАГА — НЕ переплутати (тут легко зламати):
- **storage.js** `getActivityHistory/saveActivity/deleteActivity` ([storage.js:262](js/storage.js#L262)) — deprecated localStorage-версії, **безпечно видалити**.
  АЛЕ: у **profile.js є СВОЯ `deleteActivity`** ([profile.js:1488](js/profile.js#L1488)) — Supabase-версія, **РОБОЧА**, виставлена як `window.deleteActivity` ([profile.js:1500](js/profile.js#L1500)) і викликається inline `onclick` ([profile.js:1600](js/profile.js#L1600)).
  **Однакова назва, різні функції.** Видаляти тільки storage-версію, profile-версію НЕ чіпати.
- `utils.js` невживані: `getLocalizedName, getCurrentLang, formatDateShort/Full, truncateText, convertToBaseUnit, throttle, isNotEmpty, generateId, initAutoResizeTextareas` — частина «бібліотека на майбутнє». Видаляти лише якщо точно вирішили, що не потрібні; інакше лишити.

### E1. Розмазана/дубльована ініціалізація на сторінці рецептів (cleanup)
**Файли:** [add-recipe.js:1464-1481](js/add-recipe.js#L1464), [recipe-modal.js:281](js/recipe-modal.js#L281)
**Що насправді (перевірено в коді — формулювання звіту трохи інше):**
- У `add-recipe.js` **один** `DOMContentLoaded` (1464), не два. У ньому послідовно `initAuth` (1465) → `initBookSelector` (1477) → `initRecipeModal` (1478).
- Реальне дублювання — **`initBookSelector`**: його кличе і `add-recipe.js` (1477), і `recipe-modal.js` (281, з середини `initRecipeModal`). Тобто на сторінці рецептів `initBookSelector` виконується двічі.
**Чому не критично зараз:** `initAuth` ідемпотентний, повторний `initBookSelector` теж не падає — звідси «дрібниця».
**Фікс (cleanup):** прибрати дубльований виклик `initBookSelector` з одного з місць (лишити там, де він логічно потрібен — найімовірніше всередині `initRecipeModal`, а з `add-recipe.js` прибрати), щоб порядок ініціалізації був в одному місці.
**⚠️ Ризик:** середній — `initBookSelector` кешує `currentUserId` під час init (див. аудит #1, проблема з квік-сейвом після логіну). НЕ чіпати цей пункт окремо від блоку про повторну ініціалізацію book-selector після auth-події — інакше можна зробписати гірше. Найбезпечніше робити **після** того, як вирішено, як book-selector реагує на зміну юзера.
**Перевірка:** відкрити сторінку рецептів → відкрити модалку рецепта → зберегти в книгу (залогінений і гість) → усе працює як раніше.

---

## 🔵 БЛОК F. Дублі-хелпери (рефакторинг, низький пріоритет, робити в кінці)

- **formatAmount** — двічі: [utils.js:207](js/utils.js#L207) і [parse-food.js:719](js/parse-food.js#L719) → лишити одну.
- **Локалізація назви рецепта** — `getRecipeDisplayName` ([recipe-utils.js](js/recipe-utils.js)) ≈ `getLocalizedName` ([utils.js](js/utils.js)) → звести до однієї (вживається перша).
- **Плюралізація UA** — 4 копії: `getDishWord` ([meal-accordion.js:48](js/meal-accordion.js#L48)), `getDayWord` ([streak.js:31](js/streak.js#L31)), `recipesLabel` ([cookbook.js:258](js/cookbook.js#L258)), inline `countWord` ([week-menu.js:1013](js/week-menu.js#L1013)) → один `pluralUA(n,[one,few,many])`.
- **Конвертація одиниць** (кг→г/л→мл) — тричі: `UNIT_CONVERSIONS` (utils.js), [week-menu.js:703](js/week-menu.js#L703), [parse-food.js:15](js/parse-food.js#L15) → одне джерело.
- `resolveScannedProduct` — однойменні в [barcode-scanner.js:457](js/barcode-scanner.js#L457) і [parse-food.js:665](js/parse-food.js#L665), різна логіка → перейменувати одну для ясності (не конфліктують, але плутають).

**Ризик усього блоку F:** середній (рефакторинг спільних функцій зачіпає багато місць).
Робити **останнім**, по одному хелперу, з перевіркою всіх викликів.

---

## ✅ Що вже добре (НЕ чіпати)
- Дизайн-система: токени + `%button-*`/`%chip-*`/`%premium-card` ([_design-system.scss](scss/utils/_design-system.scss)).
- Toast як компонент (JS [utils.js:21](js/utils.js#L21) + [_toast.scss](scss/components/_toast.scss)) — лише A5 (екранування).
- Spacing/radius/shadow токени, header/footer як спільні partials, skeleton, cookie-consent.
- Більшість page-кнопок реально через `@extend`.

---

## 📋 Рекомендований порядок виконання

**Етап 1 — баги, що псують дані (швидко, високий ефект):**
A1 (макроси) → A2 (recipe-page select) → A5 (toast XSS) → A6 (GDPR) → A3 (OAuth) → A4 (синхронізація) → A7 (rollback).

**Етап 2 — локалізація:**
B1 → B2 → B3 → B4.

**Етап 3 — безпечне прибирання (комітити окремо):**
E (мертвий код, з увагою до storage vs profile `deleteActivity`).

**Етап 4 — кнопки/чіпи:**
C1 (z-токени) → C2 (плейсхолдери) → D1 → D2.

**Етап 5 — велика уніфікація (обережно, по одній):**
C4 (модалки по черзі) → C3 (фінально JS-контракт) → D3 (дропдауни) → D4 (custom-select).

**Етап 6 — дублі-хелпери:**
F (останнім).

> Після КОЖНОГО пункту: запустити сторінку, перевірити сценарій із розділу «Перевірка», закомітити окремо.
> Якщо щось ламається — відкотити саме цей коміт, а не накопичувати зміни.
