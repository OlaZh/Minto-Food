// error-tracking.js — Sentry (@sentry/browser), auto-init. Підключається в
// <head> (build.js), НЕ перед </body> як інші auto-init модулі — щоб ловити
// помилки, що трапляються під час завантаження сторінки, а не лише після.
// Ловить unhandled errors + rejections глобально — без потреби переписувати
// кожен існуючий console.error.
//
// SDK вантажиться з ОФІЦІЙНОГО Sentry CDN (browser.sentry-cdn.com), не
// jsDelivr/npm: з версії 10.x пакет @sentry/browser більше не публікує
// standalone browser-bundle через npm registry (лише ESM з relative
// імпортами між файлами, нестандартно для CDN без bundler). Офіційний CDN
// віддає classic IIFE-script (встановлює window.Sentry), тому підключаємо
// через <script> тег, НЕ через import() — динамічний import() очікує ESM.
//
// ВАЖЛИВО про правову підставу й що САМЕ вимкнено:
// Sentry.init({integrations:[]}) НЕ вимикає дефолти — `integrations` додає
// поверх `defaultIntegrations`, а не замінює їх (перевірено запуском
// реального CDN-бандла: без явного defaultIntegrations SDK викликає власний
// getDefaultIntegrations(), і breadcrumbsIntegration() там завжди присутня).
// Тому нижче явно будуємо defaultIntegrations = дефолтний список МІНУС
// Breadcrumbs (кліки/клавіші/навігація/fetch — поведінкові дані) і
// BrowserSession (сесійна тривалість — теж поведінкове). Лишаються:
// InboundFilters, FunctionToString, ConversationId, BrowserApiErrors,
// GlobalHandlers (сам механізм ловлі unhandled errors/rejections — це і є
// суть модуля), LinkedErrors, Dedupe, HttpContext, CultureContext.
//
// HttpContext додає URL/user-agent сторінки, де стався крах — це необхідний
// технічний контекст для дебагу (не історія переходів/кліків користувача),
// тому лишається. Разом з явним user.id це означає, що модуль НЕ обмежується
// голим message/stack — крах пов'язаний з конкретним URL і юзером.
// Якщо це колись стане юридично спірним — рішення тримати поза
// consent_analytics (як security-моніторинг, legitimate interest) окреме
// від browser-behavior tracking, яким тут явно НЕ займаємось.
//
// Реальне підставлення DSN: build.js інжектить <meta> з env var
// SENTRY_DSN_PUBLIC при `npm run build` (Vercel buildCommand). Без env var
// (локальна розробка, або акаунт ще не зареєстровано) — meta відсутня, no-op.
//
//   <meta name="minto-sentry-dsn" content="https://...@o0.ingest.sentry.io/0" />

// НЕ імпортуємо supabaseClient.js статично на топ-рівні: цей модуль мусить
// виконатись максимально рано (в <head>), а supabaseClient тягне за собою
// @supabase/supabase-js — зайва вага в критичному шляху завантаження.
// setUser() підвантажує його лінькво, після init.

// Версія ЗАФІКСОВАНА (не /latest/) — інакше мовчазний breaking change на CDN.
const SDK_URL = 'https://browser.sentry-cdn.com/10.69.0/bundle.tracing.min.js';

// Інтеграції, які явно ВИКЛЮЧАЄМО з дефолтного списку (поведінкові дані).
const EXCLUDED_INTEGRATION_NAMES = ['Breadcrumbs', 'BrowserSession'];

function readMeta(name) {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || null;
}

function readGlobal(name) {
  return typeof window !== 'undefined' ? window[name] || null : null;
}

function getDsn() {
  return readMeta('minto-sentry-dsn') || readGlobal('MINTO_SENTRY_DSN') || null;
}

// Classic <script> (не type="module") — bundle встановлює window.Sentry
// глобально, це не ES-модуль з exports.
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    // document.head існує синхронно навіть коли цей script виконується в
    // <head> до решти документа (браузер парсить head тег-за-тегом).
    document.head.appendChild(s);
  });
}

let _initDone = false;

export async function initErrorTracking() {
  if (_initDone) return;
  _initDone = true;

  const dsn = getDsn();
  if (!dsn) return; // без DSN — нічого не вантажимо, нічого не ламаємо

  try {
    await loadScript(SDK_URL);
    const Sentry = window.Sentry;
    if (!Sentry) return;

    const defaultIntegrations = Sentry.getDefaultIntegrations({}).filter(
      (integration) => !EXCLUDED_INTEGRATION_NAMES.includes(integration.name),
    );

    Sentry.init({
      dsn,
      environment: location.hostname === 'localhost' ? 'development' : 'production',
      defaultIntegrations,
      // Очікувані/шумні помилки — не засмічують alert-rules (roadmap: "Filter expected errors").
      ignoreErrors: [
        'AbortError',
        'Failed to fetch', // офлайн / network blip, вже покрито offline-indicator.js
        'Load failed',
        'ResizeObserver loop',
      ],
      tracesSampleRate: 0, // performance tracing не потрібен для Phase 16 basic
    });

    // Лінивий імпорт — не блокує ранній Sentry.init() вагою supabase-js.
    const { supabase } = await import('./supabaseClient.js');

    const { data } = await supabase.auth.getSession();
    const uid = data?.session?.user?.id;
    if (uid) Sentry.setUser({ id: uid }); // лише id, без email/PII

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        Sentry.setUser({ id: session.user.id });
      }
      if (event === 'SIGNED_OUT') {
        Sentry.setUser(null);
      }
    });
  } catch (e) {
    console.warn('[error-tracking] Sentry SDK не завантажився', e);
  }
}

// Викликаємо ОДРАЗУ (топ-рівень модуля), НЕ чекаючи DOMContentLoaded — модуль
// підключений у <head>, де document.head вже доступний. Чекання на
// DOMContentLoaded тут означало б пропустити помилки, що трапляються під час
// парсингу решти сторінки (саме ті, що найважче відтворити вручну пізніше).
initErrorTracking();
