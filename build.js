// build.js — inject shared header/footer partials into all HTML pages
// Run: node build.js
// No external dependencies required.

const fs = require('fs');

// stripBom — прибирає BOM (U+FEFF) з усього тексту. Partials історично
// зберігались з BOM, через що кожен build інжектив зайвий BOM у сторінки.
const stripBom = (s) => s.replace(/﻿/g, '');

// trim() з обох боків: провідні пробіли в partial інакше додаються до
// відступу перед <header>/<footer> на КОЖНОМУ білді (неідемпотентність)
const header = stripBom(fs.readFileSync('partials/header.html', 'utf8')).trim();
const footer = stripBom(fs.readFileSync('partials/footer.html', 'utf8')).trim();

const HEADER_START = '<header class="header">';
const HEADER_END   = '</header>';
const FOOTER_START = '<footer class="site-footer">';
const FOOTER_END   = '</footer>';

// Глобальний cookie-консент: підключається на кожну сторінку перед </body>.
// Модуль сам себе ініціалізує (auto-init), тому достатньо тега <script>.
const COOKIE_SCRIPT = '<script type="module" src="js/cookie-consent.js"></script>';

// Глобальний застосувач перекладів (G): проходить data-i18n у header/footer
// (і будь-де на сторінці) + оживляє перемикач мови. Auto-init, як cookie.
const I18N_SCRIPT = '<script type="module" src="js/i18n-apply.js"></script>';

// Глобальний offline-індикатор + кнопка "Нагору". Auto-init, як cookie.
// Абсолютні шляхи: сторінки рецептів відкриваються через rewrite /recipe/:slug,
// де відносний "js/..." резолвиться у "/recipe/js/..." (404).
const OFFLINE_SCRIPT = '<script type="module" src="/js/offline-indicator.js"></script>';
const BACKTOTOP_SCRIPT = '<script type="module" src="/js/back-to-top.js"></script>';

// PostHog (Фаза 16). Auto-init, respect consent — без ключа (meta
// minto-posthog-key) просто не вантажиться, нічого не ламає.
const ANALYTICS_SCRIPT = '<script type="module" src="/js/analytics.js"></script>';

// Sentry (Фаза 16). Auto-init, transactional (не за cookie-consent) — без
// DSN (meta minto-sentry-dsn) просто не вантажиться. У <head> (не перед
// </body> як інші auto-init скрипти), щоб ловити помилки завантаження
// сторінки, а не лише ті, що трапляються після повного рендеру.
const ERROR_TRACKING_SCRIPT = '<script type="module" src="/js/error-tracking.js"></script>';

// Реальне підставлення PostHog/Sentry ключів (Фаза 16): Vercel виконує
// `npm run build` (buildCommand у vercel.json) з доступом до env vars,
// заданих у Vercel dashboard. Тут — і ЄДИНЕ місце — де ці значення
// потрапляють у статичний HTML як <meta> теги, які analytics.js/
// error-tracking.js читають у браузері. Без env vars (локальна розробка,
// або ще не зареєстровано акаунт) — блок порожній, нічого не інжектиться.
const RUNTIME_KEY_MARKER_START = '<!-- runtime-keys:start -->';
const RUNTIME_KEY_MARKER_END = '<!-- runtime-keys:end -->';

function buildRuntimeKeysBlock() {
  const metas = [];
  if (process.env.POSTHOG_KEY) {
    metas.push(`<meta name="minto-posthog-key" content="${process.env.POSTHOG_KEY}" />`);
  }
  if (process.env.POSTHOG_HOST) {
    metas.push(`<meta name="minto-posthog-host" content="${process.env.POSTHOG_HOST}" />`);
  }
  if (process.env.SENTRY_DSN_PUBLIC) {
    metas.push(`<meta name="minto-sentry-dsn" content="${process.env.SENTRY_DSN_PUBLIC}" />`);
  }
  if (metas.length === 0) return '';
  return `${RUNTIME_KEY_MARKER_START}\n    ${metas.join('\n    ')}\n    ${RUNTIME_KEY_MARKER_END}`;
}

// Head-теги: іконки (генеруються scratchpad/gen-icons → img/) + дефолтний
// OG-image для сторінок без власного. Абсолютний URL оновити після
// переїзду на власний домен (Фаза 17).
const HEAD_ICON_LINKS =
  '<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png" />\n' +
  '    <link rel="apple-touch-icon" sizes="180x180" href="/img/apple-touch-icon.png" />';
// Web app manifest (PWA-фундамент, Фаза 21/26) + theme-color для мобільних
// браузерів. Іконки 192/512 вже генеруються scripts/gen-icons.mjs.
const HEAD_MANIFEST_LINKS =
  '<link rel="manifest" href="/manifest.json" />\n' +
  '    <meta name="theme-color" content="#4ab584" />';
const HEAD_BACKGROUND_PRELOAD =
  '<link rel="preload" as="image" href="/img/terms-botanical-bg.webp" type="image/webp" fetchpriority="high" />';
const OG_IMAGE_META =
  '<meta property="og:image" content="https://minto-food.vercel.app/img/og-default.png" />\n' +
  '    <meta property="og:image:width" content="1200" />\n' +
  '    <meta property="og:image:height" content="630" />';

const pages = [
  'index.html',
  'week-menu.html',
  'recipes.html',
  'recipe.html',
  'shopping-list.html',
  'product-guide.html',
  'cookbook.html',
  'profile.html',
  'shared-list.html',
  'privacy.html',
  'terms.html',
  'cookies.html',
  'imprint.html',
  'dmca.html',
  '404.html',
  '500.html',
];

function replaceBlock(html, startMarker, endMarker, replacement) {
  const s = html.indexOf(startMarker);
  if (s === -1) return { html, changed: false };
  const e = html.indexOf(endMarker, s);
  if (e === -1) return { html, changed: false };
  const next = html.slice(0, s) + replacement + html.slice(e + endMarker.length);
  return { html: next, changed: next !== html };
}

let updated = 0;
let skipped = 0;

for (const page of pages) {
  if (!fs.existsSync(page)) {
    console.warn(`  skip  ${page} (not found)`);
    skipped++;
    continue;
  }

  let html = fs.readFileSync(page, 'utf8');
  let changed = false;

  // Прибрати накопичений BOM-сміття, який попередні build-и інжектили
  // в тіло сторінки перед <header>/<footer>.
  const cleaned = stripBom(html);
  if (cleaned !== html) { html = cleaned; changed = true; }

  const h = replaceBlock(html, HEADER_START, HEADER_END, header);
  if (h.changed) { html = h.html; changed = true; }

  const f = replaceBlock(html, FOOTER_START, FOOTER_END, footer);
  if (f.changed) { html = f.html; changed = true; }

  // Інжектимо cookie-консент перед </body>, якщо його ще немає (ідемпотентно).
  if (!html.includes('js/cookie-consent.js')) {
    const bodyClose = html.lastIndexOf('</body>');
    if (bodyClose !== -1) {
      html = html.slice(0, bodyClose) + COOKIE_SCRIPT + '\n  ' + html.slice(bodyClose);
      changed = true;
    }
  }

  // Інжектимо i18n-застосувач перед </body>, якщо його ще немає (ідемпотентно).
  if (!html.includes('js/i18n-apply.js')) {
    const bodyClose = html.lastIndexOf('</body>');
    if (bodyClose !== -1) {
      html = html.slice(0, bodyClose) + I18N_SCRIPT + '\n  ' + html.slice(bodyClose);
      changed = true;
    }
  }

  // Інжектимо offline-індикатор, кнопку "Нагору" і аналітику (ідемпотентно).
  for (const script of [OFFLINE_SCRIPT, BACKTOTOP_SCRIPT, ANALYTICS_SCRIPT]) {
    const src = script.match(/src="([^"]+)"/)[1];
    // Dedup за іменем файла, щоб зміна шляху (js/… → /js/…) не давала дубля.
    const basename = src.split('/').pop();
    if (!html.includes(basename)) {
      const bodyClose = html.lastIndexOf('</body>');
      if (bodyClose !== -1) {
        html = html.slice(0, bodyClose) + script + '\n  ' + html.slice(bodyClose);
        changed = true;
      }
    }
  }

  // Sentry — В <head>, окремо від решти (ідемпотентно). Мусить вантажитись
  // якомога раніше, щоб ловити помилки під час завантаження сторінки.
  if (!html.includes('error-tracking.js')) {
    const headClose = html.indexOf('</head>');
    if (headClose !== -1) {
      html = html.slice(0, headClose) + '    ' + ERROR_TRACKING_SCRIPT + '\n  ' + html.slice(headClose);
      changed = true;
    }
  }

  // Head: preload the shared above-the-fold background before the stylesheet.
  if (!html.includes('rel="preload" as="image" href="/img/terms-botanical-bg.webp"')) {
    const stylesheetStart = html.search(/<link\s+rel=["']stylesheet["']/i);
    const insertAt = stylesheetStart !== -1 ? stylesheetStart : html.indexOf('</head>');
    if (insertAt !== -1) {
      html =
        html.slice(0, insertAt) +
        HEAD_BACKGROUND_PRELOAD +
        '\n    ' +
        html.slice(insertAt);
      changed = true;
    }
  }

  // Head: PNG-favicon + apple-touch-icon (ідемпотентно).
  if (!html.includes('apple-touch-icon')) {
    const headClose = html.indexOf('</head>');
    if (headClose !== -1) {
      html = html.slice(0, headClose) + '    ' + HEAD_ICON_LINKS + '\n  ' + html.slice(headClose);
      changed = true;
    }
  }

  // Head: manifest + theme-color (ідемпотентно).
  if (!html.includes('rel="manifest"')) {
    const headClose = html.indexOf('</head>');
    if (headClose !== -1) {
      html = html.slice(0, headClose) + '    ' + HEAD_MANIFEST_LINKS + '\n  ' + html.slice(headClose);
      changed = true;
    }
  }

  // Head: дефолтний og:image — лише якщо сторінка не має власного.
  if (!html.includes('og:image')) {
    const headClose = html.indexOf('</head>');
    if (headClose !== -1) {
      html = html.slice(0, headClose) + '    ' + OG_IMAGE_META + '\n  ' + html.slice(headClose);
      changed = true;
    }
  }

  // Head: PostHog/Sentry runtime keys — перезаписуємо блок, ЯКЩО значення
  // env vars реально відрізняються від того, що вже в файлі (не лише
  // "якщо відсутній" — includes()-guard дав би "старий ключ застряг
  // назавжди"). Порівнюємо ВМІСТ, а не факт наявності старого блоку: без
  // цього другий build з ТИМИ САМИМИ env vars все одно видаляв і
  // перевставляв ідентичний блок щоразу — 16 updated замість 0.
  //
  // ВАЖЛИВО про whitespace: попередні вставки (сюди і в error-tracking/
  // favicon/manifest/og-image вище) всі мають форму `'    ' + BLOCK + '\n  '`
  // безпосередньо перед </head> — префікс/суфікс НЕ входять у самі
  // маркери START/END. Якщо видаляти ЛИШЕ текст між START/END (без
  // прилеглих '    '/'\n  ', які лишились від ЦІЄЇ САМОЇ вставки на
  // попередньому build), лишається рядок з самих пробілів — trailing
  // whitespace. Тому видалення тут явно захоплює і leading '    ' перед
  // START, і будь-які порожні (whitespace-only) рядки одразу після END.
  {
    const startIdx = html.indexOf(RUNTIME_KEY_MARKER_START);
    let existingBlock = null; // сам блок START..END, для порівняння вмісту
    let removeStart = -1;
    let removeEnd = -1;

    if (startIdx !== -1) {
      const endIdx = html.indexOf(RUNTIME_KEY_MARKER_END, startIdx) + RUNTIME_KEY_MARKER_END.length;
      existingBlock = html.slice(startIdx, endIdx);

      // Межі ФАКТИЧНОГО видалення ширші за сам блок: назад через
      // пробіли/таби до leading indent перед START, вперед через один
      // trailing '\n' + пробіли одразу після END — саме той whitespace,
      // що вставлявся РАЗОМ із блоком ('    '+BLOCK+'\n  '). Без цього
      // видалення лишає рядок із самих пробілів.
      removeStart = startIdx;
      while (removeStart > 0 && (html[removeStart - 1] === ' ' || html[removeStart - 1] === '\t')) removeStart--;

      removeEnd = endIdx;
      const trailingWs = html.slice(endIdx).match(/^\n[ \t]*/);
      if (trailingWs) removeEnd += trailingWs[0].length;
    }

    const desiredBlock = buildRuntimeKeysBlock() || null;

    if (existingBlock !== desiredBlock) {
      if (removeStart !== -1) {
        html = html.slice(0, removeStart) + html.slice(removeEnd);
        changed = true;
      }

      if (desiredBlock) {
        const headClose = html.indexOf('</head>');
        if (headClose !== -1) {
          html = html.slice(0, headClose) + '    ' + desiredBlock + '\n  ' + html.slice(headClose);
          changed = true;
        }
      }
    }
  }

  if (changed) {
    fs.writeFileSync(page, html, 'utf8');
    console.log(`  ✓  ${page}`);
    updated++;
  } else {
    console.log(`  –  ${page} (no change)`);
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped.`);
