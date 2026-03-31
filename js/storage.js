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

  // Історія
  WEIGHT_HISTORY: 'weightHistory',
  ACTIVITY_HISTORY: 'activityHistory',

  // Тимчасові дані
  WEEK_SHOPPING_LIST: 'week_shopping_list',
  COPIED_WEEK: 'copied_week',

  // Налаштування
  LANG: 'lang',
  THEME: 'theme',

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

/**
 * Отримати всі норми одним об'єктом
 * @returns {Object} - { calories, protein, fat, carbs, water }
 */
export function getAllNorms() {
  return {
    calories: getDailyCaloriesNorm(),
    protein: getProteinNorm(),
    fat: getFatNorm(),
    carbs: getCarbsNorm(),
    water: getWaterNorm(),
  };
}

/**
 * Зберегти всі норми
 * @param {Object} norms - { calories, protein, fat, carbs, water }
 */
export function saveAllNorms(norms) {
  if (norms.calories !== undefined) setItem(STORAGE_KEYS.DAILY_CALORIES, norms.calories);
  if (norms.protein !== undefined) setItem(STORAGE_KEYS.USER_PROTEIN, norms.protein);
  if (norms.fat !== undefined) setItem(STORAGE_KEYS.USER_FAT, norms.fat);
  if (norms.carbs !== undefined) setItem(STORAGE_KEYS.USER_CARBS, norms.carbs);
  if (norms.water !== undefined) setItem(STORAGE_KEYS.USER_WATER, norms.water);
}

// =============================================================
// ПРОФІЛЬ КОРИСТУВАЧА
// =============================================================

/**
 * Отримати профіль користувача
 * @returns {Object} - Профіль
 */
export function getUserProfile() {
  return getItem(STORAGE_KEYS.USER_PROFILE, {
    age: null,
    height: null,
    weight: null,
    gender: 'female',
    activity: 1.375,
    goal: 'maintain',
    targetWeight: null,
  });
}

/**
 * Зберегти профіль користувача
 * @param {Object} profile - Профіль
 */
export function saveUserProfile(profile) {
  setItem(STORAGE_KEYS.USER_PROFILE, profile);

  // Також зберігаємо окремі поля для сумісності
  if (profile.age) setItem(STORAGE_KEYS.USER_AGE, profile.age);
  if (profile.height) setItem(STORAGE_KEYS.USER_HEIGHT, profile.height);
  if (profile.weight) setItem(STORAGE_KEYS.USER_WEIGHT, profile.weight);
  if (profile.gender) setItem(STORAGE_KEYS.USER_GENDER, profile.gender);
  if (profile.activity) setItem(STORAGE_KEYS.USER_ACTIVITY, profile.activity);
  if (profile.goal) setItem(STORAGE_KEYS.USER_GOAL, profile.goal);
}

// =============================================================
// ІСТОРІЯ ВАГИ
// =============================================================

/**
 * Отримати історію ваги
 * @returns {Array} - [{ date, weight }]
 */
export function getWeightHistory() {
  return getItem(STORAGE_KEYS.WEIGHT_HISTORY, []);
}

/**
 * Додати запис ваги
 * @param {number} weight - Вага
 * @param {string} date - Дата (опціонально, за замовчуванням сьогодні)
 */
export function addWeightRecord(weight, date = null) {
  const history = getWeightHistory();
  const recordDate = date || new Date().toLocaleDateString('uk-UA');

  // Перевірити чи вже є запис на цю дату
  const existingIndex = history.findIndex((r) => r.date === recordDate);

  if (existingIndex >= 0) {
    history[existingIndex].weight = weight;
  } else {
    history.push({ date: recordDate, weight });
  }

  // Сортувати по даті
  history.sort((a, b) => {
    const [d1, m1, y1] = a.date.split('.');
    const [d2, m2, y2] = b.date.split('.');
    return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
  });

  setItem(STORAGE_KEYS.WEIGHT_HISTORY, history);
}

// =============================================================
// ІСТОРІЯ АКТИВНОСТІ
// =============================================================

/**
 * Отримати історію активностей
 * @returns {Array} - Масив активностей
 */
export function getActivityHistory() {
  return getItem(STORAGE_KEYS.ACTIVITY_HISTORY, []);
}

/**
 * Зберегти активність
 * @param {Object} activity - { id, type, name, duration, calories, date }
 */
export function saveActivity(activity) {
  const history = getActivityHistory();
  history.unshift(activity);

  // Обмежити історію 100 записами
  if (history.length > 100) history.pop();

  setItem(STORAGE_KEYS.ACTIVITY_HISTORY, history);
}

/**
 * Видалити активність
 * @param {string} activityId - ID активності
 */
export function deleteActivity(activityId) {
  let history = getActivityHistory();
  history = history.filter((a) => a.id !== activityId);
  setItem(STORAGE_KEYS.ACTIVITY_HISTORY, history);
}

// =============================================================
// ТРЕКЕР ВОДИ
// =============================================================

/**
 * Отримати спожиту воду сьогодні (мл)
 * @returns {number} - Мілілітри
 */
export function getWaterToday() {
  return getItem(STORAGE_KEYS.WATER_TODAY, 0);
}

/**
 * Зберегти спожиту воду (мл)
 * @param {number} ml - Мілілітри
 */
export function setWaterToday(ml) {
  setItem(STORAGE_KEYS.WATER_TODAY, ml);
}

/**
 * Скинути трекер води
 */
export function resetWaterToday() {
  setItem(STORAGE_KEYS.WATER_TODAY, 0);
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
