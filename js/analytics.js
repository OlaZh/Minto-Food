// analytics.js — PostHog (EU-hosting), тільки коли consent_analytics === true.
// Auto-init за тим самим патерном, що cookie-consent.js/offline-indicator.js:
// підключається як <script type="module"> і сам себе ініціалізує.
//
// Ключі не хардкодяться (repo публічний): читаються з meta-тега /
// window-глобалу, за патерном runtime-config.js. Без ключа PostHog просто
// не вантажиться — нічого не ламається. Реальне підставлення значень —
// build.js інжектить <meta> з env vars при build (див. коментар нижче).
//
//   <meta name="minto-posthog-key" content="phc_..." />
//   <meta name="minto-posthog-host" content="https://eu.i.posthog.com" />
//
// Consent arbitration (last-write-wins, race-safe identify) винесена в
// js/analytics-consent-gate.js — чистий модуль без document/supabase/CDN
// залежностей, unit-тестований напряму в scripts/consent-gate-check.mjs.
// Цей файл лише підключає реальні deps (CDN import, meta-теги, Supabase).

import { supabase } from './supabaseClient.js';
import { getConsentReadyState } from './cookie-consent.js';
import { createConsentGate } from './analytics-consent-gate.js';

// Версія SDK ЗАФІКСОВАНА (не @1/@8 floating) — floating tag на CDN може
// підсунути breaking change без нашого відома. Оновлювати свідомо.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/posthog-js@1.203.1/dist/module.full.min.js';
const DEFAULT_HOST = 'https://eu.i.posthog.com'; // EU hosting обов'язковий для GDPR

function readMeta(name) {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || null;
}

function readGlobal(name) {
  return typeof window !== 'undefined' ? window[name] || null : null;
}

function getApiKey() {
  return readMeta('minto-posthog-key') || readGlobal('MINTO_POSTHOG_KEY') || null;
}

function getHost() {
  return readMeta('minto-posthog-host') || readGlobal('MINTO_POSTHOG_HOST') || DEFAULT_HOST;
}

const gate = createConsentGate({
  loadModule: () => import(/* @vite-ignore */ SDK_URL),
  getApiKey,
  initSdk: (mod, apiKey) => {
    const posthog = mod.default;
    posthog.init(apiKey, {
      api_host: getHost(),
      person_profiles: 'identified_only',
      capture_pageview: false, // ручний pageview — consent-gate контролює момент
      autocapture: false,
      disable_session_recording: true, // Session recordings — окремо, з маскою (roadmap Фаза 16)
    });
    return posthog;
  },
  getSession: async () => {
    const { data } = await supabase.auth.getSession();
    return { userId: data?.session?.user?.id ?? null };
  },
  onLoadError: (e) => console.warn('[analytics] PostHog SDK не завантажився', e),
});

// Публічний track — no-op якщо SDK ще не ініціалізований (напр. consent
// відсутній, або ще не завантажився). gate.capture() синхронно перевіряє
// внутрішній instance, не потребує async — залишено async у сигнатурі для
// сумісності з існуючими викликами (`await track(...)` по всьому коду).
export async function track(event, properties = {}) {
  gate.capture(event, properties);
}

let _initDone = false;

export async function initAnalytics() {
  if (_initDone) return;
  _initDone = true;

  document.addEventListener('consentUpdated', (e) => gate.applyConsent(e.detail));

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') gate.onSignedIn();
    if (event === 'SIGNED_OUT') gate.onSignedOut();
  });

  const readyState = getConsentReadyState();
  if (readyState.resolved) {
    gate.applyConsent(readyState.consent);
  } else {
    document.addEventListener('consentReady', (e) => gate.applyConsent(e.detail), { once: true });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAnalytics());
  } else {
    initAnalytics();
  }
}
