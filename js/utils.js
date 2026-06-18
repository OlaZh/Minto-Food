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
