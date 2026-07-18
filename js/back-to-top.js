// =============================================================
// back-to-top.js — кнопка "Нагору" (глобальна)
// Auto-init: інжектиться build.js на всі сторінки перед </body>.
// З'являється після прокрутки на 600px, плавний скрол догори.
// =============================================================

import { t } from './i18n-apply.js';

const BTN_ID = 'backToTopBtn';
const SHOW_AFTER_PX = 600;

function init() {
  if (document.getElementById(BTN_ID)) return;

  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.type = 'button';
  btn.className = 'back-to-top';
  btn.setAttribute('aria-label', t('backToTop'));
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"></polyline></svg>';
  document.body.appendChild(btn);

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  let ticking = false;
  const update = () => {
    btn.classList.toggle('back-to-top--visible', window.scrollY > SHOW_AFTER_PX);
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
