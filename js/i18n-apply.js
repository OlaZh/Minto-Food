// =====================================
// I18N-APPLY — глобальний застосувач перекладів (G)
// =====================================
// Проходить по DOM і підставляє переклади зі словника i18n.js у будь-який
// елемент із data-i18n / data-i18n-placeholder / data-i18n-aria.
// Підключається build.js-ом на КОЖНУ сторінку (як cookie-consent) →
// один механізм замість точкового перекладу в кожному page-JS.
//
// Канон ключа мови — 'ua' (як storage.getLang() і словник i18n.js).
// recipe-page вживає локальний 'uk' для власних цілей — тут нормалізуємо
// uk→ua, щоб footer-перемикач і словник збігались.

import { i18n } from './i18n.js';
import { getLang, setLang } from './storage.js';

// uk → ua (канон). Якщо мови нема у словнику — фолбек на 'ua'.
function normalizeLang(lang) {
  const l = lang === 'uk' ? 'ua' : lang;
  return i18n[l] ? l : 'ua';
}

/**
 * Перекладає текст ключем у поточну (або задану) мову.
 * Фолбек: поточна мова → ua → сам ключ.
 */
export function t(key, lang = getLang()) {
  const l = normalizeLang(lang);
  return i18n[l]?.[key] ?? i18n.ua?.[key] ?? key;
}

/**
 * t() + підстановка плейсхолдерів {name} зі значень vars.
 * Напр. formatText('ofKcal', { n: 1200 }) → 'з 1200 ккал'.
 * (Спільна версія локальних formatText із add-recipe/week-menu.)
 */
export function formatText(key, vars = {}, lang = getLang()) {
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    t(key, lang),
  );
}

/**
 * Проходить по DOM-піддереву (root) і застосовує переклади.
 * Викликається на DOMContentLoaded + може викликатись повторно після
 * того, як JS догенерував контент із data-i18n.
 * @param {ParentNode} root - корінь піддерева (default document)
 */
export function applyTranslations(root = document) {
  const lang = normalizeLang(getLang());
  const dict = i18n[lang] || i18n.ua;
  if (!dict) return;

  // Текстовий вміст
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const val = dict[key] ?? i18n.ua[key];
    if (val != null) el.textContent = val;
  });

  // Плейсхолдери інпутів
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    const val = dict[key] ?? i18n.ua[key];
    if (val != null) el.setAttribute('placeholder', val);
  });

  // aria-label
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset.i18nAria;
    const val = dict[key] ?? i18n.ua[key];
    if (val != null) el.setAttribute('aria-label', val);
  });

  // title / document.title
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle;
    const val = dict[key] ?? i18n.ua[key];
    if (val == null) return;
    if (el.tagName === 'TITLE') {
      document.title = val;
    } else {
      el.setAttribute('title', val);
    }
  });

  // Мовні блоки для довгих текстів (правові сторінки): показуємо блок
  // поточної мови, ховаємо решту. У markup видимий за замовчуванням UA-блок,
  // EN/PL мають hidden — тож без JS користувач бачить оригінал.
  root.querySelectorAll('[data-lang-block]').forEach((el) => {
    el.hidden = normalizeLang(el.dataset.langBlock) !== lang;
  });

  // <html lang="…"> для доступності/SEO (ua→uk як валідний код)
  document.documentElement.setAttribute('lang', lang === 'ua' ? 'uk' : lang);
}

/**
 * Оживляє перемикач мови у футері (site-footer__lang-btn[data-lang]).
 * Зберігає вибір і перезавантажує сторінку — найнадійніший спосіб
 * перемалювати ВЕСЬ контент (включно з динамічним JS-рендером).
 */
export function initLangSwitcher() {
  const current = normalizeLang(getLang());
  const btns = document.querySelectorAll('.site-footer__lang-btn');

  btns.forEach((btn) => {
    const btnLang = normalizeLang(btn.dataset.lang);
    // Підсвітити активну
    btn.classList.toggle('is-active', btnLang === current);

    btn.addEventListener('click', () => {
      if (btnLang === normalizeLang(getLang())) return; // вже ця мова
      setLang(btnLang);
      location.reload();
    });
  });
}

// Авто-ініціалізація на кожній сторінці.
function init() {
  applyTranslations();
  initLangSwitcher();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
