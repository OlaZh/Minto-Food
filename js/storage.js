// =============================================================
// STORAGE.JS — Централізоване управління localStorage
// =============================================================
// Цей файл замінює розкидані по проєкту функції:
// - getWaterNorm(), getDailyCaloriesNorm(), getProteinNorm() тощо
// Тепер всі норми та налаштування в одному місці
// =============================================================

// =============================================================
// КЛЮЧІ STORAGE
// =============================================================

export const STORAGE_KEYS = {
  // Профіль користувача
  USER_PROFILE: 'userProfile',
  USER_AGE: 'userAge',
  USER_HEIGHT: 'userHeight',
  USER_WEIGHT: 'userWeight',
  USER_GENDER: 'userGender',
  USER_ACTIVITY: 'userActivity',
  USER_GOAL: 'userGoal',
  TARGET_WEIGHT: 'targetWeight',

  // Норми КБЖУ
  DAILY_CALORIES: 'dailyCaloriesNorm',
  USER_PROTEIN: 'userProtein',
  USER_FAT: 'userFat',
  USER_CARBS: 'userCarbs',
  USER_WATER: 'userWater',

  // Трекери
  WATER_TODAY: 'waterTodayMl',
  TODAY_BURNED_CALORIES: 'todayBurnedCalories',

  // Тимчасові дані
  WEEK_SHOPPING_LIST: 'week_shopping_list',
  COPIED_WEEK: 'copied_week',

  // Налаштування
  LANG: 'lang',
  THEME: 'theme',
  MEASUREMENT_SYSTEM: 'measurementSystem',

  // Поради
  SHOWN_ADVICE: 'shown_advice',
};

// =============================================================
// БАЗОВІ ОПЕРАЦІЇ
// =============================================================

/**
 * Отримати значення з localStorage
 * @param {string} key - Ключ
 * @param {*} defaultValue - Значення за замовчуванням
 * @returns {*} - Значення або defaultValue
 */
export function getItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;

    // Спробувати розпарсити JSON
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  } catch (e) {
    console.warn(`Storage: помилка читання ${key}`, e);
    return defaultValue;
  }
}

/**
 * Зберегти значення в localStorage
 * @param {string} key - Ключ
 * @param {*} value - Значення (автоматично серіалізується)
 */
export function setItem(key, value) {
  try {
    const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
    localStorage.setItem(key, serialized);
  } catch (e) {
    console.warn(`Storage: помилка запису ${key}`, e);
  }
}

/**
 * Видалити значення з localStorage
 * @param {string} key - Ключ
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`Storage: помилка видалення ${key}`, e);
  }
}

// =============================================================
// НОРМИ КБЖУ — Єдине джерело правди
// =============================================================

/**
 * Отримати норму води (в літрах)
 * @returns {number} - Літри
 */
export function getWaterNorm() {
  const saved = localStorage.getItem(STORAGE_KEYS.USER_WATER);
  if (!saved) return 2.5;
  return Number(String(saved).replace(',', '.'));
}

/**
 * Отримати денну норму калорій
 * @returns {number} - Калорії
 */
export function getDailyCaloriesNorm() {
  const saved = localStorage.getItem(STORAGE_KEYS.DAILY_CALORIES);
  return saved ? Number(saved) : 2000;
}

/**
 * Отримати норму білка (грами)
 * @returns {number} - Грами
 */
export function getProteinNorm() {
  const saved = localStorage.getItem(STORAGE_KEYS.USER_PROTEIN);
  return saved ? Number(saved) : 100;
}

/**
 * Отримати норму жирів (грами)
 * @returns {number} - Грами
 */
export function getFatNorm() {
  const saved = localStorage.getItem(STORAGE_KEYS.USER_FAT);
  return saved ? Number(saved) : 70;
}

/**
 * Отримати норму вуглеводів (грами)
 * @returns {number} - Грами
 */
export function getCarbsNorm() {
  const saved = localStorage.getItem(STORAGE_KEYS.USER_CARBS);
  return saved ? Number(saved) : 250;
}

// =============================================================
// НАЛАШТУВАННЯ
// =============================================================

/**
 * Отримати мову
 * @returns {string} - Код мови
 */
export function getLang() {
  return getItem(STORAGE_KEYS.LANG, 'ua');
}

/**
 * Зберегти мову
 * @param {string} lang - Код мови
 */
export function setLang(lang) {
  setItem(STORAGE_KEYS.LANG, lang);
}

/**
 * Отримати тему
 * @returns {string} - 'light' або 'dark'
 */
export function getTheme() {
  return getItem(STORAGE_KEYS.THEME, 'light');
}

/**
 * Зберегти тему
 * @param {string} theme - 'light' або 'dark'
 */
export function setTheme(theme) {
  setItem(STORAGE_KEYS.THEME, theme);
}

/**
 * Отримати систему одиниць виміру
 * @returns {string} - 'metric' або 'imperial'
 */
export function getMeasurementSystem() {
  return getItem(STORAGE_KEYS.MEASUREMENT_SYSTEM, 'metric');
}

/**
 * Зберегти систему одиниць виміру
 * @param {string} system - 'metric' або 'imperial'
 */
export function setMeasurementSystem(system) {
  setItem(STORAGE_KEYS.MEASUREMENT_SYSTEM, system);
}

// =============================================================
// СПИСОК ПОКУПОК (тимчасове збереження)
// =============================================================

/**
 * Отримати тимчасовий список покупок з меню тижня
 * @returns {Array} - Список продуктів
 */
export function getWeekShoppingList() {
  return getItem(STORAGE_KEYS.WEEK_SHOPPING_LIST, []);
}

/**
 * Зберегти список покупок з меню тижня
 * @param {Array} list - Список продуктів
 */
export function saveWeekShoppingList(list) {
  setItem(STORAGE_KEYS.WEEK_SHOPPING_LIST, list);
}

/**
 * Очистити тимчасовий список покупок
 */
export function clearWeekShoppingList() {
  removeItem(STORAGE_KEYS.WEEK_SHOPPING_LIST);
}
