// =============================================================
// Генератор брендових іконок MintoFood — "матове скло + пульс-М"
// (стиль затверджено 18.07.2026 за референсом власниці)
//
// Запуск:  node scripts/gen-icons.mjs
// Пише в img/: favicon.ico (16/32/48), favicon-32.png,
//   apple-touch-icon.png (180), icon-192.png, icon-512.png,
//   og-default.png (1200x630)
//
// sharp береться з admin-app/node_modules (окремо не ставити).
// =============================================================

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'admin-app', 'package.json'));
const sharp = require('sharp');
const OUT = path.join(ROOT, 'img');

// ── Лінія пульсу (великий макет): рівна → округлий горбик → малий сплеск →
//    великий пік → глибока V → другий пік → округлий горбик → рівна
const BG_TOP = '#cbe2d4';
const BG_BOT = '#8fbca0';
const OUTLINE = '#2f5a44';

const pulseBig = `
  M -10 258
  L 84 258
  C 94 258 97 232 110 232
  C 123 232 126 258 136 258
  L 152 258
  L 167 214
  L 180 258
  L 212 106
  L 256 356
  L 298 118
  L 330 258
  C 340 258 344 230 357 230
  C 370 230 373 258 383 258
  L 522 258`;

const bigIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BG_TOP}"/>
      <stop offset="1" stop-color="${BG_BOT}"/>
    </linearGradient>
    <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#c4ccc8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="120" fill="url(#bg)"/>
  <path d="${pulseBig}" stroke="${OUTLINE}" stroke-width="17" fill="none"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
  <path d="${pulseBig}" stroke="url(#silver)" stroke-width="9" fill="none"
        stroke-linecap="round" stroke-linejoin="round"/>
  <!-- об'єм "трубки": тінь по нижньому краю + білий відблиск по верхньому -->
  <path d="${pulseBig}" stroke="#96a59e" stroke-width="3.2" fill="none" opacity="0.7"
        stroke-linecap="round" stroke-linejoin="round" transform="translate(0,2.4)"/>
  <path d="${pulseBig}" stroke="#ffffff" stroke-width="2.8" fill="none" opacity="0.95"
        stroke-linecap="round" stroke-linejoin="round" transform="translate(0,-2.4)"/>
  <text x="256" y="421" text-anchor="middle"
        font-family="'Segoe UI Light','Segoe UI',Verdana,sans-serif" font-size="88"
        font-weight="300" letter-spacing="6" fill="${OUTLINE}">Minto</text>
  <text x="262" y="469" text-anchor="middle"
        font-family="'Segoe UI',Verdana,sans-serif" font-size="30"
        font-weight="400" letter-spacing="20" fill="${OUTLINE}">FOOD</text>
</svg>`;

// Малі фавікони: 1-в-1 SVG фавікона Minto Fit (наданий власницею 18.07.2026);
// stroke параметризовано лише щоб потовщити лінію на 16px
const smallIcon = (stroke = 32) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#BFD9CD"/>
  <polyline points="26,300 90,300 116,334 142,300 190,118 256,370 322,118 368,300 486,300"
            fill="none" stroke="#1C4532" stroke-width="${stroke}"
            stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const pulseOg = `
  M -10 240
  L 300 240
  C 315 240 320 205 338 205
  C 356 205 360 240 375 240
  L 398 240
  L 420 180
  L 438 240
  L 484 45
  L 545 372
  L 604 60
  L 648 240
  C 662 240 668 202 686 202
  C 704 202 708 240 722 240
  L 1210 240`;

const ogImage = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BG_TOP}"/>
      <stop offset="1" stop-color="${BG_BOT}"/>
    </linearGradient>
    <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#c4ccc8"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <path d="${pulseOg}" stroke="${OUTLINE}" stroke-width="15" fill="none"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
  <path d="${pulseOg}" stroke="url(#silver)" stroke-width="8" fill="none"
        stroke-linecap="round" stroke-linejoin="round"/>
  <!-- об'єм "трубки": тінь по нижньому краю + білий відблиск по верхньому -->
  <path d="${pulseOg}" stroke="#96a59e" stroke-width="2.8" fill="none" opacity="0.7"
        stroke-linecap="round" stroke-linejoin="round" transform="translate(0,2.2)"/>
  <path d="${pulseOg}" stroke="#ffffff" stroke-width="2.5" fill="none" opacity="0.95"
        stroke-linecap="round" stroke-linejoin="round" transform="translate(0,-2.2)"/>
  <text x="600" y="477" text-anchor="middle"
        font-family="'Segoe UI Light','Segoe UI',Verdana,sans-serif" font-size="96"
        font-weight="300" letter-spacing="8" fill="${OUTLINE}">Minto</text>
  <text x="607" y="532" text-anchor="middle"
        font-family="'Segoe UI',Verdana,sans-serif" font-size="34"
        font-weight="400" letter-spacing="24" fill="${OUTLINE}">FOOD</text>
  <text x="600" y="596" text-anchor="middle"
        font-family="'Segoe UI',Verdana,sans-serif" font-size="26"
        fill="${OUTLINE}" opacity="0.85">Харчові звички набувають форми</text>
</svg>`;

// ── ICO-контейнер з PNG-фреймів (PNG-in-ICO)
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const dirs = [];
  for (const { size, buf } of pngs) {
    const d = Buffer.alloc(16);
    d.writeUInt8(size >= 256 ? 0 : size, 0);
    d.writeUInt8(size >= 256 ? 0 : size, 1);
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(buf.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += buf.length;
    dirs.push(d);
  }
  return Buffer.concat([header, ...dirs, ...pngs.map((p) => p.buf)]);
}

const render = (svg, w, h) =>
  sharp(Buffer.from(svg), { density: 300 }).resize(w, h ?? w).png().toBuffer();

const frames = [
  { size: 16, buf: await render(smallIcon(48), 16) },
  { size: 32, buf: await render(smallIcon(32), 32) },
  { size: 48, buf: await render(smallIcon(32), 48) },
];
fs.writeFileSync(path.join(OUT, 'favicon.ico'), buildIco(frames));
fs.writeFileSync(path.join(OUT, 'favicon-32.png'), frames[1].buf);
fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), await render(bigIcon, 180));
fs.writeFileSync(path.join(OUT, 'icon-192.png'), await render(bigIcon, 192));
fs.writeFileSync(path.join(OUT, 'icon-512.png'), await render(bigIcon, 512));
fs.writeFileSync(path.join(OUT, 'og-default.png'), await render(ogImage, 1200, 630));

console.log('OK — img/ оновлено');
