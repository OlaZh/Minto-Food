// =============================================================
// offline-indicator.js — глобальний індикатор втрати з'єднання
// Auto-init: інжектиться build.js на всі сторінки перед </body>.
// Показує банер зверху коли браузер offline; при відновленні —
// коротко показує зелений банер і ховає.
// =============================================================

import { t } from './i18n-apply.js';

const BANNER_ID = 'offlineBanner';
let _hideTimer = null;

function _ensureBanner() {
  let el = document.getElementById(BANNER_ID);
  if (el) return el;
  el = document.createElement('div');
  el.id = BANNER_ID;
  el.className = 'offline-banner';
  el.setAttribute('role', 'status');
  el.hidden = true;
  document.body.appendChild(el);
  return el;
}

function _showOffline() {
  const el = _ensureBanner();
  clearTimeout(_hideTimer);
  el.textContent = t('offlineBanner');
  el.classList.remove('offline-banner--online');
  el.hidden = false;
}

function _showOnline() {
  const el = _ensureBanner();
  el.textContent = t('onlineBanner');
  el.classList.add('offline-banner--online');
  el.hidden = false;
  clearTimeout(_hideTimer);
  _hideTimer = setTimeout(() => { el.hidden = true; }, 3000);
}

function init() {
  window.addEventListener('offline', _showOffline);
  window.addEventListener('online', _showOnline);
  // Якщо сторінка відкрилась уже без мережі
  if (navigator.onLine === false) _showOffline();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
