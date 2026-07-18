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
const OFFLINE_SCRIPT = '<script type="module" src="js/offline-indicator.js"></script>';
const BACKTOTOP_SCRIPT = '<script type="module" src="js/back-to-top.js"></script>';

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

  // Інжектимо offline-індикатор і кнопку "Нагору" (ідемпотентно).
  for (const script of [OFFLINE_SCRIPT, BACKTOTOP_SCRIPT]) {
    const src = script.match(/src="([^"]+)"/)[1];
    if (!html.includes(src)) {
      const bodyClose = html.lastIndexOf('</body>');
      if (bodyClose !== -1) {
        html = html.slice(0, bodyClose) + script + '\n  ' + html.slice(bodyClose);
        changed = true;
      }
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

  if (changed) {
    fs.writeFileSync(page, html, 'utf8');
    console.log(`  ✓  ${page}`);
    updated++;
  } else {
    console.log(`  –  ${page} (no change)`);
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped.`);
