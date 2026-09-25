// CSP + theme smoke-check (повторюваний).
// Запуск: node scripts/csp-theme-check.mjs
//
// Що перевіряє:
//  1) Реальний CSP-заголовок із vercel.json застосовано → 0 violations на ключових сторінках.
//  2) rewrite-маршрути з vercel.json емулюються (source з :param → regex, без хардкоду).
//     На /recipe/:slug три ГЛОБАЛЬНІ виправлені скрипти (theme-init/offline-indicator/
//     back-to-top) не стають /recipe/js/*.js → 404. Перевіряються саме ці три, не всі /js/*.js.
//  3) Anti-FOUC: при localStorage.theme=dark значення data-theme="dark" присутнє ПІСЛЯ
//     завантаження. Це НЕ фіксує стан буквально під час першого paint — правильний
//     anti-FOUC порядок забезпечує синхронне підключення theme-init.js у <head> перед CSS.
//  4) no-transition знімається після завантаження (інакше колірні transitions мертві).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const secHeaders = vercel.headers[0].headers;
const rewrites = vercel.rewrites || [];

const MIME = { '.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon' };

// Емулятор Vercel-rewrite, згенерований із vercel.json (без хардкоду маршрутів).
// `:param` у source → сегмент [^/]+; перший збіг виграє (як у Vercel).
const compiledRewrites = rewrites.map((rw) => ({
  re: new RegExp('^' + rw.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z0-9_]+/g, '[^/]+') + '$'),
  destination: rw.destination,
}));
function resolveRewrite(urlPath) {
  for (const rw of compiledRewrites) {
    if (rw.re.test(urlPath)) return rw.destination;
  }
  return urlPath;
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const resolved = resolveRewrite(urlPath);
  const filePath = path.join(ROOT, resolved);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    for (const h of secHeaders) res.setHeader(h.key, h.value);
    res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
    res.writeHead(200); res.end(data);
  });
});
const PORT = 8797;
await new Promise((r) => server.listen(PORT, r));

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDir = path.join(process.env.TEMP || '/tmp', 'csp-theme-' + Date.now());
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9336',`--user-data-dir=${userDir}`,'about:blank'], { stdio: 'ignore' });
async function ready(){ for(let i=0;i<40;i++){ try{ const r=await fetch('http://127.0.0.1:9336/json/version'); if(r.ok) return r.json(); }catch(_){} await new Promise(r=>setTimeout(r,250)); } throw new Error('Chrome CDP not ready'); }
const wsUrl = (await ready()).webSocketDebuggerUrl;

const ws = new WebSocket(wsUrl); let id=0; const pending=new Map();
await new Promise((r)=>(ws.onopen=r));
const rootHandlers = [];
ws.onmessage=(ev)=>{ const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);return;} rootHandlers.forEach(h=>h(m)); };
const rootSend=(method,params={})=>{ const mid=++id; ws.send(JSON.stringify({id:mid,method,params})); return new Promise(r=>pending.set(mid,r)); };

// Ключові сторінки + КРИТИЧНО rewrite-маршрут рецепта
const pages = ['/index.html','/recipe/test-slug','/profile.html','/product-guide.html','/shopping-list.html','/cookbook.html','/recipes.html','/cookies.html','/404.html','/500.html'];
const darkPages = ['/index.html','/recipe/test-slug','/profile.html','/cookbook.html','/recipes.html','/shopping-list.html'];

let failures = 0;

for (const pagePath of pages) {
  const violations = [];
  const failed404 = [];
  const { targetId } = await rootSend('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await rootSend('Target.attachToTarget', { targetId, flatten: true });
  const send=(method,params={})=>{ const mid=++id; ws.send(JSON.stringify({id:mid,method,params,sessionId})); return new Promise(r=>pending.set(mid,r)); };
  const onEvt = (m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      if (/Content Security Policy|Refused to (load|execute|apply|connect)/i.test(e.text||'')) violations.push(e.text);
    }
    if (m.method === 'Network.responseReceived') {
      const r = m.params.response;
      // Перевіряємо саме 3 глобальні скрипти, чиї шляхи виправлено на абсолютні
      // (theme-init/offline-indicator/back-to-top) — не всі /js/*.js на сторінці.
      if (r.status === 404 && /\/js\/(theme-init|offline-indicator|back-to-top)\.js/.test(r.url)) failed404.push(r.url);
    }
  };
  rootHandlers.push(onEvt);
  await send('Log.enable'); await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  if (darkPages.includes(pagePath)) {
    await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('theme','dark')}catch(e){}" });
  }
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${pagePath}` });
  await new Promise((r)=>setTimeout(r, 2200));

  const csp = violations.filter((v)=>/Content Security Policy|Refused to/i.test(v));
  let line = pagePath.padEnd(22);
  line += csp.length ? `CSP:✗(${csp.length}) ` : 'CSP:✓ ';
  line += failed404.length ? `global-js404:✗(${failed404.map(u=>u.split('/').pop()).join(',')}) ` : 'global-js404:✓ ';

  if (darkPages.includes(pagePath)) {
    const { result: theme } = await send('Runtime.evaluate', { expression: "document.documentElement.getAttribute('data-theme')", returnByValue: true });
    const { result: nt } = await send('Runtime.evaluate', { expression: "document.documentElement.classList.contains('no-transition')", returnByValue: true });
    const themeOk = theme.value === 'dark';
    const ntOk = nt.value === false;
    line += themeOk ? 'dark-after-load:✓ ' : `dark-after-load:✗(${theme.value}) `;
    line += ntOk ? 'no-transition-cleared:✓' : 'no-transition-cleared:✗ STILL PRESENT';
    if (!themeOk || !ntOk) failures++;
  }
  if (csp.length || failed404.length) failures++;
  console.log(line);

  rootHandlers.splice(rootHandlers.indexOf(onEvt), 1);
  await rootSend('Target.closeTarget', { targetId });
}

console.log('\n' + (failures ? `RESULT: ${failures} FAILURE(S) ✗` : 'RESULT: ALL PASS ✓'));
ws.close(); chrome.kill(); server.close();
try { fs.rmSync(userDir, { recursive: true, force: true }); } catch(_){}
process.exit(failures ? 1 : 0);
