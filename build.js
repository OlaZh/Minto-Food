// build.js — inject shared header/footer partials into all HTML pages
// Run: node build.js
// No external dependencies required.

const fs = require('fs');

const header = fs.readFileSync('partials/header.html', 'utf8').trimEnd();
const footer = fs.readFileSync('partials/footer.html', 'utf8').trimEnd();

const HEADER_START = '<header class="header">';
const HEADER_END   = '</header>';
const FOOTER_START = '<footer class="site-footer">';
const FOOTER_END   = '</footer>';

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

  const h = replaceBlock(html, HEADER_START, HEADER_END, header);
  if (h.changed) { html = h.html; changed = true; }

  const f = replaceBlock(html, FOOTER_START, FOOTER_END, footer);
  if (f.changed) { html = f.html; changed = true; }

  if (changed) {
    fs.writeFileSync(page, html, 'utf8');
    console.log(`  ✓  ${page}`);
    updated++;
  } else {
    console.log(`  –  ${page} (no change)`);
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped.`);
