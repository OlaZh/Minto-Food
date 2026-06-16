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

> **✅ БЛОК A ПОВНІСТЮ ЗРОБЛЕНО** (звірено в коді 2026-06-15). Деталі по кожному пункту нижче.

### A1. Подвійне масштабування Б/Ж/В при редагуванні страви ✅ ЗРОБЛЕНО
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

### A2. recipe-page: не вантажаться `name_pl` і `steps_ua` ✅ ЗРОБЛЕНО (steps_pl, не steps_ua — бо steps_ua не існує)
> **Хвіст закрито 2026-06-15:** видимий `<h1>`/назва ([recipe-page.js:122](js/recipe-page.js#L122)) і шаринг ([recipe-page.js:235](js/recipe-page.js#L235)) тепер через `_getLocalizedName(recipe, _getLang())`, а не `recipe.name_ua` напряму. Раніше локалізувалися лише `<title>`/og + кроки, а видима назва лишалася UA. Заразом усе тіло сторінки переведено на словник `UI_LABELS`/`_t()` (категорія, час, макроси, лейбли «Інгредієнти»/«Приготування»), а select інгредієнтів підтягує `name_pl` — тобто закрито й хвіст B4. Schema.org JSON-LD ([recipe-page.js:427](js/recipe-page.js#L427)) свідомо лишається UA-базою (структуровані дані прив'язані до канонічного UA + hreflang).
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

### A3. pendingAction губиться після Google OAuth ✅ ЗРОБЛЕНО
**Файл:** [auth.js:181](js/auth.js#L181) (зберігає), [auth.js:583](js/auth.js#L583) (виконує тільки після submit форми), гілка `SIGNED_IN` [auth.js:81](js/auth.js#L81) (не виконує)
**Що не так:** відкладена дія (напр. «зберегти в книгу після логіну») працює для email/password,
але після Google OAuth гілка `SIGNED_IN` її не запускає.
**Фікс:** у гілці `SIGNED_IN` після успішного логіну перевірити й виконати збережений `pendingAction`
(винести виконання в спільну функцію `runPendingAction()` і викликати з обох місць).
**Ризик:** середній — не виконати дію двічі. Очищати `pendingAction` одразу після запуску.
**Перевірка:** розлогінитись → натиснути «зберегти в книгу» → залогінитись через Google → дія має виконатись один раз.

### A4. shopping-list: подвійна синхронізація (realtime + polling) ✅ ЗРОБЛЕНО (коміт 9165dbe)
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

### A5. XSS у toast через innerHTML ✅ ЗРОБЛЕНО
**Файл:** [utils.js:34](js/utils.js#L34) — `message` вставляється через `innerHTML`; виклики з даними з БД, напр. [shopping-list.js:682](js/shopping-list.js#L682) (`data.name`), [book-selector.js:138](js/book-selector.js#L138)
**Що не так:** назва книги/списку (користувацький ввід) потрапляє в `innerHTML` без екранування.
**Фікс:** екранувати текст у `showToast` — іконка лишається HTML, текст через `textContent`:
```js
toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text"></span>`;
toast.querySelector('.toast-text').textContent = message;
```
**Ризик:** мінімальний. Перевірити, що жоден виклик `showToast` навмисно не передає HTML (схоже, ні).
**Перевірка:** створити список з назвою `<img src=x onerror=alert(1)>` → у toast має показатись текст, без алерту.

### A6. GDPR export тихо повертає `[]` при помилці ✅ ЗРОБЛЕНО
**Файл:** [gdpr-export.js:11](js/gdpr-export.js#L11), [gdpr-export.js:20](js/gdpr-export.js#L20)
**Що не так:** будь-який non-200 → повертає `[]`, тобто помилка маскується під «даних немає».
Для експорту персональних даних це небезпечно (віддає неповний архів мовчки).
**Фікс:** при non-200 кидати/прокидувати помилку нагору і показувати користувачу «не вдалося сформувати експорт, спробуйте ще раз», **не** віддавати порожній архів як успіх.
**Ризик:** низький; це лише робить наявну помилку видимою.
**Перевірка:** заблокувати один із запитів (девтулз) → експорт має показати помилку, а не «успішно».

### A7. shared-list: оптимістичний UI без rollback ✅ ЗРОБЛЕНО (коміт 05d039c)
**Файл:** [shared-list.js:58](js/shared-list.js#L58) (одразу міняє UI), [shared-list.js:63](js/shared-list.js#L63) (чекає RPC)
**Що не так:** UI міняється до підтвердження RPC; при помилці стан бреше.
**Фікс:** при помилці RPC — відкотити UI у попередній стан + toast про помилку.
**Ризик:** низький.
**Перевірка:** обірвати RPC → чекбокс має повернутись назад.

---

## 🟡 БЛОК B. Локалізація (контент показується не тією мовою)

> **Статус (2026-06-15): ✅ ВЕСЬ БЛОК B ЗРОБЛЕНО** (B1, B2, B3, B4) — після ШІ-рев'ю дочищено хвости B2 (базові матчери) і B4 (footer/share/CTA/404). Єдине свідоме виключення — Schema.org JSON-LD лишається UA-базою (SEO). Деталі по кожному пункту нижче.

### B1. product-guide рендерить `name_ua`/`short_desc` напряму ✅ ЗРОБЛЕНО
**Зроблено (2026-06-15):** картка ([:142](js/product-guide.js#L142)) і модалка ([:447](js/product-guide.js#L447)/[:459](js/product-guide.js#L459)) тепер через наявні геттери `nameForLang()`/`txt(row,'short_desc')`. Бонус: пошук-фільтр ([:217](js/product-guide.js#L217)) тепер матчить і локалізовані назву/опис, не лише UA.
**Файл:** [product-guide.js:142-143](js/product-guide.js#L142), [product-guide.js:447](js/product-guide.js#L447), [product-guide.js:459](js/product-guide.js#L459)
**Що не так:** картки й модалка беруть `name_ua` напряму, ігноруючи мову з localStorage.
**Фікс:** додати локалізований геттер (як у recipe) і вживати його замість прямого `name_ua`.
**Ризик:** низький — фолбек на UA лишається.

### B2. parse-food: пошук не по `name_pl` ✅ ЗРОБЛЕНО (усі шляхи)
**Файл:** [parse-food.js:367](js/parse-food.js#L367), [parse-food.js:527](js/parse-food.js#L527)
**Що не так:** прямий пошук інгредієнтів іде по `name_ua`/`name_en`, але не по `name_pl` → гірше розпізнавання для PL.
**Фікс:** додати `name_pl` у пошукові умови.
**Ризик:** низький.
**✅ ЗРОБЛЕНО (2026-06-15), у два заходи:**
1. Дропдаун-пошук `searchProductsForDropdown`: третя гілка `andTokens(... 'name_pl')` + влито `prodPl` у `productsMap`.
2. **Базові матчери теж** (після ШІ-рев'ю): `searchRecipe` ([:373](js/parse-food.js#L373)) і `searchProduct` ([:400](js/parse-food.js#L400)) переведено з `.ilike('name_ua', …)` на `.or(name_ua|name_en|name_pl …)` у всіх гілках (exact / starts / AND), включно з пошуком у `scanned_products`. UA лишається пріоритетною завдяки сортуванню «найкоротша назва». Додано хелпер `_orEsc()` для екранування `,()` у PostgREST `.or()`.

### B3. mobile-tab-bar захардкоджені укр. підписи ✅ ЗРОБЛЕНО
**Зроблено (2026-06-15):** додано ключі `navDay/navWeek/.../navAriaLabel` у [i18n.js](js/i18n.js) (ua/pl/en); у [mobile-tab-bar.js](js/mobile-tab-bar.js) додано хелпер `t(key)=i18n[getLang()][key]`, локалізовано TABS, SHEET_LINKS, заголовок шторки «Інше» та aria-label «Навігація».
**Файл:** [mobile-tab-bar.js:40](js/mobile-tab-bar.js#L40)
**Що не так:** підписи нижньої навігації не локалізуються.
**Фікс:** взяти підписи з i18n-словника.
**Ризик:** низький.

### B4. recipe-page: тіло сторінки завжди українською ✅ ЗРОБЛЕНО
**Файл:** [recipe-page.js](js/recipe-page.js) — `CATEGORY_LABELS`, хардкод «Інгредієнти»/«Приготування»
**Зроблено (2026-06-15):**
- Додано словник `UI_LABELS` (uk/en/pl) + геттер `_t(key)` у [recipe-page.js](js/recipe-page.js).
- `_renderRecipe`: `name` → `_getLocalizedName`, `catLabel` → `_getCategoryLabel`; локалізовано timeParts (Підготовка/Готування/Час/Порцій), Автор/Поділитися, макроси (ккал/Білки/Жири/Вуглев.), заголовки «Інгредієнти»/«Приготування».
- Назва інгредієнта тепер локалізована; у select інгредієнтів ([:106](js/recipe-page.js#L106)) додано `name_pl` (раніше вантажились лише `name_ua, name_en`).
- **Дочищено після ШІ-рев'ю:** футер-лінк, текст «Посилання скопійовано» в share, обидва стани CTA-блоку (залогінений/гість) і весь 404-екран теж переведено на `UI_LABELS`/`_t()`. Перевірено grep'ом кирилиці — усі видимі рядки локалізовані.
- **Свідомо лишається UA:** `_injectSchemaOrg` (JSON-LD `name`/`description`, [:457](js/recipe-page.js#L457)) — структуровані дані прив'язані до канонічного UA-URL + hreflang; це SEO-рішення, не видимий UI. `_buildDescription` (meta) вже має повні UA/EN/PL гілки.
**Що не так:** EN/PL-словники використані лише в `<meta>`/Schema.org, а видимі лейбли — UA.
**Фікс:** у `_renderRecipe` обрати словник за `_getLang()`.
**Ризик:** низький. Робити **після A2** (бо A2 теж про recipe-page).

---

## 🟠 БЛОК C. Уніфікація модалок (найбільший архітектурний борг)

> **Статус (2026-06-16): ✅ C1, C2, C3 ЗРОБЛЕНО; C4 система B готова.** z-шкала (коміт 9dc6a40), плейсхолдери (eb68cfb). C4: ✅ report-modal (b44f3dc), ✅ book-selector (294fe8e), ✅ довгі модалки системи B через глобальний extend (b20c1b7) — усі перевірені в браузері. ⏭️ свідомо пропущено як структурно-окремі: **scanner** і **система A** (`.modal`/`hidden`, інвертований показ + radial-gradient). **C3 закрито (2026-06-16):** спільні `openModal/closeModal/initModal/initTabs` виявились МЕРТВИМИ (0 імпортів) → видалені; деталі в C3 нижче. Лишається свідомо невиконаним лише етап **«уніфікація родини A» (scanner + система A + auth)** — окремий проєкт із візуальним рішенням (radial→flat) і перебудовою JS-показу, поза цим аудитом.

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

### C1. Ввести z-index шкалу в токени (зробити ПЕРШИМ — безпечно) ✅ ЗРОБЛЕНО (коміт 9dc6a40)
**Як (2026-06-16):** додано `--z-base/sticky/dropdown/tab-bar/modal/modal-top/scanner/auth/cookie/toast` у `:root` ([_tokens.scss](scss/base/_tokens.scss)) зі значеннями, що ДОРІВНЮЮТЬ наявним магічним числам (нічого не зсунуто). Мігровано однозначні випадки (toast/cookie/auth/scanner/modal-overlay/modal/header-dropdown/tab-bar). Локальні stacking-контексти (1/2/10), book-selector 3000, week/shopping 300 свідомо лишені на потім (D3/C4).
**Файл:** [scss/base/_tokens.scss](scss/base/_tokens.scss) (або `_variables.scss`)
**Фікс:** додати `--z-dropdown: 500; --z-modal: 1000; --z-modal-top: 2000; --z-scanner: 2100; --z-toast: 10000;`
і поступово замінити магічні числа на змінні.
**Ризик:** мінімальний, якщо зберегти ті самі числові значення → візуально нічого не зміниться.

### C2. Створити спільні плейсхолдери (адитивно, нічого не ламає) ✅ ЗРОБЛЕНО (коміт eb68cfb)
**Як (2026-06-16):** додано `%overlay` (fixed+inset+flex center+blur, показ через `.is-open`) і `%modal-card` (поверхня+радіус+тінь) у [_design-system.scss](scss/utils/_design-system.scss). Доведено нульовий ризик: скомпільований css байт-у-байт ідентичний до/після (placeholder без `@extend` не потрапляє у вивід).
**Файл:** [scss/utils/_design-system.scss](scss/utils/_design-system.scss)
**Фікс:** додати `%overlay` (fixed+inset:0+flex center+blur) і `%modal-card`.
**На цьому кроці нічого не мігруємо** — лише створюємо інструмент.
**Ризик:** нульовий (новий код, ніхто ще не вживає).

### C3. Уніфікувати JS-контракт відкриття/закриття ✅ ЗРОБЛЕНО (2026-06-16)
> **Розв'язка виявилась іншою, ніж припускав аудит.** Перед тим, як чіпати спільну `openModal`, перевірено ТРИ місця (imports/HTML/динаміка) — і виявилось, що спільні `openModal`/`closeModal`/`initModal` ([ui-components.js](js/ui-components.js)) мали **0 справжніх споживачів**:
> - `meals.js` має **власні локальні** `openModal(mealKey, item)`/`closeModal()` (рядки 473/499) — не імпорт.
> - `cookbook.js` має **власні локальні** `openModal(modal)`/`closeModal(modal)` (рядки 165/169, працюють по `.is-active`) — не імпорт.
> - система B (report/book-selector/recipe) — своя логіка показу в своїх файлах.
> - 0 imports з ui-components, 0 в HTML, 0 динамічних викликів.
>
> Тобто описаний «непослідовний контракт» (`active`+`is-active`+`hidden` в одній функції) нікого не зламав би при зміні — бо функцію **ніхто не викликає**. Саме її існування й створювало ілюзію проблеми. **Жорстке правило аудиту (чіпати лише після переведення всіх модалок на `.is-open`) стало неактуальним** — споживачів нема.
>
> **Зроблено:** видалено мертві `openModal`/`closeModal`/`initModal` + заодно мертві `initTabs` (0 споживачів) і осиротілий імпорт `lockScroll/unlockScroll`. Кожна модалка лишилась зі своєю автономною (працюючою) логікою показу. `showConfirmModal`/`showLoading`/`showEmpty`/custom-select — живі, недоторкані. `node --check` OK, 0 дангліючих імпортів.
>
> **Що НЕ робили (свідомо):** не нав'язували єдиний `.is-open` усім модалкам — це означало б перебудову родини A (scanner/система A/auth) з radial-gradient і інвертованим показом, що C4 вже визнав окремим проєктом. Уніфікація CSS системи B (на `%overlay`/`%modal-card`) виконана в C4; JS-показ системи B лишився на `.is-active` (працює, окремих споживачів спільної функції не було).
**Файл:** [ui-components.js:183](js/ui-components.js#L183)
**Фікс:** одна пара `openModal/closeModal` з **одним** класом стану (напр. `.is-open`).
**Ризик:** ВИСОКИЙ — `openModal` зараз навмисно додає три варіанти, бо різні модалки слухають різні.

### C4. Мігрувати модалки на `%overlay`+`%modal-card`+`.is-open` — ПО ОДНІЙ
Порядок (від простих до складних): scanner → product/day → book-selector/report → recipe-modal → auth → onboarding/admin.
**Після кожної:** перевірити відкриття/закриття/клік по фону/Esc/scroll-lock саме цієї модалки.
**Ризик:** середній на кожній, але ізольований — ламається максимум одна модалка, одразу видно.

**Прогрес C4:**
- ✅ **report-modal** — ЗРОБЛЕНО + ПЕРЕВІРЕНО в браузері (коміт b44f3dc, 2026-06-16). Власний `.report-overlay @extend %overlay` (center, ізольовано від глобального `.modal-overlay` з flex-start+scroll для довгих модалок), `.report-modal @extend %modal-card`, показ `.is-active`→`.is-open`, close-кнопка відв'язана від глобального `.modal-card__close`. Глобальні класи НЕ змінені — recipe/book-selector/cookbook/shopping як раніше. Скріншот: центр/фон+blur/картка/форма/тост — ОК.
- ✅ **book-selector** — ЗРОБЛЕНО + ПЕРЕВІРЕНО в браузері (коміт 294fe8e, 2026-06-16). Дзеркально до report: `.book-selector-overlay @extend %overlay` (компактна, список має власний `max-height:300px`+scroll → center пасує), z-index **3000** збережено (над модалкою рецепта), `.book-selector @extend %modal-card`, показ `.is-active`→`.is-open`, власний `__close`. Глобальні класи недоторкані. ✅ ПЕРЕВІРЕНО в браузері.
- ✅ **Довгі модалки системи B (recipe-modal, recipe-detail, shop-edit, cookbook)** — глобальні `.modal-overlay`/`.modal-card` тепер `@extend %overlay`/`%modal-card` (коміт b20c1b7, 2026-06-16). **Варіант 2** (узгоджено): не власні класи на кожну, а сам глобальний клас extend-ить плейсхолдер — бо це їхній спільний компонент за дизайном, і вони ДОВГІ (треба `align:flex-start`+scroll, не center). SCSS-only, JS НЕ чіпали → показ лишився `.is-active` (перехід на `.is-open` — у C3). Нульовий регрес доведено діфом css проти HEAD. ✅ ПЕРЕВІРЕНО в браузері (recipe-modal/recipe-detail/shop-edit — ОК).
- ⚠️ **Дубль на потім:** `.report-modal__close` і `.book-selector__close` тепер однакові блоки (+ глобальний `.modal-card__close`). Звести в спільний `%modal-close` наприкінці C4, разом з C3.
- **Стан систем:** ✅ система B (короткі report/book-selector — власні overlay-класи; довгі recipe/detail/shop/cookbook — глобальний extend) вся на плейсхолдерах. ⏭️ родина «`hidden`+radial-gradient+вкладений overlay-div» — **система A** (`.modal`), **scanner**, **auth** — свідомо НЕ мігрується механічно (зламало б показ/вигляд); окремий етап. onboarding/admin — ще не дивились, імовірно теж окремі. Фінал — **C3** (JS-контракт), але лише для модалок системи B на `.is-open`; родину A це не зачіпає, поки не мігрована окремо.
- ⏭️ **scanner — ПРОПУЩЕНО** (хоч аудит ставив першим): структурно НЕ пасує `%overlay`. Фон малює ОКРЕМИЙ вкладений div `.scanner-modal__overlay`, показ через `hidden`-атрибут у JS (не `.is-open`), `.scanner-modal` сам — лише центруючий контейнер. Потребує перебудови розмітки+JS (камера, native+fallback). Повернутись окремо, коли решта простіших зроблена.
- ⏭️ **Система A (`.modal`: food-modal, create-product, product-guide product-modal, week-add) — ПРОПУЩЕНО** (рішення 2026-06-16). Той самий клас проблеми, що й scanner — структурно́ й ВІЗУАЛЬНО інша система:
  - **інвертована логіка показу:** `.modal` базово `display:flex` (видима), ховається через `.modal[hidden]{display:none}`. `%overlay` навпаки — базово `display:none`, показ через `.is-open`. Механічний `@extend` зробив би `.modal` базово прихованою → зламав би показ усіх цих модалок.
  - **окремий вкладений overlay-div** `.modal__overlay` з **radial-gradient** фоном (не flat `rgba(0,0,0,.7)`) + `blur(6px)` (не 8px); картка `.modal__content` має градієнтний фон + min-height 480px. Extend змінив би вигляд.
  - **різні JS-контракти:** food/create-product — власна `openModal` у [meals.js:473](js/meals.js#L473) (`modal.hidden=…`); cookbook — власна `openModal` у [cookbook.js:165](js/cookbook.js#L165) (`.is-active`); spільна [ui-components.js:183](js/ui-components.js#L183) (active+is-active+hidden). Міграція = перебудова розмітки+JS у 4+ місцях + візуальне рішення (radial→flat чи зберегти).
  - **Ризик високий** — зачіпає food-modal (найчастіша модалка щоденника). Робити окремим свідомим етапом, не в потоці «по одній».
- ⏭️ **auth-модалка — ПРОПУЩЕНО** (перевірено 2026-06-16: НЕ ближча до системи B, а належить до родини A). Та сама модель:
  - інвертований показ: `.auth-modal` базово `display:flex`, ховається через `&[hidden]{display:none}` + JS `modal.hidden=…` ([auth.js:667/676](js/auth.js#L667)). Не `%overlay` (display:none+.is-open).
  - окремий вкладений `.auth-modal__overlay` з **radial-gradient** + `blur(6px)`; картка `.auth-modal__window` — градієнт + власний overflow-scroll.
  - вищий z-index `--z-auth` (логін має бути над модалкою рецепта) — свідомо окрема.
  - Висновок: extend зламав би показ і змінив фон radial→flat. Мігрувати лише разом із системою A, окремим етапом (або не чіпати — auth самодостатня й працює).
- **Підсумок розгляду:** на `%overlay`/`%modal-card` реально лягає лише **система B** (flat-фон, центрування/скрол, клас-показ) — її закрито. Усі модалки з **`hidden`+radial-gradient+вкладений overlay-div** (система A, scanner, auth) — окрема родина, що НЕ мігрується механічно; це свідоме архітектурне рішення, не недогляд. Якщо колись робити — це окремий проєкт «уніфікація родини A» з візуальним рішенням (radial→flat) і перебудовою JS-показу.

---

## 🟢 БЛОК D. Кнопки/чіпи/картки (дублі стилів — косметика, але борг)

> Правило з [_buttons.scss:4](scss/components/_buttons.scss#L4): нові кнопки — через `@extend`. Порушено в кількох місцях.

### D1. Прибрати override `.btn-danger` ✅ ЗРОБЛЕНО (коміт e4951b4)
**Як (2026-06-15):** локальний `.btn-danger` у report-modal був НЕ дублем, а іншою кнопкою — суцільно-червоний фон/білий текст проти світло-рожевої глобальної. Кнопка «Надіслати скаргу» — submit головної дії форми (не видалення), тож переведено клас на `btn-confirm` (`@extend %button-primary`) і прибрано локальний override (хардкод `#e74c3c`, без dark-теми). Глобальна `.btn-danger` недоторкана. `css/main.css` перекомпільовано.
**Файл:** [_book-selector.scss:488](scss/components/_book-selector.scss#L488) — `.report-modal .btn-danger` перемальовує глобальну [.btn-danger](scss/components/_buttons.scss#L70).
**Фікс:** прибрати локальний блок, лишити глобальну; якщо потрібен відступ — лише його, без кольору.
**Ризик:** низький — звірити вигляд кнопки в report-modal до/після.

### D2. Перевести вручну-намальовані кнопки на `@extend` ✅ ЗРОБЛЕНО (3/3 групи)
> **Статус (2026-06-16): ✅ всі 3 групи зроблено** (розбито за СЕНСОМ, по групі, кожну звірено).
> - ✅ **Група 1 — головні зелені submit** (`auth-modal__submit`, `week-modal__manual-submit`) → `@extend %button-primary` (коміт 81a338c). Узгоджено канонічний вигляд (дрібні візуальні зміни radius/тінь/hover свідомі).
> - ✅ **Група 2 — перемикачі** (`settings-theme/lang/unit-btn`, `period-btn`) → `@extend %chip-toggle` (коміт 2729a42). Новий плейсхолдер `%chip-toggle` (м'який active, легітимний 2-й патерн чіпа) — вигляд НЕ змінено (доведено діфом).
> - ✅ **Група 3 — кнопки-дії** (коміт 828df65): `settings-edit-btn`→`%button-secondary`; `profile-actions__btn`→`%button-primary`; `settings-delete-btn`→новий `%button-danger` (видалення акаунту); `settings-action-btn` («Вийти»)→`%button-secondary`+червоний hover. Додано плейсхолдер `%button-danger`.
> - **Нові плейсхолдери з D2:** `%chip-toggle` (м'який чіп-перемикач), `%button-danger` (outline-червона деструктивна, ≠ рожева глобальна `.btn-danger`).
> - ⏳ **Перевірка в браузері (накопичено):** auth «Увійти»/«Створити акаунт»; week ручне додавання страви; профіль → тема/мова/одиниці + «Змінити»; статистика → період; «Оновити дані»; «Вийти з акаунту» (hover червоний); «Видалити акаунт».
>
> **⚠️ Дубль close-кнопок (з C4):** `.report-modal__close` + `.book-selector__close` + глобальний `.modal-card__close` однакові — звести в `%modal-close` (з C3, або тут).

**Файли:** `settings-theme/lang/unit-btn`, `period-btn`, `settings-edit-btn`, `settings-action-btn`,
[settings-delete-btn](scss/pages/_profile.scss#L2200), `auth-modal__submit`, `week-modal__manual-submit`, `profile-actions__btn`.
**Фікс:** outline-pill → `@extend %chip-filter` (існує, але вживається лише 1 раз!), головні зелені → `@extend %button-primary`, `.modal__confirm` → `@extend %button-primary`.
**⚠️ НЕ робити масову заміну всіх pill-кнопок на `%chip-filter` одним махом.** Візуальна схожість ≠ семантика:
`%chip-filter` — це фільтр/перемикач, а `settings-delete-btn`, `settings-action-btn` тощо — це **дії**, не чіпи.
Розбити на групи за СЕНСОМ: справжні перемикачі (`period-btn`, `settings-theme/lang/unit-btn` з `.active`-станом) → `%chip-filter`;
кнопки-дії → `%button-secondary`/`%button-primary`. Кожну групу мігрувати окремо й звіряти вигляд.
**Ризик:** низький-середній — звіряти вигляд кожної групи; робити по одній групі, не гуртом.

### D3. Дропдауни/меню — звести до одного компонента ✅ ЗРОБЛЕНО (2026-06-16)
> **Зроблено (адитивно, як C2 — нуль візуального ризику):** додано плейсхолдер `%dropdown-menu` ([_design-system.scss](scss/utils/_design-system.scss)) — лише **спільне ядро контейнера** випадайки: `position:absolute; background:surface; border:1px solid border; box-shadow:--shadow-3; overflow:hidden`. Мігровано **6 menu-панелей** через `@extend` (по одній, кожну звірено в скомпільованому CSS):
> - `lang-dropdown__menu` + `header__user-dropdown` ([_header.scss](scss/layout/_header.scss)),
> - `recipe-actions-menu__dropdown` ([_book-selector.scss](scss/components/_book-selector.scss)),
> - `shop-list-item__dropdown` ([_shopping-list.scss](scss/pages/_shopping-list.scss)),
> - `week-mobile__dropdown` ([_week-menu.scss](scss/pages/_week-menu.scss)),
> - **`day-menu-actions__dropdown`** ([_day-menu.scss](scss/pages/_day-menu.scss)) — **6-й, якого аудит не називав** (швидкі дії на «Меню на день»); знайдено в скомпільованому CSS.
>
> **Що СВІДОМО НЕ чіпали (тому нуль ризику):**
> - **Показ** — лишився різний у кожного: 3× `[hidden]` (lang/user/shop), 1× `[hidden]` (week-mobile), 2× анімований `opacity/transform`+`.is-open` (recipe-actions/day-menu). Уніфікація показу = окремий крок (як C3 для модалок), не робили.
> - **Пункти (items)** — структура/padding/font/danger-варіанти різні в кожного, НЕ зводили (дорого й крихко).
> - **Власні overrides збережено:** week-mobile й day-menu мають **легшу власну тінь** (`0 8px 24px` / `0 6px 20px`, не `--shadow-3`) — лишено через override після `@extend`. user-dropdown і day-menu НЕ мали `overflow` → повернуто `overflow:visible` (ядро додає `hidden`). Доведено: обчислені значення кожного селектора байт-у-байт = оригінал.
> - **bottom-sheet / ingredient-picker** (згадані в аудиті) — це **шторки/пікери**, не absolute-dropdown panels; інша структура показу → НЕ входять у `%dropdown-menu`, окремо.
> - **custom-select__options** теж не чіпали — це частина окремого custom-select компонента (D4/D5), не header-menu.
**Файли:** language/user dropdown ([_header.scss:115/312](scss/layout/_header.scss#L115)), recipe-actions ([_book-selector.scss:266](scss/components/_book-selector.scss#L266)), shopping ([_shopping-list.scss:630](scss/pages/_shopping-list.scss#L630)), week-mobile ([_week-menu.scss:1236](scss/pages/_week-menu.scss#L1236)), bottom-sheet, ingredient-picker — 7 окремих реалізацій.
**Фікс:** єдиний `%dropdown`/`%menu` плейсхолдер; мігрувати по одному.
**Ризик:** середній. Робити **після** модалок або взагалі окремим етапом.

### D4. custom-select fork у profile ✅ ЗРОБЛЕНО (2026-06-16)
> **Зроблено:** ручний `setupActivitySelect` (activityTypeSelect — тип фіз-активності з іконками) переведено на shared `initCustomSelect`. ~40 рядків клон-нод-логіки → виклик `initCustomSelect('activityTypeSelect','activityTypeInput', onChange)`, де `onChange` робить спецлогіку (показ `otherActivityInput` для `other` + `updateCaloriesPreview`). `injectActivityIcons()` лишився (готує опції перед init). clone-node для зняття listeners прибрано — guard `activityTrackerInitialized` гарантує одноразовий виклик.
> - **Розширено shared `initCustomSelect`+`setSelectValue`** ([ui-components.js](js/ui-components.js)): тригер тепер бере `option.innerHTML`, а не `textContent` → іконка `.nav-icon` зберігається. Безпечно для всіх споживачів (опції — статична розмітка в коді, не користувацький ввід; для опцій без іконок innerHTML===textContent). Споживачі: gender/activity/goal/report-reason/rm-category/activityType.
> - **Reset активності** (після додавання) лишився ручним — скидає в плейсхолдер «Оберіть активність...», для якого нема опції з data-value (setSelectValue не підходить).
> - `initSelectsGlobalListener()` уже є на сторінці ([:2076](js/profile.js#L2076)) → закриття по кліку поза селектом працює. Синтаксис перевірено (`node --check`).
> - ⏳ **Перевірка в браузері:** профіль → трекер активності → відкрити «Оберіть активність» (іконки в опціях ТА в тригері після вибору), вибрати «Інше» → зʼявляється поле власної назви, вибрати звичайну → поле ховається; превʼю калорій рахується; після «Додати» форма скидається в плейсхолдер.
**Файл:** [profile.js:1356](js/profile.js#L1356) (ручна логіка activity select) поряд з shared `initCustomSelect` [profile.js:2108](js/profile.js#L2108)
**Фікс:** перевести activity select на shared `initCustomSelect`, прибрати ручну гілку.
**Ризик:** середній — перевірити, що зміна активності зберігається.

### D5. Нативні `<select>` обходять кастомний компонент ✅ ЗРОБЛЕНО (2026-06-16)
> **Зроблено:** обидва нативні `<select>` публічного сайту переведено на наявний `custom-select` (нічого нового не винайдено, admin-app не чіпали).
> - **report-reason-select** ([book-selector.js](js/book-selector.js)): `<select class="form-select">` → `.custom-select` + hidden `<input id="report-reason-input" required>`. `initCustomSelect`+`initSelectsGlobalListener` один раз при створенні модалки; читання у `onsubmit` з hidden input ([:559](js/book-selector.js#L559)) + валідація «оберіть причину» (бо `required` на div не нативний); хелпер `resetReportReasonSelect()` скидає у плейсхолдер при кожному відкритті.
> - **rm-category** ([recipe-modal.js](js/recipe-modal.js)): `<select id="rm-category">` → `.custom-select id="rm-category-select"` + hidden `<input id="rm-category" value="lunch">`. **Hidden input навмисно зберіг id `rm-category`** → обидва читання `.value` ([:341](js/recipe-modal.js#L341)/[:571](js/recipe-modal.js#L571)) без змін; два записи `setInputVal` → `setSelectValue('rm-category-select','rm-category',…)`. `data-i18n` на опціях збережені.
> - **SCSS не чіпали** — `.custom-select` уже глобальний ([_profile.scss:278](scss/pages/_profile.scss#L278)), потрапляє в єдиний `main.css`. Синтаксис обох JS перевірено (`node --check`).
> - ⏳ **Перевірка в браузері (накопичено):** скарга на рецепт (дропдаун у темі сайту, сабміт без причини=помилка, з причиною=ОК); створення рецепта (категорія в темі сайту, вибір зберігається при редагуванні); відновлення чернетки після логіну; випадайка не обрізається скролом модалки.
> - **Нюанс на потім (не блокер):** стилі `.custom-select` лежать у `_profile.scss`, хоч компонент глобальний — винести в `components/` під час D3.
**Що не так:** у публічному сайті лишилися **нативні браузерні `<select>`** — у темному режимі/iOS вони виглядають системно (сірий фон, синє виділення опцій, системний шрифт), не в стилі сайту. Видно на report-modal (скріншот користувача).
**Де (лише публічний сайт, admin-app НЕ чіпати):**
- `report-reason-select` (`class="form-select"`) — [book-selector.js:489](js/book-selector.js#L489).
- `rm-category` — [recipe-modal.js:166](js/recipe-modal.js#L166).
**Готове рішення в репо:** компонент `custom-select` уже існує і стилізований у темі сайту — `initCustomSelect`/`setSelectValue`/`initSelectsGlobalListener` ([ui-components.js:18](js/ui-components.js#L18)), стилі `.custom-select` глобальні ([_profile.scss:278](scss/pages/_profile.scss#L278), вживається в профілі gender/activity/goal). **НЕ винаходити новий** — перевести обидва нативні select на цей патерн.
**Фікс:** розмітка `.custom-select` + `__trigger`(span) + `__options`/`__option[data-value]` + hidden `<input>`; навісити `initCustomSelect(selectId, inputId)`; читати значення з hidden input (не з `.value` select); додати `initSelectsGlobalListener()` на сторінці, якщо ще нема. Для report — оновити читання у `report-form.onsubmit` ([book-selector.js:537](js/book-selector.js#L537)).
**⚠️ Окремий нюанс (не блокер):** стилі `.custom-select` семантично лежать у `_profile.scss`, хоч компонент глобальний — варто винести в `components/` (напр. `_inputs.scss` чи окремий партіал) під час цього ж пункту або D3.
**Ризик:** низький-середній — перевірити, що значення коректно зчитується при сабміті (report-скарга, збереження категорії рецепта).
**Пріоритет:** косметика/UX, поза C4. Робити після уніфікації модалок або як окремий захід.

---

## ⚪ БЛОК E. Мертвий код (видаляти ОБЕРЕЖНО — спершу переконатись, що 0 використань)

> **Статус (2026-06-16): 🟨 майже завершено.** ✅ Видалено `lang-switcher-ui.js` (потрійна перевірка: 0 import-ів, 0 в html, `#langSwitcher` у meals/week-menu — це DOM-елемент, не цей модуль). ✅ storage `getActivityHistory/saveActivity/deleteActivity` + ключ `ACTIVITY_HISTORY` (коміт f8560c6). ✅ `openClearCellConfirm` (коміт 8131583). ✅ мертвий cover-picker шлях у cookbook — `openCoverPicker`+`selectCover`+`createCoverPickerModal`+SCSS (коміт 8412fd9). ⛔ `feature-flag.js` **лишено** — НЕ мертвий: [Roadmap_v2.md:632](Roadmap_v2.md#L632) тримає його як готову заготовку фіча-флагів (наступний крок — адмінка toggle). Лишилось хіба `utils.js` «бібліотека на майбутнє» (свідомо тримаємо).

> Перед видаленням кожного перевіряти **ТРИ** місця, не два:
> 1. grep по `js/` (імпорти, виклики);
> 2. grep по `*.html` (inline `onclick`/`onchange`);
> 3. **inline-генерація в шаблонних рядках** — у цьому репо реально трапляється
>    (підтверджено: [profile.js:1600](js/profile.js#L1600) `onclick="deleteActivity(${...})"` усередині template literal).
>    Звичайний grep за іменем функції це ловить, АЛЕ якщо виклик динамічний (`window[name]`, зібране ім'я через конкатенацію) — текстовий пошук проґавить. Тому для кожного кандидата окремо грепнути ще й `window\.` + саме ім'я та перевірити, чи воно не складається динамічно.
> Видаляти по одному, комітити окремо.

### Підтверджено мертве (безпечно):
- **Файли цілком:** ~~lang-switcher-ui.js~~ ✅ ВИДАЛЕНО (2026-06-15). ⚠️ `feature-flag.js` — **НЕ видаляти** (заготовка з [Roadmap_v2.md:632](Roadmap_v2.md#L632), а не мертвий код; аудит тут помилявся).
- ✅ `searchOwnShowAll` — ВИДАЛЕНО (коміт b41eee6). Перевірено асиметрію з живим `searchCommunityShowAll`.
- ✅ `openClearCellConfirm()` (week-menu.js) — ВИДАЛЕНО (коміт 8131583). Мало лише оголошення, 0 викликів. `showConfirmModal` лишився (живий в інших місцях).
- ✅ Мертвий cover-picker шлях у cookbook — ВИДАЛЕНО (коміт 8412fd9). **Поправка до аудиту:** `createCoverPickerModal()` теж виявилась мертвою — вона створювала `#coverPickerModal`, але заповнював/відкривав її ВИКЛЮЧНО `openCoverPicker` (0 викликів), тож обидві + `selectCover` видалено разом із викликом з `_onUserReady` і осиротілим SCSS `.cookbook-cover-picker-modal`. Жива cover-picker іде через `editCoverGrid`/`renderCoverGridHTML` — не чіпали.
- ✅ Мертві імпорти ВИДАЛЕНО (коміт 59cf278): `removeRecipeFromBook/removeRecipeFromAllBooks/getRecipeBooks` (add-recipe), `iconCheck/iconVeg/iconPlate` (meals), `getWeightHistory/addWeightRecord` (profile).
- ✅ Невикористані експорти: `getBooks/removeRecipeFromAllBooks` ВИДАЛЕНО (коміт 660ca53) + `getWeightHistory/addWeightRecord` із storage (коміт b41eee6) + `setIngredients` із recipe-ingredients.js (0 споживачів; `setIngredientsFromText` — інша, жива).
- ✅ Константи `WEIGHT_HISTORY_KEY/ACTIVITY_HISTORY_KEY` (profile.js) + осиротілий `STORAGE_KEYS.WEIGHT_HISTORY` — ВИДАЛЕНО (коміт b41eee6).

### ⚠️ УВАГА — НЕ переплутати (тут легко зламати):
- ✅ **storage.js** `getActivityHistory/saveActivity/deleteActivity` — ВИДАЛЕНО (коміт f8560c6). deprecated localStorage-версії (0 import-ів, 0 в html). Прибрано й осиротілий ключ `STORAGE_KEYS.ACTIVITY_HISTORY`.
  profile.js має ВЛАСНІ однойменні `getActivityHistory`/`deleteActivity` (Supabase-версії, виставлена `window.deleteActivity`, inline `onclick`) — **НЕ чіпали**, це локальні функції, не import зі storage.
- `utils.js` невживані: `getCurrentLang, formatDateShort/Full, truncateText, throttle, isNotEmpty, generateId, initAutoResizeTextareas` — частина «бібліотека на майбутнє». Видаляти лише якщо точно вирішили, що не потрібні; інакше лишити.
  - **Оновлено в межах F (2026-06-16):** `getLocalizedName` і `formatAmount` ВИДАЛЕНО (були мертві дублі, див. блок F). `convertToBaseUnit` тепер **ЖИВИЙ** — week-menu імпортує його як єдине джерело конвертації одиниць (F).

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

> **✅ БЛОК F ПОВНІСТЮ ЗРОБЛЕНО (2026-06-16)** — по одному хелперу, кожен із перевіркою всіх викликів + `node --check`. Деталі нижче.

- ✅ **formatAmount** — НЕ дубль-зведення, а **видалення мертвого**: utils-копія мала 0 імпортів (мертвий експорт), жива версія — `parse-food.formatAmount` (єдиний споживач add-recipe). utils-копію видалено.
- ✅ **Локалізація назви рецепта** — теж видалення мертвого: `utils.getLocalizedName` мав 0 справжніх споживачів (recipe-page має ВЛАСНУ локальну `_getLocalizedName`, не імпорт). Жива — `getRecipeDisplayName` (recipe-utils, споживачі add-recipe/week-menu). utils.getLocalizedName видалено. `getCurrentLang` лишено (E тримає, не дубль).
- ✅ **Плюралізація UA** — створено `pluralUA(n,[one,few,many])` в [utils.js](js/utils.js). Зведено **5 копій** (аудит називав 4, знайшовся 5-й — `getDayWord` у profile.js): `getDishWord` (meal-accordion), `getDayWord` (streak), `getDayWord` (profile), `recipesLabel` (cookbook), inline `countWord` (week-menu). **Бонус-фікс:** week-menu мав баг `count<5` → 'страви' для 12-14; тепер коректно 'страв'. Unit-тест граничних чисел пройдено.
- ✅ **Конвертація одиниць** — week-menu `unitConversion` (локальна `{base,factor}`) = дубль `utils.UNIT_CONVERSIONS`; переведено week-menu на **`convertToBaseUnit`** (utils) як єдине джерело → мертвий експорт ОЖИВ. **parse-food.UNIT_CONVERSIONS НЕ чіпали** — це інша семантика (плоска мапа «одиниця→грамів» з oz/lb/синонімами, частина парсера), не дубль.
- ✅ **resolveScannedProduct** — приватну версію в barcode-scanner перейменовано на `applyUserCorrections` (описова назва: застосовує особисту правку макросів). parse-food export-версію (створення продукту в БД, споживач recipe-ingredients) недоторкано. Колізія імен усунена.

**Ризик усього блоку F:** середній (рефакторинг спільних функцій зачіпає багато місць).
Робити **останнім**, по одному хелперу, з перевіркою всіх викликів.

---

## 🌍 БЛОК G. Повний переклад сайту на 3 мови (UA/PL/EN) — ВЕЛИКА ОКРЕМА РОБОТА

> **Контекст (додано 2026-06-15):** блок B локалізував лише 4 точкові місця (product-guide,
> розпізнавання інгредієнтів, мобільна нав-панель, сторінка рецепта). Перемикач мови UA/PL/EN
> працює і **зберігає** вибір, але перекладає тільки ці підключені фрагменти. Решта сайту
> захардкоджена українською — це підтверджено в браузері (профіль чесно показує тост
> «повний переклад профілю ще в роботі»; футер, головна, хедер — UA).
>
> **Це не баг блоку B**, а окремий невиконаний обсяг роботи. Виносимо в самостійний блок.

> **🟨 Статус (2026-06-16): ІТЕРАЦІЯ 1 ЗРОБЛЕНО — механізм + спільні partials (header/footer).**
> Узгоджено: глобальний застосувач + reload + спочатку header/footer.
> - **Створено [js/i18n-apply.js](js/i18n-apply.js)** — глобальний застосувач: проходить `[data-i18n]` / `[data-i18n-placeholder]` / `[data-i18n-aria]` і підставляє з [i18n.js](js/i18n.js) для поточної мови. Експортує `t(key,lang)` + `applyTranslations(root)`. Канон мови — **`'ua'`** (= storage.getLang() + словник); `uk` нормалізується в `ua` (recipe-page локально вживає uk). Auto-init на DOMContentLoaded. Виставляє `<html lang>`.
> - **Оживлено перемикач мови** (footer `site-footer__lang-btn[data-lang]`, раніше БЕЗ обробника): `initLangSwitcher()` підсвічує активну, на клік `setLang`+`location.reload()` (узгоджений підхід — чисто перемальовує весь контент, включно з динамічним JS-рендером).
> - **build.js** інжектить `i18n-apply.js` на всі 14 сторінок (ідемпотентно, як cookie-consent). Запущено — 14/14 оновлено.
> - **Розмічено data-i18n:** footer (tagline, 3 колонки, всі лінки — десктоп + мобільний accordion) + header (вже мав ключі; прибрано безглуздий `data-i18n="logo"` на `<img>`). Додано всі ключі в i18n.js (ua/pl/en): `login, toggleTheme, navDayMenu/WeekMenu/ProductGuide/ShoppingList, footerTagline, footerCol*, footer*`. Повноту ключів і логіку `t()` для 3 мов перевірено node-тестом.
> - ⏳ **Перевірка в браузері:** на будь-якій сторінці footer-перемикач UA→PL→EN → reload → header+footer перемальовуються потрібною мовою; вибір зберігається між сторінками; `<html lang>` оновлюється.
> - **➡️ Далі (наступні ітерації):** головна (index) → профіль → week/shopping/cookbook/recipes. Підхід той самий: розставити data-i18n + наповнити словник. Динамічний JS-рендер (де текст не в HTML, а будується в JS) — перекладати через імпорт `t()` з i18n-apply або викликати `applyTranslations()` після рендеру.

### Що ще НЕ перекладається (зібрано зі скриншотів + коду):
- ✅ **Футер** — ЗРОБЛЕНО (ітерація 1): колонки/лінки/слоган через data-i18n + застосувач.
- ✅ **Хедер** — ЗРОБЛЕНО (ітерація 1): пункти меню десктоп через data-i18n + застосувач.
- **(нижче — ще НЕ зроблено, наступні ітерації)**
- **Головна (index / меню на день):** Сніданок/Перекус/Обід/Вечеря, КАЛОРІЇ/ЦІЛЬ, ЖИРИ/ВУГЛЕВОДИ,
  ШВИДКІ ДІЇ (Скопіювати/Вставити/Очистити день), вода (+0.25 л…), «N днів поспіль», «Разом за день».
- 🟨 **Головна (index / меню на день)** — ІТЕРАЦІЯ 2 (2026-06-16): **статична розмітка ЗРОБЛЕНА.**
  - Виявлено: index.html **уже був густо розмічений** `data-i18n` (57 ключів: breakfast/lunch/dinner/snack, quickActions, copy/insert/clearDay, water, dayTotal, macros, createProduct, модалки продукту тощо) — але ніхто їх не застосовував. Глобальний застосувач (ітерація 1) тепер їх підхоплює автоматично.
  - Додано в словник (ua/pl/en) 24 відсутні ключі. Текст у 3 кнопках day-menu-actions (copy/insert/clear з вкладеним svg) обгорнуто у `<span data-i18n>`, щоб `textContent` не стер іконку. Повноту 57 ключів × 3 мови перевірено.
  - ✅ **Динамічний JS-рендер meals.js — ЗРОБЛЕНО (ітерація 3, 2026-06-16).** meals.js уже мав локальну `t(key)` + import i18n — зміцнено її (норм. uk→ua + фолбек lang→ua→ключ, раніше `i18n[lang][key]` без захисту). Локалізовано весь видимий динамічний контент: toast'и (копіювання/вставка дня, помилки), confirm-модалки («Точно видалити?»/«Очистити весь день?» + «Так»), пошук («Продукти»/«Страви»/«Нічого не знайдено»/«Створити свій продукт»), бейджі («Мій»/«сире»/scanned-title), hint'и на 100 г, «Без назви», grams-лейбл, alert'и (назва продукту/збереження). +24 ключі ×3 мови. Замінено й непослідовні inline-тернарники `lang==='ua'?…:…` (часто без PL) на `t()` → тепер повний PL. console.error лишено UA (для розробника). Мертва гілка `#langSwitcher` (елемента нема в DOM) не чіпалась — поза G.
  - **⏭️ ГОЛОВНА (index) ПОВНІСТЮ ЗАКРИТА** (статика ітер.2 + динаміка ітер.3). Лишається streak-слово «днів» (pluralUA-форма UA-хардкод у streak.js) — дрібниця на потім.
  - ⚠️ **Побічно виявлено (не блокер, передіснуючий):** `build.js` НЕідемпотентний — відступи перед `<header>`/`<footer>` накопичуються щозапуску (косметика, не впливає на рендер). Окремий дрібний баг build.js, не частина G.
- 🟨 **Профіль (profile.html)** — ІТЕРАЦІЯ 4, частина А (2026-06-16): **вкладка «Налаштування» + перемикач ЗРОБЛЕНІ.**
  - **Виправлено перемикач мови профілю** (`settings-lang-btn`): profile.js мав власний обробник, що робив `setLang` + тост «повний переклад профілю ще в роботі» БЕЗ reload (тому переклад не застосовувався). Тепер — `setLang` + `location.reload()` (як footer), тост прибрано. (initLangSwitcher з i18n-apply НЕ чіпали — щоб не дублювати обробник.)
  - **Розмічено data-i18n** уся вкладка Налаштування: Загальні (Тема/Мова/Одиниці + підписи), Акаунт (Нікнейм/Змінити/nickname-editor), Сповіщення (нотатка + 2 рядки), Небезпечна зона. Заголовки з вкладеним svg — текст обгорнуто в `<span data-i18n>`. +23 ключі ×3 мови (save/cancel перевикористано). Підпис «Мова» змінено з «...повний переклад сторінки ще в роботі» на «Мова інтерфейсу сайту».
  - ⏭️ **Решта профілю — частина Б (наступний коміт):** вкладка «Мої дані» (параметри/норма БЖВ/ІМТ), Контроль ваги, Активність (типи/історія), Статистика (графіки/топи) — статика HTML + **динамічний profile.js** (2121 рядок: статистика, активності, повідомлення рендеряться в JS).
- **Інші сторінки:** week-menu, shopping-list, cookbook, recipes (список) — пройти кожну.

### Підхід (щоб не повторити точковість блоку B):
1. **Інвентаризація**: пройтися по всіх `*.html` partial-ах (header/footer) і page-JS, зібрати
   всі захардкоджені UA-рядки в один список.
2. **Єдине джерело**: розширити [i18n.js](js/i18n.js) (або винести у namespaced-словники), уже є
   патерн `i18n[getLang()][key]` + `data-i18n` атрибути в HTML.
3. **Спільні partials першими** (header/footer) — максимальне покриття за мінімум роботи.
4. Далі сторінка за сторінкою; після кожної — перевірка перемиканням UA→PL→EN у браузері.
5. Узгодити ключ мови: recipe-page вживає `'uk'`, решта — `'ua'` (`_getLang` мапить `ua→uk`).
   Звести до одного канону, щоб не плодити розбіжності.

**Ризик:** середній — багато рядків, легко щось пропустити; робити інвентаризацію, не «на око».
**Пріоритет:** окремий від решти аудиту; погоджується з власником коли братись.

---

## ✅ Що вже добре (НЕ чіпати)
- Дизайн-система: токени + `%button-*`/`%chip-*`/`%premium-card` ([_design-system.scss](scss/utils/_design-system.scss)).
- Toast як компонент (JS [utils.js:21](js/utils.js#L21) + [_toast.scss](scss/components/_toast.scss)) — лише A5 (екранування).
- Spacing/radius/shadow токени, header/footer як спільні partials, skeleton, cookie-consent.
- Більшість page-кнопок реально через `@extend`.

---

## 📋 Рекомендований порядок виконання

**Етап 1 — баги, що псують дані (швидко, високий ефект): ✅ ВЕСЬ ЕТАП ЗРОБЛЕНО**
~~A1 (макроси) → A2 (recipe-page select) → A5 (toast XSS) → A6 (GDPR) → A3 (OAuth) → A4 (синхронізація) → A7 (rollback).~~

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

**Окремо (поза послідовністю, велика робота, коли погодимо):**
G — повний переклад сайту на 3 мови (footer/header → головна → профіль → решта сторінок).

> Після КОЖНОГО пункту: запустити сторінку, перевірити сценарій із розділу «Перевірка», закомітити окремо.
> Якщо щось ламається — відкотити саме цей коміт, а не накопичувати зміни.
