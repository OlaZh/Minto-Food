import { getLang } from './storage.js';
import { iconCheckCircle, iconXCircle, iconAlertCircle, iconInfo } from './icons.js';

// =============================================================
// UTILS.JS — Спільні утиліти для MintoFood
// =============================================================
// Цей файл містить функції, які раніше дублювались у:
// - auth.js, profile.js, add-recipe.js, recipe-modal.js, week-menu.js
// =============================================================

// =============================================================
// TOAST NOTIFICATIONS
// =============================================================

/**
 * Показати toast-повідомлення
 * @param {string} message - Текст повідомлення
 * @param {('success'|'error'|'info')} type - Тип повідомлення
 * @param {number} duration - Тривалість показу в мс (за замовчуванням 3000)
 */
export function showToast(message, type = 'success', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;

  const icons = {
    success: iconCheckCircle,
    error:   iconXCircle,
    info:    iconInfo,
    warning: iconAlertCircle,
  };

  const icon = icons[type] || icons.success;

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-text"></span>
  `;
  toast.querySelector('.toast-text').textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, duration);
}

// =============================================================
// BUTTON LOADING STATE (спінер на час async-дії)
// =============================================================

/**
 * Увімкнути/вимкнути стан завантаження на кнопці: спінер + disabled +
 * aria-busy. Оригінальний вміст кнопки відновлюється при вимкненні.
 * @param {HTMLButtonElement|null} btn - Кнопка
 * @param {boolean} loading - true = показати спінер, false = відновити
 * @param {string} [busyText] - Опційний текст на час завантаження
 *        (напр. "Збереження…"); без нього лишається оригінальний напис
 */
export function setButtonLoading(btn, loading, busyText = '') {
  if (!btn) return;

  if (loading) {
    if (btn.dataset.loadingHtml !== undefined) return; // вже в loading-стані
    btn.dataset.loadingHtml = btn.innerHTML;
    // Фіксуємо ширину, щоб кнопка не "стрибала" від зміни вмісту
    btn.style.minWidth = `${btn.offsetWidth}px`;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.classList.add('btn-is-loading');

    const spinner = document.createElement('span');
    spinner.className = 'btn-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    if (busyText) btn.textContent = busyText;
    btn.prepend(spinner);
    return;
  }

  if (btn.dataset.loadingHtml === undefined) return;
  btn.innerHTML = btn.dataset.loadingHtml;
  delete btn.dataset.loadingHtml;
  btn.style.minWidth = '';
  btn.disabled = false;
  btn.removeAttribute('aria-busy');
  btn.classList.remove('btn-is-loading');
}

/**
 * Обгортка для async-дії: спінер на кнопці на час виконання,
 * гарантоване відновлення у finally (навіть якщо дія кинула помилку).
 * Повторний клік під час виконання ігнорується (кнопка disabled).
 * @param {HTMLButtonElement|null} btn - Кнопка
 * @param {() => Promise<*>} action - Async-функція дії
 * @param {string} [busyText] - Опційний текст на час завантаження
 * @returns {Promise<*>} - Результат action
 */
export async function withButtonLoading(btn, action, busyText = '') {
  if (btn?.dataset.loadingHtml !== undefined) return undefined; // вже виконується
  setButtonLoading(btn, true, busyText);
  try {
    return await action();
  } finally {
    setButtonLoading(btn, false);
  }
}

// =============================================================
// GLOBAL PROGRESS BAR (тонка смуга вгорі для довгих дій)
// =============================================================

let _progressEl = null;
let _progressActive = 0;

/**
 * Показати глобальний progress bar (indeterminate-режим).
 * Виклики рахуються: кожному startProgress() має відповідати doneProgress().
 */
export function startProgress() {
  _progressActive += 1;
  if (_progressEl) return;
  _progressEl = document.createElement('div');
  _progressEl.className = 'app-progress app-progress--indeterminate';
  _progressEl.setAttribute('role', 'progressbar');
  _progressEl.innerHTML = '<div class="app-progress__bar"></div>';
  document.body.appendChild(_progressEl);
}

/**
 * Перевести progress bar у визначений режим і виставити відсоток.
 * @param {number} percent - 0..100
 */
export function setProgress(percent) {
  if (!_progressEl) startProgress();
  _progressEl.classList.remove('app-progress--indeterminate');
  const bar = _progressEl.querySelector('.app-progress__bar');
  if (bar) bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

/**
 * Завершити progress bar: доливає до 100% і плавно ховає.
 */
export function doneProgress() {
  if (_progressActive > 0) _progressActive -= 1;
  if (_progressActive > 0 || !_progressEl) return;
  const el = _progressEl;
  _progressEl = null;
  el.classList.remove('app-progress--indeterminate');
  const bar = el.querySelector('.app-progress__bar');
  if (bar) bar.style.width = '100%';
  setTimeout(() => {
    el.classList.add('app-progress--done');
    setTimeout(() => el.remove(), 350);
  }, 150);
}

// =============================================================
// FILE CONVERSION
// =============================================================

/**
 * Конвертувати файл у base64
 * @param {File} file - Файл для конвертації
 * @returns {Promise<string>} - Base64 строка
 */
export function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

// =============================================================
// NUMBER PARSING
// =============================================================

/**
 * Парсити число з різних форматів (дроби, коми, крапки)
 * @param {string|number} value - Значення для парсингу
 * @returns {number} - Число або 0
 */
export function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  const str = value.toString().trim();

  // Підтримка дробів типу "1/2", "3/4"
  if (str.includes('/')) {
    const [num, den] = str.split('/').map(Number);
    return den && !isNaN(num) ? num / den : 0;
  }

  // Заміна коми на крапку для десяткових
  return parseFloat(str.replace(',', '.')) || 0;
}

/**
 * Форматувати число з фіксованою кількістю десяткових
 * @param {number} value - Число
 * @param {number} decimals - Кількість десяткових знаків
 * @returns {string} - Відформатоване число
 */
export function formatNumber(value, decimals = 1) {
  const num = parseNumber(value);
  return num.toFixed(decimals);
}

// =============================================================
// DATE HELPERS
// =============================================================

/**
 * Отримати локальну дату у форматі YYYY-MM-DD
 * @param {Date} date - Дата (за замовчуванням сьогодні)
 * @returns {string} - Дата у форматі YYYY-MM-DD
 */
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Отримати дату у форматі DD.MM
 * @param {Date} date - Дата
 * @returns {string} - Дата у форматі DD.MM
 */
export function formatDateShort(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

/**
 * Отримати дату у форматі DD.MM.YYYY
 * @param {Date} date - Дата
 * @returns {string} - Дата у форматі DD.MM.YYYY
 */
export function formatDateFull(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// =============================================================
// STRING HELPERS
// =============================================================

/**
 * Екранування HTML для запобігання XSS
 * @param {string} str - Строка для екранування
 * @returns {string} - Екранована строка
 */
export function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Перетворює HTML-сутності з зовнішніх API на звичайний текст.
 * Результат усе одно треба екранувати перед вставкою через innerHTML.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function decodeHTMLEntities(value) {
  const namedEntities = {
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    nbsp: ' ',
    laquo: '«',
    raquo: '»',
    ndash: '–',
    mdash: '—',
    hellip: '…',
    ldquo: '“',
    rdquo: '”',
    lsquo: '‘',
    rsquo: '’',
  };
  const entityPattern = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;
  let decoded = String(value ?? '');

  // Два проходи також виправляють подвійно закодовані значення на кшталт &amp;quot;.
  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded.replace(entityPattern, (match, entity) => {
      const normalized = entity.toLowerCase();
      if (normalized.startsWith('#')) {
        const isHex = normalized.startsWith('#x');
        const codePoint = Number.parseInt(normalized.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
          try {
            return String.fromCodePoint(codePoint);
          } catch (_) {
            return match;
          }
        }
        return match;
      }
      return namedEntities[normalized] ?? match;
    });
    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

export function safeImageUrl(url) {
  const value = String(url ?? '').trim();
  if (!value) return '';

  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(value)) return value;
  if (/^blob:/i.test(value)) return value;

  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (_) {}

  return '';
}

export function setInputVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}

/**
 * Обрізати текст до максимальної довжини
 * @param {string} text - Текст
 * @param {number} maxLength - Максимальна довжина
 * @param {string} suffix - Суфікс (за замовчуванням '...')
 * @returns {string} - Обрізаний текст
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength - suffix.length) + suffix;
}

// =============================================================
// UNIT CONVERSION (для списку покупок)
// =============================================================

const UNIT_CONVERSIONS = {
  кг: { base: 'г', factor: 1000 },
  kg: { base: 'g', factor: 1000 },
  л: { base: 'мл', factor: 1000 },
  l: { base: 'ml', factor: 1000 },
};

/**
 * Конвертувати одиниці вимірювання до базових
 * @param {number} amount - Кількість
 * @param {string} unit - Одиниця вимірювання
 * @returns {{ amount: number, unit: string }} - Конвертовані значення
 */
export function convertToBaseUnit(amount, unit) {
  const conversion = UNIT_CONVERSIONS[unit.toLowerCase()];
  if (conversion) {
    return {
      amount: amount * conversion.factor,
      unit: conversion.base,
    };
  }
  return { amount, unit };
}

// Примітка: formatAmount живе лише в parse-food.js (єдиний споживач —
// add-recipe.js). Дубль-копія з utils була мертвим експортом (0 імпортів)
// і видалена в межах F.

// =============================================================
// DEBOUNCE / THROTTLE
// =============================================================

/**
 * Debounce функція — затримує виклик до завершення серії викликів
 * @param {Function} func - Функція для debounce
 * @param {number} wait - Час очікування в мс
 * @returns {Function} - Debounced функція
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle функція — обмежує частоту викликів
 * @param {Function} func - Функція для throttle
 * @param {number} limit - Мінімальний інтервал в мс
 * @returns {Function} - Throttled функція
 */
export function throttle(func, limit = 100) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// =============================================================
// DOM HELPERS
// =============================================================

/**
 * Безпечно отримати елемент
 * @param {string} selector - CSS селектор
 * @returns {Element|null} - Елемент або null
 */
export function $(selector) {
  return document.querySelector(selector);
}

/**
 * Безпечно отримати всі елементи
 * @param {string} selector - CSS селектор
 * @returns {NodeList} - Список елементів
 */
export function $$(selector) {
  return document.querySelectorAll(selector);
}

/**
 * Отримати елемент по ID
 * @param {string} id - ID елемента
 * @returns {Element|null} - Елемент або null
 */
export function $id(id) {
  return document.getElementById(id);
}

// =============================================================
// VALIDATION
// =============================================================

/**
 * Перевірити чи email валідний
 * @param {string} email - Email для перевірки
 * @returns {boolean} - true якщо валідний
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Перевірити чи значення не порожнє
 * @param {*} value - Значення для перевірки
 * @returns {boolean} - true якщо не порожнє
 */
export function isNotEmpty(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

// =============================================================
// LANGUAGE HELPERS
// =============================================================

/**
 * Отримати поточну мову з localStorage
 * @returns {string} - Код мови (ua, en, pl)
 */
export function getCurrentLang() {
  return getLang();
}

/**
 * Українська плюралізація: обирає форму слова за числом.
 * @param {number} n - Число
 * @param {[string, string, string]} forms - [одна, дві-чотири, п'ять+]
 *        напр. ['страва','страви','страв'], ['день','дні','днів']
 * @returns {string} - Правильна форма (без самого числа)
 */
export function pluralUA(n, [one, few, many]) {
  const lastTwo = n % 100;
  const lastOne = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (lastOne === 1) return one;
  if (lastOne >= 2 && lastOne <= 4) return few;
  return many;
}

/**
 * Локалізована плюралізація: обирає форму за числом і мовою.
 * UA/PL — слов'янське правило (3 форми one/few/many).
 * EN — англійське (one/other → беремо one/many).
 * @param {number} n - Число
 * @param {[string, string, string]} forms - [one, few, many]
 * @param {string} [lang] - 'ua' | 'pl' | 'en' (default: getLang())
 * @returns {string} - Правильна форма (без самого числа)
 */
export function plural(n, [one, few, many], lang = getLang()) {
  if (lang === 'en') return n === 1 ? one : many;
  return pluralUA(n, [one, few, many]);
}

// Примітка: локалізація назви рецепта живе в getRecipeDisplayName
// (recipe-utils.js — споживачі: add-recipe, week-menu). Дубль-копія
// getLocalizedName тут була мертвим експортом (0 імпортів) і видалена в
// межах F. getCurrentLang лишено (тонка обгортка над getLang, E тримає).

// =============================================================
// UUID GENERATOR
// =============================================================

/**
 * Генерувати унікальний ID
 * @returns {string} - UUID
 */
export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// =============================================================
// AUTO-RESIZE TEXTAREA
// =============================================================

/**
 * Авто-розмір textarea по контенту
 * @param {HTMLTextAreaElement} textarea - Елемент textarea
 */
export function autoResizeTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

/**
 * Ініціалізувати авто-розмір для всіх textarea
 * @param {string} selector - CSS селектор (за замовчуванням 'textarea')
 */
export function initAutoResizeTextareas(selector = 'textarea') {
  document.querySelectorAll(selector).forEach((textarea) => {
    textarea.style.overflow = 'hidden';
    textarea.addEventListener('input', () => autoResizeTextarea(textarea));
  });
}
