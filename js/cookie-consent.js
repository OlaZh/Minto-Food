const STORAGE_KEY = 'minto_consent';
const TTL = 180 * 24 * 60 * 60 * 1000; // 6 місяців

export function getConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.savedAt || Date.now() - data.savedAt > TTL) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function save(consent) {
  const data = { ...consent, necessary: true, savedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  document.dispatchEvent(new CustomEvent('consentUpdated', { detail: data }));
  return data;
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
      <div class="cookie-banner__toggle-row">
        <div class="cookie-banner__toggle-info">
          <span class="cookie-banner__toggle-name">Необхідні</span>
          <span class="cookie-banner__toggle-desc">Авторизація, сесія, безпека</span>
        </div>
        <input type="checkbox" checked disabled aria-label="Необхідні cookies" />
      </div>
      <div class="cookie-banner__toggle-row">
        <div class="cookie-banner__toggle-info">
          <span class="cookie-banner__toggle-name">Аналітика</span>
          <span class="cookie-banner__toggle-desc">PostHog — статистика використання (EU-hosting)</span>
        </div>
        <input type="checkbox" id="cbAnalytics" aria-label="Аналітичні cookies" />
      </div>
      <div class="cookie-banner__toggle-row">
        <div class="cookie-banner__toggle-info">
          <span class="cookie-banner__toggle-name">Маркетинг</span>
          <span class="cookie-banner__toggle-desc">Рекламні кампанії (наразі не використовуються)</span>
        </div>
        <input type="checkbox" id="cbMarketing" aria-label="Маркетингові cookies" />
      </div>
      <div class="cookie-banner__prefs-footer">
        <button class="cookie-banner__btn cookie-banner__btn--save" id="cbSavePrefs">Зберегти вибір</button>
      </div>
    </div>`;
  return el;
}

export function initCookieConsent() {
  if (getConsent()) return;

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
