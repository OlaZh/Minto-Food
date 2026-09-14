// BOOK-06: ізольована CSS-перевірка спрощеної тестової модалки на deployed URL.
// Загальне покриття BOOK-06 — PARTIAL навіть за всіх успішних assertions.
//
// ЗАПУСК: скопіювати цей .mjs у scratch-каталог, де встановлено playwright-core,
// поряд із node_modules, і запускати КОПІЮ. Зміни лише cwd недостатньо:
// bare import резолвиться від розташування .mjs. Root package-lock.json існує.
// PowerShell-команди: docs/qa/book-06-07-review-2026-09-14.md.
// Використовує системний Chrome, браузер не завантажується.
//
// Реальні createEditBookModal/renderCoverGridHTML не викликаються. HTML вставлено
// вручну без «Без фото», заголовків серій, default-поля та обробника вибору.
// Перевіряється лише світла тема, три viewport у desktop Chrome, без touch.
// Не перевіряє реальний вибір/збереження обкладинки та блокування скролу сторінки.

import { chromium } from 'playwright-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'https://minto-food.vercel.app';

const VIEWPORTS = [
  { name: 'desktop 1440x900', width: 1440, height: 900 },
  { name: 'mobile 390x844', width: 390, height: 844 },
  { name: 'short 1280x600', width: 1280, height: 600 },
];

const results = [];
function record(viewport, check, pass, detail) {
  results.push({ viewport, check, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${check}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

for (const vp of VIEWPORTS) {
  console.log(`\n[${vp.name}]`);
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });

  // Тема/мова/consent — інакше cookie-банер перекриє модалку.
  // Гостю достатньо валідного minto_consent з актуальними version і savedAt.
  // minto_consent_seen тут додатковий; обидва ключі не є обов'язковими.
  await context.addInitScript(() => {
    localStorage.setItem('theme', 'light');
    localStorage.setItem('lang', 'uk');
    localStorage.setItem(
      'minto_consent',
      JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1', savedAt: Date.now() })
    );
    localStorage.setItem('minto_consent_seen', JSON.stringify({ version: '1' }));
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  await page.goto(`${BASE}/cookbook.html`, { waitUntil: 'networkidle', timeout: 60000 });

  // Гостю cookbook.html показує login-модалку і cookie-банер — вони лежать
  // поверх нашої модалки і ламають hit-testing. Прибираємо їх з DOM: ми
  // тестуємо CSS-скрол сітки обкладинок, а не auth-флоу.
  // Id саме `auth-modal` з дефісом (js/auth.js:549); auth-скрипт може
  // домалювати модалку асинхронно, тому чистимо ще й перед вставкою.
  const clearOverlays = () =>
    page.evaluate(() => {
      document
        .querySelectorAll('#auth-modal, .auth-modal, #cookieBanner, .cookie-banner, .cookie-consent')
        .forEach((el) => el.remove());
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open', 'no-scroll');
    });

  await clearOverlays();
  await page.waitForTimeout(800);
  await clearOverlays();

  // Вставляємо спрощену тестову розмітку, не викликаючи renderer застосунку.
  // clearOverlays також скидає body lock; такий обхід придатний лише для
  // ізольованої CSS-перевірки й не підтверджує повний сценарій модалки.
  await page.evaluate(() => {
    const LIGHT_COVERS = 16;
    const DARK_COVERS = 14;
    let html = '';
    const opt = (filename) =>
      `<button type="button" class="cookbook-cover-option" data-cover="${filename}"><img src="img/covers/${filename}.avif" alt="${filename}" loading="lazy"></button>`;
    for (let i = 1; i <= LIGHT_COVERS; i++) html += opt(`Light theme ${i}`);
    for (let i = 1; i <= DARK_COVERS; i++) html += opt(`Dark theme ${i}`);

    const modal = document.createElement('div');
    modal.id = 'editBookModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="cookbook-modal cookbook-modal--small">
        <button class="modal__close" id="closeEditBookModal" aria-label="Закрити">×</button>
        <h2 class="cookbook-modal__title">Редагувати книгу</h2>
        <form class="cookbook-form" id="editBookForm">
          <div class="cookbook-form__field">
            <label for="editBookName">Назва книги</label>
            <input type="text" id="editBookName" required maxlength="50" value="QA-20260908-book" />
          </div>
          <div class="cookbook-form__field">
            <label>Обкладинка</label>
            <div class="cookbook-cover-grid" id="editCoverGrid">${html}</div>
          </div>
          <div class="cookbook-form__actions">
            <button type="button" class="cookbook-form__btn-cancel" id="cancelEditBook">Скасувати</button>
            <button type="submit" class="cookbook-form__submit">Зберегти</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(modal);
    modal.classList.add('modal-overlay--active');
    modal.style.display = 'flex';
  });

  await page.waitForTimeout(600);
  // Auth-модалка могла домалюватись під час рендеру нашої — чистимо ще раз.
  await clearOverlays();
  await page.waitForTimeout(200);

  const grid = page.locator('#editCoverGrid');
  const optionCount = await page.locator('#editCoverGrid .cookbook-cover-option').count();
  record(vp.name, 'тестова сітка містить 30 вставлених обкладинок', optionCount === 30, `знайдено ${optionCount}`);

  // 1. Чи є в сітки власний скрол (контент вищий за контейнер).
  const metrics = await grid.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: cs.overflowY,
      maxHeight: cs.maxHeight,
    };
  });
  const scrollable = metrics.scrollHeight > metrics.clientHeight;
  record(
    vp.name,
    'сітка має власний скрол',
    scrollable && metrics.overflowY === 'auto',
    `overflow-y:${metrics.overflowY}, max-height:${metrics.maxHeight}, ${metrics.scrollHeight}px контенту в ${metrics.clientHeight}px`
  );

  // 2. Найголовніше: чи можна доскролити до ОСТАННЬОЇ обкладинки.
  // Саме це було зламано — нижні варіанти недоступні.
  const lastOption = page.locator('#editCoverGrid .cookbook-cover-option').last();
  await lastOption.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const lastVisible = await lastOption.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const inViewport = r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
    // Чи не перекритий чимось (перевіряємо центр елемента).
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const topEl = document.elementFromPoint(cx, cy);
    const notCovered = el.contains(topEl) || el === topEl;
    // Якщо перекрито — назвати винуватця, щоб не гадати.
    const blocker = notCovered
      ? null
      : `${topEl?.tagName?.toLowerCase() ?? '?'}${topEl?.id ? '#' + topEl.id : ''}${
          topEl?.className && typeof topEl.className === 'string'
            ? '.' + topEl.className.trim().split(/\s+/).join('.')
            : ''
        }`;
    return { inViewport, notCovered, blocker, top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
  record(
    vp.name,
    'остання (30-та) обкладинка доступна після скролу',
    lastVisible.inViewport && lastVisible.notCovered,
    `top:${lastVisible.top} bottom:${lastVisible.bottom} viewport:${vp.height}${
      lastVisible.notCovered ? '' : `, перекрито: ${lastVisible.blocker}`
    }`
  );

  // 3. Клікабельність останньої обкладинки — доступна не лише візуально.
  let clickable = false;
  try {
    await lastOption.click({ timeout: 4000 });
    clickable = true;
  } catch (e) {
    clickable = false;
  }
  record(vp.name, 'останній тестовий button приймає click (вибір не перевірено)', clickable, clickable ? '' : 'click timeout');

  // 4. Програмна зміна grid.scrollTop не змінює window.scrollY.
  // Це НЕ перевірка body lock: під час wheel нижче window.scrollY не вимірюється.
  const bodyScroll = await page.evaluate(() => {
    const before = window.scrollY;
    const grid = document.getElementById('editCoverGrid');
    grid.scrollTop = grid.scrollHeight;
    return { before, after: window.scrollY };
  });
  record(
    vp.name,
    'програмна зміна grid.scrollTop не змінює window.scrollY (не body lock)',
    bodyScroll.before === bodyScroll.after,
    `window.scrollY ${bodyScroll.before} → ${bodyScroll.after}`
  );

  // 5. Wheel-скрол реально працює (не лише програмний scrollTop).
  // boundingBox беремо ПІСЛЯ скидання scrollTop, інакше курсор може
  // опинитися поза сіткою і wheel піде в сторінку.
  await grid.evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(200);
  const box = await grid.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(100);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(400);
  const afterWheel = await grid.evaluate((el) => el.scrollTop);
  record(vp.name, 'wheel-скрол прокручує сітку', afterWheel > 0, `scrollTop після wheel: ${afterWheel}`);

  await page.screenshot({ path: `book06-${vp.width}x${vp.height}.png` });

  if (consoleErrors.length) {
    console.log(`  (console errors: ${consoleErrors.length}) ${consoleErrors.slice(0, 3).join(' | ')}`);
  }

  await context.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${'='.repeat(60)}`);
console.log(`BOOK-06 CSS fixture: ${results.length - failed.length}/${results.length} часткових перевірок PASS`);
console.log('Покриття BOOK-06: PARTIAL. NOT RUN: реальна модалка, вибір/збереження, body lock при wheel/touch, темна тема.');
if (failed.length) {
  console.log('\nПРОВАЛЕНІ:');
  for (const f of failed) console.log(`  [${f.viewport}] ${f.check} — ${f.detail}`);
  process.exitCode = 1;
}
