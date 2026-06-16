// build.js — inject shared header/footer partials into all HTML pages
// Run: node build.js
// No external dependencies required.

const fs = require('fs');

// stripBom — прибирає BOM (U+FEFF) з усього тексту. Partials історично
// зберігались з BOM, через що кожен build інжектив зайвий BOM у сторінки.
const stripBom = (s) => s.replace(/﻿/g, '');

const header = stripBom(fs.readFileSync('partials/header.html', 'utf8')).trimEnd();
const footer = stripBom(fs.readFileSync('partials/footer.html', 'utf8')).trimEnd();

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

  if (changed) {
    fs.writeFileSync(page, html, 'utf8');
    console.log(`  ✓  ${page}`);
    updated++;
  } else {
    console.log(`  –  ${page} (no change)`);
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped.`);
