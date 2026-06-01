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

function readCookie(name) {
  const prefix = `${name}=`;
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function writeCookie(name, value, maxAgeSeconds) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function deleteCookie(name) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function getConsent() {
  try {
    const raw = readCookie(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(decodeURIComponent(raw));
    if (!data.savedAt || Date.now() - data.savedAt > TTL) {
      deleteCookie(STORAGE_KEY);
      return null;
    }
    // Версія змінилась — згода вже недійсна, потрібен re-prompt
    if (data.version !== CONSENT_VERSION) {
      deleteCookie(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function save(consent) {
  const data = { ...consent, necessary: true, version: CONSENT_VERSION, savedAt: Date.now() };
  writeCookie(STORAGE_KEY, JSON.stringify(data), Math.floor(TTL / 1000));
  document.dispatchEvent(new CustomEvent('consentUpdated', { detail: data }));
  return data;
}

function seenForCurrentVersion() {
  try {
    const raw = readCookie(SEEN_KEY);
    if (!raw) return false;
    return JSON.parse(decodeURIComponent(raw)).version === CONSENT_VERSION;
  } catch {
    return false;
  }
}

function markSeen() {
  writeCookie(SEEN_KEY, JSON.stringify({ version: CONSENT_VERSION }), Math.floor(TTL / 1000));
}

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

export function initCookieConsent() {
  // Валідна згода для поточної версії — нічого не робимо
  if (getConsent()) return;

  // Банер вже показували для цієї версії — не турбуємо знову
  if (seenForCurrentVersion()) return;

  markSeen();
  const banner = buildBanner();
  document.body.appendChild(banner);

  const prefs = banner.querySelector('#cbPrefs');

  banner.querySelector('#cbAcceptAll').addEventListener('click', () => {
    save({ analytics: true, marketing: true });
    banner.remove();
  });

  banner.querySelector('#cbRejectAll').addEventListener('click', () => {
    save({ analytics: false, marketing: false });
    banner.remove();
  });

  banner.querySelector('#cbCustomize').addEventListener('click', () => {
    prefs.hidden = false;
    banner.querySelector('#cbCustomize').hidden = true;
  });

  banner.querySelector('#cbSavePrefs').addEventListener('click', () => {
    save({
      analytics: banner.querySelector('#cbAnalytics').checked,
      marketing: banner.querySelector('#cbMarketing').checked,
    });
    banner.remove();
  });
}
