// Guest UI QA using the installed Chrome; no dependencies or remote data writes.
// node scripts/phase22-ui-check.mjs [--pages=profile,index] [--breakpoints] [--interactions]
// Artifacts: node_modules/.cache/phase22-ui/<run timestamp>/
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'node_modules/.cache/phase22-ui', new Date().toISOString().replace(/[:.]/g, '-'));
const profile = path.join(output, 'chrome-profile');
await fs.mkdir(profile, { recursive: true });
const config = JSON.parse(await fs.readFile(path.join(root, 'vercel.json'), 'utf8'));
const pagesArg = process.argv.find(arg => arg.startsWith('--pages='));
const pages = pagesArg ? pagesArg.slice(8).split(',') : [
  'index', 'week-menu', 'recipes', 'recipe', 'product-guide', 'shopping-list',
  'shared-list', 'cookbook', 'profile', 'privacy', 'terms', 'cookies', 'imprint',
  'dmca', '404', '500', 'maintenance',
];
if (pages.some(name => !/^[a-z0-9-]+$/.test(name))) throw new Error('Invalid page name');
const widths = process.argv.includes('--breakpoints') ? [1200, 1024, 768, 480] : [1440, 390];
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.startsWith('/api/')) { res.writeHead(501).end('Static QA server: API unavailable'); return; }
    if (pathname === '/') pathname = '/index.html';
    if (/^\/recipe\/[^/]+$/.test(pathname)) pathname = '/recipe.html';
    if (!/^\/(?:[a-z0-9-]+\.html|(?:js|css|img|fonts)\/[^\0]*|manifest\.json|favicon\.ico)$/i.test(pathname)) {
      res.writeHead(404).end(); return;
    }
    const filename = path.resolve(root, '.' + pathname);
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const body = await fs.readFile(filename);
    for (const header of config.headers[0].headers) res.setHeader(header.key, header.value);
    res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', windowsHide: true });
let launchError;
chrome.on('error', error => { launchError = error; });
let ws;
let nextId = 0;
const pending = new Map();
const events = new Map();
const report = { startedAt: new Date().toISOString(), origin, mode: 'guest; static files with Vercel CSP; real external GETs; no authenticated workflows', results: [] };
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
try {
  let endpoint;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (launchError) throw launchError;
    if (chrome.exitCode !== null) throw new Error(`Chrome exited: ${chrome.exitCode}`);
    try {
      const [port, wsPath] = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
      endpoint = `ws://127.0.0.1:${port}${wsPath}`;
      break;
    } catch { await delay(250); }
  }
  if (!endpoint) throw new Error('Chrome did not expose DevTools within 15s; check sandbox restrictions.');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket startup timeout')), 5000);
    ws.onopen = () => { clearTimeout(timer); resolve(); };
    ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket startup failed')); };
  });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    } else events.get(message.sessionId)?.(message);
  };
  report.browser = await send('Browser.getVersion');
  console.log(`QA artifacts: ${output}`);
  for (const name of pages) for (const theme of ['light', 'dark']) for (const width of widths) {
    const height = width === 390 ? 844 : 900;
    const label = `${name}-${theme}-${width}`;
    const row = { page: name, theme, width, height, errors: [], warnings: [], failedResources: [], blockedWrites: [], blockedChecks: [] };
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const command = (method, params = {}) => send(method, params, sessionId);
    const evaluate = async expression => {
      const response = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
      return response.result.value;
    };
    let loaded = false;
    let productsLoaded = false;
    const requests = new Map();
    const safeUrl = value => { try { const u = new URL(value); return u.origin + u.pathname; } catch { return String(value).slice(0, 200); } };
    events.set(sessionId, message => {
      const p = message.params;
      if (message.method === 'Page.loadEventFired') loaded = true;
      if (message.method === 'Network.requestWillBeSent') requests.set(p.requestId, safeUrl(p.request.url));
      if (message.method === 'Network.loadingFinished' && requests.get(p.requestId)?.endsWith('/rest/v1/products')) productsLoaded = true;
      if (message.method === 'Network.responseReceived' && p.response.status >= 400) row.failedResources.push({ url: safeUrl(p.response.url), status: p.response.status });
      if (message.method === 'Network.loadingFailed' && p.errorText !== 'net::ERR_ABORTED') row.failedResources.push({ url: requests.get(p.requestId), error: p.errorText });
      if (message.method === 'Runtime.exceptionThrown') row.errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text);
      if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(p.entry.level)) (p.entry.level === 'error' ? row.errors : row.warnings).push(p.entry.text);
      if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type)) (p.type === 'error' ? row.errors : row.warnings).push(p.args.map(arg => arg.value ?? arg.description ?? '').join(' ').slice(0, 1500));
      if (message.method === 'Fetch.requestPaused') {
        const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(p.request.method);
        // Browser creates a fresh guest session. Block mutation requests if a page attempts any.
        if (isWrite) row.blockedWrites.push({ method: p.request.method, url: safeUrl(p.request.url) });
        void command(isWrite ? 'Fetch.failRequest' : 'Fetch.continueRequest', { requestId: p.requestId, ...(isWrite ? { errorReason: 'BlockedByClient' } : {}) }).catch(error => row.errors.push(error.message));
      }
    });
    try {
      await command('Page.enable');
      await command('Runtime.enable');
      await command('Log.enable');
      await command('Network.enable');
      await command('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
      await command('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('theme', '${theme}'); localStorage.setItem('minto_consent', JSON.stringify({necessary:true, analytics:false, marketing:false, version:'1', savedAt:Date.now()}));` });
      await command('Page.navigate', { url: name === 'recipe-route' ? `${origin}/recipe/nonexistent-slug` : `${origin}/${name}.html` });
      for (let attempt = 0; attempt < 60 && !loaded; attempt++) await delay(200);
      row.loadEvent = loaded;
      // Allow async page modules to render; record whether data actually appears separately.
      await delay(800);
      row.dom = await evaluate(`(() => {
        const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
        const footer = document.querySelector('.site-footer');
        const footerRect = footer?.getBoundingClientRect();
        const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        return {
          title: document.title, theme: document.documentElement.dataset.theme || 'light',
          width: innerWidth, scrollWidth: document.documentElement.scrollWidth, pageHeight,
          mainCount: document.querySelectorAll('main').length, nestedMainCount: document.querySelectorAll('main main').length,
          noTransition: document.documentElement.classList.contains('no-transition'),
          footer: footerRect ? { bottom: Math.round(footerRect.bottom + scrollY), top: Math.round(footerRect.top + scrollY) } : null,
          bodyPaddingBottom: parseFloat(getComputedStyle(document.body).paddingBottom) || 0,
          headerLinks: [...document.querySelectorAll('.header__nav-link')].map(el => ({ href:el.getAttribute('href'), active:el.classList.contains('header__nav-link--active') })),
          profileSections: [...document.querySelectorAll('[data-profile-section]')].map(el => ({name:el.dataset.profileSection, hidden:el.hidden, visible:visible(el)})),
          visibleHidden: [...document.querySelectorAll('[hidden]')].filter(visible).map(el => ({tag:el.tagName, id:el.id, class:el.className})).slice(0, 12),
          brokenImages: [...document.images].filter(el => visible(el) && el.complete && el.naturalWidth === 0).map(el => el.getAttribute('src')),
          headings: [...document.querySelectorAll('main h1, main h2')].filter(visible).map(el => el.textContent.trim()).slice(0, 12),
          visibleCards: document.querySelectorAll('.recipe-card, .product-card, .cookbook-card').length,
          authModalVisible: !!document.querySelector('#auth-modal') && visible(document.querySelector('#auth-modal')),
          bodyBackground: getComputedStyle(document.body).backgroundColor,
        };
      })()`);
      const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await fs.writeFile(path.join(output, `${label}.png`), Buffer.from(screenshot.data, 'base64'));
      row.screenshot = `${label}.png`;
      row.errors = [...new Set(row.errors)];
      row.warnings = [...new Set(row.warnings)];
      row.failures = [];
      if (!loaded) row.failures.push('load timeout');
      if (row.dom.scrollWidth > width + 1) row.failures.push('horizontal overflow');
      if (row.dom.theme !== theme) row.failures.push('theme mismatch');
      if (row.dom.mainCount !== 1 || row.dom.nestedMainCount) row.failures.push('main landmark');
      if (row.dom.noTransition) row.failures.push('no-transition remains');
      if (row.dom.brokenImages.length) row.failures.push('broken images');
      if (row.dom.profileSections.filter(section => section.visible).length > 1) row.failures.push('profile sections stacked');
      // The mobile tab bar deliberately reserves body padding below the footer.
      if (row.dom.footer && row.dom.footer.bottom + row.dom.bodyPaddingBottom < height - 1) row.failures.push('footer above viewport bottom');
      const currentHeaderLink = row.dom.headerLinks.find(link => link.href === `/${name}.html`);
      if (currentHeaderLink && !currentHeaderLink.active) row.failures.push('header active link missing');
      if (process.argv.includes('--interactions')) {
        const click = async selector => {
          const doc = await command('DOM.getDocument');
          const { nodeId } = await command('DOM.querySelector', { nodeId:doc.root.nodeId, selector });
          if (nodeId) await command('DOM.scrollIntoViewIfNeeded', { nodeId });
          const rect = await evaluate(`(() => { const nodes = document.querySelectorAll(${JSON.stringify(selector)}); if(nodes.length !== 1) return null; const el = nodes[0]; const r = el.getBoundingClientRect(); return r.width && r.height ? { x:r.x + r.width/2, y:r.y + r.height/2 } : null; })()`);
          if (!rect) throw new Error(`QA click target missing/ambiguous: ${selector}`);
          await command('Input.dispatchMouseEvent', { type:'mousePressed', button:'left', clickCount:1, ...rect });
          await command('Input.dispatchMouseEvent', { type:'mouseReleased', button:'left', clickCount:1, ...rect });
          await delay(120);
        };
        const escape = async () => {
          await command('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
          await command('Input.dispatchKeyEvent', { type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
        };
        row.interactions = {};
        if (name === 'index' || name === 'terms') {
          await click('.theme-toggle');
          row.interactions.themeToggle = await evaluate(`(document.documentElement.dataset.theme || 'light') !== '${theme}'`);
          await click('.theme-toggle');
          await click('#headerAuthBtn');
          row.interactions.headerLogin = await evaluate(`!!document.querySelector('#auth-modal.is-open')`);
          if (row.interactions.headerLogin) {
            row.interactions.authFocusInside = await evaluate(`!!document.activeElement.closest('#auth-modal')`);
            await escape();
            row.interactions.authEscape = await evaluate(`!document.querySelector('#auth-modal.is-open')`);
            if (!row.interactions.authEscape) await click('#authModalClose');
            row.interactions.authClose = await evaluate(`!document.querySelector('#auth-modal.is-open')`);
          }
          if (width <= 768) {
            await click('.header__burger');
            row.interactions.burgerOpen = await evaluate(`document.querySelector('.header__burger').getAttribute('aria-expanded') === 'true'`);
            await escape();
            row.interactions.burgerEscape = await evaluate(`document.querySelector('.header__burger').getAttribute('aria-expanded') === 'false'`);
            if (await evaluate(`!!document.querySelector('[data-more-btn]')`)) {
              await click('[data-more-btn]');
              row.interactions.moreOpen = await evaluate(`document.querySelector('#more-sheet').classList.contains('is-open')`);
              row.interactions.adminLinkHidden = await evaluate(`!document.querySelector('#mobileAdminLink')?.getClientRects().length`);
              await escape();
              row.interactions.moreEscape = await evaluate(`!document.querySelector('#more-sheet').classList.contains('is-open')`);
            }
            await click('.site-footer__accordion details:first-child summary');
            row.interactions.footerAccordion = await evaluate(`document.querySelector('.site-footer__accordion details').open`);
            if (await evaluate(`scrollY > 600 && !!document.querySelector('#backToTopBtn.back-to-top--visible')`)) {
              await click('#backToTopBtn');
              for (let attempt = 0; attempt < 30 && await evaluate('scrollY > 1'); attempt++) await delay(100);
              row.interactions.backToTop = await evaluate('scrollY <= 1');
            }
          }
          await command('Network.emulateNetworkConditions', { offline:true, latency:0, downloadThroughput:-1, uploadThroughput:-1 });
          await delay(150);
          row.interactions.offlineBanner = await evaluate(`!!document.querySelector('#offlineBanner') && !document.querySelector('#offlineBanner').hidden`);
          await command('Network.emulateNetworkConditions', { offline:false, latency:0, downloadThroughput:-1, uploadThroughput:-1 });
          await delay(150);
          row.interactions.onlineBanner = await evaluate(`!!document.querySelector('#offlineBanner.offline-banner--online')`);
        }
        if (name === 'product-guide') {
          for (let attempt = 0; attempt < 60 && !productsLoaded; attempt++) await delay(200);
          await click('.product-search__input');
          await command('Input.insertText', { text:'яблу' });
          for (let attempt = 0; attempt < 40 && !await evaluate(`document.querySelectorAll('.product-card').length`); attempt++) await delay(200);
          row.productNames = await evaluate(`[...document.querySelectorAll('.product-card__name')].map(el => el.textContent.trim())`);
          row.productDataRequestCompleted = productsLoaded;
          if (!row.productNames.length) row.blockedChecks.push('Populated product search/modal: no known matching fixture for the guest catalogue.');
          if (row.productNames.length) {
            const cardsScreenshot = await command('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
            await fs.writeFile(path.join(output, `${label}-search.png`), Buffer.from(cardsScreenshot.data, 'base64'));
            await click('#productList .product-card:first-child .product-card__btn');
            row.interactions.productModalOpen = await evaluate(`document.querySelector('[data-modal="product"]').classList.contains('is-open')`);
            await delay(800);
            const modalScreenshot = await command('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
            await fs.writeFile(path.join(output, `${label}-modal.png`), Buffer.from(modalScreenshot.data, 'base64'));
            await click('[data-modal="product"] .modal__close');
            row.interactions.productModalClose = await evaluate(`!document.querySelector('[data-modal="product"]').classList.contains('is-open')`);
          }
        }
        for (const [key, passed] of Object.entries(row.interactions)) if (!passed) row.failures.push(`interaction: ${key}`);
      }
      if (row.errors.length) row.failures.push('console errors');
      if (row.failedResources.length) row.failures.push('failed resources');
      if (row.blockedWrites.length) row.failures.push('page attempted network write (blocked)');
      const status = row.failures.length ? row.failures.join(', ') : row.blockedChecks.length ? `BLOCKED: ${row.blockedChecks.join(', ')}` : 'PASS';
      console.log(`${label}: ${status}; cards=${row.dom.visibleCards}`);
    } catch (error) { row.failures = [...(row.failures || []), error.message]; console.log(`${label}: ERROR ${error.message}`); }
    finally {
      events.delete(sessionId);
      await send('Target.closeTarget', { targetId });
      report.results.push(row);
      await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    }
  }
  report.finishedAt = new Date().toISOString();
  report.summary = { cases: report.results.length, failedCases: report.results.filter(row => row.failures.length).length, blockedCases:report.results.filter(row => row.blockedChecks.length).length };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary));
  process.exitCode = report.summary.failedCases ? 1 : report.summary.blockedCases ? 2 : 0;
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('QA session closed')); }
  ws?.close();
  chrome.kill();
  server.closeAllConnections();
  server.close();
}
