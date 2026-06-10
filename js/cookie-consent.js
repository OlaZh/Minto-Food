// ─────────────────────────────────────────────────────────────
// CONSENT_VERSION — підвищити коли додаються нові категорії cookies.
// Це автоматично покаже банер повторно всім юзерам з попередньою версією.
//
// Приклади змін що вимагають bump:
//   '1' → '2'  при додаванні нового провайдера (PostHog, Intercom і т.д.)
//   '2' → '3'  при додаванні нової категорії cookies
// ─────────────────────────────────────────────────────────────
const CONSENT_VERSION = '1';

const STORAGE_KEY = 'minto_consent';
const SEEN_KEY    = 'minto_consent_seen';
const TTL = 180 * 24 * 60 * 60 * 1000; // 6 місяців

import { supabase } from './supabaseClient.js';

// ─────────────────────────────────────────────────────────────
// ДЖЕРЕЛО ПРАВДИ
//   • Гість (не залогінений)  → localStorage. Так вимагає GDPR:
//     до логіну немає де зберігати в БД.
//   • Залогінений             → таблиця profiles у Supabase. Згода
//     прив'язана до акаунта і їде за користувачем на будь-який
//     пристрій — банер не лізе після зміни пристрою чи чистки кешу.
// ─────────────────────────────────────────────────────────────

// ─── localStorage (гість) ───────────────────────────────────

export function getConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.savedAt || Date.now() - data.savedAt > TTL) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Версія змінилась — згода вже недійсна, потрібен re-prompt
    if (data.version !== CONSENT_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveLocal(consent) {
  const data = { ...consent, necessary: true, version: CONSENT_VERSION, savedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  document.dispatchEvent(new CustomEvent('consentUpdated', { detail: data }));
  return data;
}

function seenForCurrentVersion() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return false;
    return JSON.parse(raw).version === CONSENT_VERSION;
  } catch {
    return false;
  }
}

function markSeen() {
  localStorage.setItem(SEEN_KEY, JSON.stringify({ version: CONSENT_VERSION }));
}

// ─── Supabase profiles (залогінений) ────────────────────────

// Читає згоду з БД. Повертає:
//   об'єкт consent — якщо в БД є валідна згода поточної версії
//   null           — якщо згоди ще немає або версія застаріла (треба показати банер)
async function getConsentFromDB(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('consent_analytics, consent_marketing, consent_version, consent_at')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    if (data.consent_version !== CONSENT_VERSION) return null;
    if (data.consent_analytics === null) return null; // ще не відповідав
    return {
      necessary: true,
      analytics: data.consent_analytics,
      marketing: data.consent_marketing,
      version: data.consent_version,
      savedAt: data.consent_at ? Date.parse(data.consent_at) : Date.now(),
    };
  } catch {
    return null;
  }
}

async function saveConsentToDB(userId, consent) {
  try {
    await supabase
      .from('profiles')
      .update({
        consent_analytics: !!consent.analytics,
        consent_marketing: !!consent.marketing,
        consent_version: CONSENT_VERSION,
        consent_at: new Date().toISOString(),
      })
      .eq('id', userId);
  } catch (e) {
    console.warn('Cookie consent: не вдалось зберегти в БД', e);
  }
}

// Зберегти вибір: пише і локально (миттєвий ефект + узгодженість),
// і в БД якщо користувач залогінений.
async function saveConsent(consent, userId) {
  const data = saveLocal(consent);
  if (userId) await saveConsentToDB(userId, data);
  return data;
}

// ─── Поточний користувач ────────────────────────────────────

async function getUserId() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Банер ──────────────────────────────────────────────────

function buildBanner() {
  const el = document.createElement('div');
  el.className = 'cookie-banner';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Налаштування cookies');
  el.innerHTML = `
    <div class="cookie-banner__main">
      <p class="cookie-banner__text">
        Ми використовуємо cookies для аналітики та покращення сервісу.
        <a href="cookies.html" class="cookie-banner__link">Детальніше</a>
      </p>
      <div class="cookie-banner__actions">
        <button class="cookie-banner__btn cookie-banner__btn--customize" id="cbCustomize">Налаштувати</button>
        <button class="cookie-banner__btn cookie-banner__btn--reject" id="cbRejectAll">Відхилити все</button>
        <button class="cookie-banner__btn cookie-banner__btn--accept" id="cbAcceptAll">Прийняти все</button>
      </div>
    </div>
    <div class="cookie-banner__prefs" id="cbPrefs" hidden>
      <label class="cookie-banner__toggle-item cookie-banner__toggle-item--disabled">
        <input type="checkbox" checked disabled aria-label="Необхідні cookies" />
        <span>Необхідні</span>
      </label>
      <label class="cookie-banner__toggle-item">
        <input type="checkbox" id="cbAnalytics" aria-label="Аналітичні cookies" />
        <span>Аналітика</span>
      </label>
      <label class="cookie-banner__toggle-item">
        <input type="checkbox" id="cbMarketing" aria-label="Маркетингові cookies" />
        <span>Маркетинг</span>
      </label>
      <button class="cookie-banner__btn cookie-banner__btn--save" id="cbSavePrefs">Зберегти вибір</button>
    </div>`;
  return el;
}

function showBanner(userId) {
  // Захист від подвійного показу (напр. init + подія SIGNED_IN)
  if (document.querySelector('.cookie-banner')) return;

  markSeen();
  const banner = buildBanner();
  document.body.appendChild(banner);

  const prefs = banner.querySelector('#cbPrefs');

  banner.querySelector('#cbAcceptAll').addEventListener('click', async () => {
    await saveConsent({ analytics: true, marketing: true }, userId);
    banner.remove();
  });

  banner.querySelector('#cbRejectAll').addEventListener('click', async () => {
    await saveConsent({ analytics: false, marketing: false }, userId);
    banner.remove();
  });

  banner.querySelector('#cbCustomize').addEventListener('click', () => {
    prefs.hidden = false;
    banner.querySelector('#cbCustomize').hidden = true;
  });

  banner.querySelector('#cbSavePrefs').addEventListener('click', async () => {
    await saveConsent(
      {
        analytics: banner.querySelector('#cbAnalytics').checked,
        marketing: banner.querySelector('#cbMarketing').checked,
      },
      userId,
    );
    banner.remove();
  });
}

// ─── Точка входу ────────────────────────────────────────────

// Чи вже навішений слухач auth — щоб не дублювати при повторних init
let _authListenerBound = false;

// Реагуємо на вхід/вихід ВЖЕ ПІСЛЯ завантаження сторінки (логін через
// модалку). При вході — переносимо згоду гостя в БД і прибираємо банер,
// якщо в акаунті згода вже є.
function bindAuthListener() {
  if (_authListenerBound) return;
  _authListenerBound = true;

  supabase.auth.onAuthStateChange(async (event, session) => {
    const uid = session?.user?.id;
    if (event === 'SIGNED_IN' && uid) {
      const dbConsent = await getConsentFromDB(uid);
      if (dbConsent) {
        // В акаунті вже є згода — банер більше не потрібен
        saveLocal(dbConsent);
        document.querySelector('.cookie-banner')?.remove();
      } else {
        // Переносимо згоду, яку гість міг дати в localStorage
        const local = getConsent();
        if (local) await saveConsentToDB(uid, local);
      }
    }
  });
}

let _consentInitDone = false;

export async function initCookieConsent() {
  // Захист від подвійного запуску: авто-init при завантаженні + можливий
  // ручний виклик (напр. кнопка "перевідкрити" на cookies.html).
  if (_consentInitDone) return;
  _consentInitDone = true;

  bindAuthListener();

  const userId = await getUserId();

  if (userId) {
    // ── Залогінений: джерело правди — БД ──
    const dbConsent = await getConsentFromDB(userId);
    if (dbConsent) {
      // Згода є в акаунті — банер не показуємо на жодному пристрої.
      // Синхронізуємо локальний кеш щоб аналітика на цій вкладці знала вибір.
      saveLocal(dbConsent);
      return;
    }

    // В БД згоди ще немає. Якщо гість раніше давав згоду в localStorage —
    // переносимо її в акаунт (одноразова міграція), банер не турбує.
    const local = getConsent();
    if (local) {
      await saveConsentToDB(userId, local);
      return;
    }

    // Ніде немає згоди — показуємо банер, відповідь піде в БД.
    showBanner(userId);
    return;
  }

  // ── Гість: localStorage ──
  if (getConsent()) return;
  if (seenForCurrentVersion()) return;
  showBanner(null);
}

// Примусово перевідкрити банер (кнопка "Налаштування cookies" на cookies.html).
// Скидає збережений вибір і показує банер незалежно від попереднього стану.
export async function reopenCookieBanner() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SEEN_KEY);
  document.querySelector('.cookie-banner')?.remove();
  const userId = await getUserId();
  showBanner(userId);
}

// ─── Авто-ініціалізація ─────────────────────────────────────
// Підключається як <script type="module" src="js/cookie-consent.js"> на всіх
// сторінках — банер сам показується раз, без ручного виклику в кожному файлі.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initCookieConsent());
  } else {
    initCookieConsent();
  }
}
