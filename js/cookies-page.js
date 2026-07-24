import { reopenCookieBanner } from './cookie-consent.js';

// Кнопка є в кожному мовному блоці (ua/en/pl) — тому клас, не id
document.querySelectorAll('.js-reopen-cookies').forEach((btn) => {
  btn.addEventListener('click', () => reopenCookieBanner());
});
