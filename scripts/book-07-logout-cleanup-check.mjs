// BOOK-07: пошук шаблонів у коді та smoke очищення штучних DOM-вузлів у гостя.
// Загальне покриття BOOK-07 — PARTIAL навіть за всіх успішних assertions.
//
// ЗАПУСК: скопіювати цей .mjs у scratch-каталог, де встановлено playwright-core,
// поряд із node_modules, і запускати КОПІЮ. Зміни лише cwd недостатньо:
// bare import резолвиться від розташування .mjs. Root package-lock.json існує.
// PowerShell-команди: docs/qa/book-06-07-review-2026-09-14.md.
// Використовує системний Chrome, браузер не завантажується.
//
// A. Regex у live-файлі: наявність шаблонів не доводить коректність усіх guards.
// B. Штучні DOM-вузли після виклику signOut(); немає реального входу/зміни юзера.
// Подія SIGNED_OUT не записується окремим listener, повернене поле error не
// перевіряється. Пізні відповіді запитів і реальні відкриті модалки не тестуються.

import { chromium } from 'playwright-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'https://minto-food.vercel.app';

const results = [];
function record(check, pass, detail) {
  results.push({ check, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${check}${detail ? ` — ${detail}` : ''}`);
}

// ---------------------------------------------------------------
// A. Пошук текстових шаблонів у ЗАДЕПЛОЄНОМУ js/cookbook.js
// ---------------------------------------------------------------
console.log('\n[A. текстові шаблони у live js/cookbook.js]');
const liveSrc = await fetch(`${BASE}/js/cookbook.js`).then((r) => r.text());

record(
  'у тексті SIGNED_OUT поруч із clearCookbookUserUI()',
  /SIGNED_OUT[\s\S]{0,200}clearCookbookUserUI\(\)/.test(liveSrc),
  null
);
record(
  'у тексті є інкременти трьох version-лічильників',
  /_loadVersion \+= 1/.test(liveSrc) &&
    /_recentLoadVersion \+= 1/.test(liveSrc) &&
    /_bookLoadVersion \+= 1/.test(liveSrc),
  null
);
record(
  'у тексті є replaceChildren для booksGrid, recentRecipes і bookRecipes',
  /booksGrid\?\.replaceChildren\(\)/.test(liveSrc) &&
    /recentRecipes\?\.replaceChildren\(\)/.test(liveSrc) &&
    /bookRecipes\?\.replaceChildren\(\)/.test(liveSrc),
  null
);
record(
  'у тексті є editBookModal?.remove()',
  /editBookModal\?\.remove\(\)/.test(liveSrc),
  null
);
const guardCount = (liveSrc.match(/version !== _(?:load|recent|book)LoadVersion|version !== _loadVersion/g) || []).length;
record(
  'у тексті є щонайменше 6 збігів version-guard (не race-тест)',
  guardCount >= 6,
  `знайдено ${guardCount} guard-перевірок`
);
record(
  'у тексті є порівняння currentUser?.id !== userId',
  /currentUser\?\.id !== userId/.test(liveSrc),
  null
);

// ---------------------------------------------------------------
// B. Очищення штучних DOM-вузлів у гостьовому браузері
// ---------------------------------------------------------------
console.log('\n[B. штучні DOM-вузли після виклику signOut() у гостя]');

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

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

const clearOverlays = () =>
  page.evaluate(() => {
    document
      .querySelectorAll('#auth-modal, .auth-modal, #cookieBanner, .cookie-banner, .cookie-consent')
      .forEach((el) => el.remove());
    document.body.style.overflow = '';
  });
await clearOverlays();
await page.waitForTimeout(800);
await clearOverlays();

// Вставляємо штучні вузли в контейнери, не створюючи авторизованої сесії.
// Edit-вузол додається без active-класу; реальна модалка не відкривається.
// Два recent-вузли вставляються лише за наявності контейнера, seed їх не assert-ить.
const seeded = await page.evaluate(() => {
  const booksGrid = document.getElementById('booksGrid');
  const recentRecipes = document.getElementById('recentRecipes');
  if (!booksGrid) return { ok: false, reason: 'booksGrid не знайдено' };

  booksGrid.innerHTML =
    '<article class="cookbook-card" data-qa="prev-user">Книга попереднього юзера</article>'.repeat(3);
  if (recentRecipes) {
    recentRecipes.innerHTML =
      '<article class="recent-card" data-qa="prev-user">Рецепт попереднього юзера</article>'.repeat(2);
  }

  // edit-модалка, яку logout має видалити повністю
  const modal = document.createElement('div');
  modal.id = 'editBookModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = '<div class="cookbook-modal"><h2>Редагувати книгу</h2></div>';
  document.body.appendChild(modal);

  return {
    ok: true,
    books: booksGrid.children.length,
    recent: recentRecipes ? recentRecipes.children.length : -1,
    modal: !!document.getElementById('editBookModal'),
  };
});

if (!seeded.ok) {
  record('seed штучних DOM-вузлів', false, seeded.reason);
} else {
  record(
    'seed трьох штучних книг і edit-вузла',
    seeded.books === 3 && seeded.modal,
    `${seeded.books} книг, ${seeded.recent} recent, edit-модалка: ${seeded.modal}`
  );

  // Викликаємо signOut() клієнта сторінки; отримання SIGNED_OUT не assert-иться.
  const emitted = await page.evaluate(async () => {
    // cookbook.js підписаний на onAuthStateChange свого клієнта.
    // Ця перевірка фіксує лише завершення виклику без throw, не поле error.
    try {
      const mod = await import('/js/supabaseClient.js');
      const client = mod.supabase ?? mod.default;
      if (!client?.auth?.signOut) return { ok: false, reason: 'supabase client не знайдено' };
      await client.auth.signOut();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  });

  if (!emitted.ok) {
    record('виклик signOut() завершився без throw', false, emitted.reason);
  } else {
    record('виклик signOut() завершився без throw', true, 'подія SIGNED_OUT окремо не перевіряється');
    await page.waitForTimeout(1200);

    const after = await page.evaluate(() => ({
      books: document.getElementById('booksGrid')?.children.length ?? -1,
      booksAriaBusy: document.getElementById('booksGrid')?.getAttribute('aria-busy'),
      recent: document.getElementById('recentRecipes')?.children.length ?? -1,
      modalGone: !document.getElementById('editBookModal'),
      leftovers: document.querySelectorAll('[data-qa="prev-user"]').length,
    }));

    record('картки книг очищені', after.books === 0, `лишилось дітей: ${after.books}`);
    record(
      'recent контейнер порожній або відсутній (відсутність допускається)',
      after.recent === 0 || after.recent === -1,
      `лишилось дітей: ${after.recent}`
    );
    record('edit-модалка видалена з DOM', after.modalGone, null);
    record(
      'жодного штучного вузла [data-qa=prev-user] в DOM',
      after.leftovers === 0,
      `знайдено [data-qa=prev-user]: ${after.leftovers}`
    );
    record('aria-busy знято', after.booksAriaBusy === 'false', `aria-busy=${after.booksAriaBusy}`);

    await page.screenshot({ path: 'book07-after-logout.png' });
  }
}

if (consoleErrors.length) {
  console.log(`  (console errors: ${consoleErrors.length}) ${consoleErrors.slice(0, 3).join(' | ')}`);
}

await context.close();
await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${'='.repeat(60)}`);
console.log(`BOOK-07 DOM/static smoke: ${results.length - failed.length}/${results.length} часткових перевірок PASS`);
console.log('Покриття BOOK-07: PARTIAL. NOT RUN: реальний logout, відкриті модалки, пізні відповіді та зміна користувача A → B.');
if (failed.length) {
  console.log('\nПРОВАЛЕНІ:');
  for (const f of failed) console.log(`  ${f.check} — ${f.detail ?? ''}`);
  process.exitCode = 1;
}
