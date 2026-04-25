/**
 * Recipe Ingredients Module
 * Конструктор інгредієнтів з автопарсингом та підрахунком КБЖУ
 */

import { supabase } from './supabaseClient.js';
import { parseIngredientsText, findProductMatch } from './parse-food.js';

let ingredientsList = [];
let onIngredientsChange = null;
let currentLang = 'ua';
let productsCache = [];
let productUnitsCache = [];

// ==================== ЛОКАЛІЗАЦІЯ ====================

const i18nIngredients = {
  ua: {
    pasteIngredients: 'Вставте список інгредієнтів...',
    parseBtn: 'Розпізнати',
    parsing: 'Розпізнаю...',
    unitG: 'г',
    kcal: 'ккал',
    total: 'Разом:',
    proteinShort: 'Б',
    fatShort: 'Ж',
    carbsShort: 'В',
    notFound: 'не знайдено',
    found: 'знайдено',
    addIngredients: 'Вставте інгредієнти та натисніть "Розпізнати"',
    clearAll: 'Очистити',
    manualAdd: 'Додати вручну',
    searchProduct: 'Пошук продукту...',
    productNotFound: 'Продукт не знайдено в базі',
  },
  en: {
    pasteIngredients: 'Paste ingredient list...',
    parseBtn: 'Parse',
    parsing: 'Parsing...',
    unitG: 'g',
    kcal: 'kcal',
    total: 'Total:',
    proteinShort: 'P',
    fatShort: 'F',
    carbsShort: 'C',
    notFound: 'not found',
    found: 'found',
    addIngredients: 'Paste ingredients and click "Parse"',
    clearAll: 'Clear',
    manualAdd: 'Add manually',
    searchProduct: 'Search product...',
    productNotFound: 'Product not found in database',
  },
  pl: {
    pasteIngredients: 'Wklej listę składników...',
    parseBtn: 'Rozpoznaj',
    parsing: 'Rozpoznaję...',
    unitG: 'g',
    kcal: 'kcal',
    total: 'Razem:',
    proteinShort: 'B',
    fatShort: 'T',
    carbsShort: 'W',
    notFound: 'nie znaleziono',
    found: 'znaleziono',
    addIngredients: 'Wklej składniki i kliknij "Rozpoznaj"',
    clearAll: 'Wyczyść',
    manualAdd: 'Dodaj ręcznie',
    searchProduct: 'Szukaj produktu...',
    productNotFound: 'Produktu nie znaleziono w bazie',
  },
};

function t(key) {
  return i18nIngredients[currentLang]?.[key] || i18nIngredients['ua'][key] || key;
}

function getProductName(product) {
  if (!product) return '';
  if (currentLang === 'pl' && product.name_pl) return product.name_pl;
  if (currentLang === 'en' && product.name_en) return product.name_en;
  return product.name_ua || product.name_en || product.name_pl || '';
}

// ==================== ІНІЦІАЛІЗАЦІЯ ====================

export function initIngredientBuilder(containerSelector, onChange, lang = 'ua') {
  currentLang = lang;
  onIngredientsChange = onChange;
  ingredientsList = [];

  const container = document.querySelector(containerSelector);
  if (!container) return;

  container.innerHTML = `
    <div class="ingredient-builder">
      <div class="ingredient-builder__paste-area">
        <textarea 
          class="ingredient-builder__textarea" 
          id="ingredientTextarea" 
          placeholder="${t('pasteIngredients')}"
          rows="5"
        ></textarea>
        <div class="ingredient-builder__actions">
          <button type="button" class="ingredient-builder__parse-btn" id="parseIngredientsBtn">
            ${t('parseBtn')}
          </button>
          <button type="button" class="ingredient-builder__clear-btn" id="clearIngredientsBtn">
            ${t('clearAll')}
          </button>
        </div>
      </div>
      
      <ul class="ingredient-builder__list" id="ingredientList"></ul>
      
      <div class="ingredient-builder__total" id="ingredientTotal">
        <span class="ingredient-builder__total-label">${t('total')}</span>
        <span class="ingredient-builder__total-values">0 ${t('kcal')} · ${t('proteinShort')}0 · ${t('fatShort')}0 · ${t('carbsShort')}0</span>
      </div>
    </div>
  `;

  // Завантажуємо кеш продуктів
  loadProductsCache();

  initEventListeners();
  renderIngredientsList();
}

// ==================== ЗАВАНТАЖЕННЯ КЕШУ ====================

async function loadProductsCache() {
  try {
    // Завантажуємо всі продукти
    const { data: products } = await supabase
      .from('products')
      .select('id, name_ua, name_en, name_pl, kcal, protein, fat, carbs');

    productsCache = products || [];

    // Завантажуємо одиниці вимірювання
    const { data: units } = await supabase
      .from('product_units')
      .select('product_id, unit_type, size, grams');

    productUnitsCache = units || [];
  } catch (error) {
    console.error('Помилка завантаження кешу:', error);
  }
}

// ==================== ОТРИМАННЯ ВАГИ ПРОДУКТУ ====================

function getProductWeight(productId, size = 'medium') {
  // Шукаємо в product_units
  const unit = productUnitsCache.find((u) => u.product_id === productId && u.size === size);

  if (unit) return unit.grams;

  // Якщо немає потрібного розміру — беремо medium або перший доступний
  const mediumUnit = productUnitsCache.find(
    (u) => u.product_id === productId && u.size === 'medium',
  );
  if (mediumUnit) return mediumUnit.grams;

  const anyUnit = productUnitsCache.find((u) => u.product_id === productId);
  if (anyUnit) return anyUnit.grams;

  return null;
}

// ==================== ПОДІЇ ====================

function initEventListeners() {
  const parseBtn = document.getElementById('parseIngredientsBtn');
  const clearBtn = document.getElementById('clearIngredientsBtn');
  const textarea = document.getElementById('ingredientTextarea');

  parseBtn?.addEventListener('click', () => {
    parseAndAddIngredients(textarea?.value || '');
  });

  clearBtn?.addEventListener('click', () => {
    ingredientsList = [];
    if (textarea) textarea.value = '';
    renderIngredientsList();
    updateTotals();
    notifyChange();
  });

  // Ctrl+Enter для швидкого парсингу
  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      parseBtn?.click();
    }
  });
}

// ==================== ПАРСИНГ ІНГРЕДІЄНТІВ ====================

async function parseAndAddIngredients(text) {
  if (!text.trim()) return;

  const parseBtn = document.getElementById('parseIngredientsBtn');
  const originalText = parseBtn?.textContent;
  if (parseBtn) parseBtn.textContent = t('parsing');

  try {
    // Парсимо текст
    const parsed = parseIngredientsText(text);

    // Для кожного розпізнаного інгредієнта шукаємо в базі
    for (const item of parsed) {
      const product = findProductMatch(item.name, productsCache);

      let grams = item.grams;

      // Якщо знайшли продукт і є кількість але немає грамів — беремо з product_units
      if (product && item.amount && !grams) {
        const unitWeight = getProductWeight(product.id);
        if (unitWeight) {
          grams = Math.round(item.amount * unitWeight);
        }
      }

      // Якщо все ще немає грамів — ставимо 100 за замовчуванням
      if (!grams) grams = 100;

      const factor = grams / 100;

      const ingredient = {
        id: product?.id || null,
        name_ua: product?.name_ua || item.name,
        name_en: product?.name_en || null,
        name_pl: product?.name_pl || null,
        original: item.original,
        weight: grams,
        unit: 'g',
        kcal: product ? Math.round((product.kcal || 0) * factor) : 0,
        protein: product ? parseFloat(((product.protein || 0) * factor).toFixed(1)) : 0,
        fat: product ? parseFloat(((product.fat || 0) * factor).toFixed(1)) : 0,
        carbs: product ? parseFloat(((product.carbs || 0) * factor).toFixed(1)) : 0,
        matched: !!product,
      };

      ingredientsList.push(ingredient);
    }

    renderIngredientsList();
    updateTotals();
    notifyChange();

    // Очищаємо textarea після успішного парсингу
    const textarea = document.getElementById('ingredientTextarea');
    if (textarea) textarea.value = '';
  } catch (error) {
    console.error('Помилка парсингу:', error);
  } finally {
    if (parseBtn) parseBtn.textContent = originalText || t('parseBtn');
  }
}

// ==================== ВИДАЛЕННЯ ІНГРЕДІЄНТА ====================

function removeIngredient(index) {
  ingredientsList.splice(index, 1);
  renderIngredientsList();
  updateTotals();
  notifyChange();
}

// ==================== РЕНДЕР СПИСКУ ====================

function renderIngredientsList() {
  const listEl = document.getElementById('ingredientList');
  if (!listEl) return;

  if (ingredientsList.length === 0) {
    listEl.innerHTML = `<li class="ingredient-item ingredient-item--empty">${t('addIngredients')}</li>`;
    return;
  }

  listEl.innerHTML = ingredientsList
    .map((ing, index) => {
      const name = getProductName(ing) || ing.original || ing.name_ua;
      const statusClass = ing.matched ? 'ingredient-item--matched' : 'ingredient-item--unmatched';
      const statusIcon = ing.matched ? '✓' : '?';
      const statusTitle = ing.matched ? t('found') : t('notFound');

      return `
      <li class="ingredient-item ${statusClass}">
        <span class="ingredient-item__status" title="${statusTitle}">${statusIcon}</span>
        <span class="ingredient-item__name" title="${ing.original || name}">${name}</span>
        <span class="ingredient-item__weight">${ing.weight} ${t('unitG')}</span>
        <span class="ingredient-item__kcal">${ing.kcal} ${t('kcal')}</span>
        <button type="button" class="ingredient-item__remove" data-index="${index}">✕</button>
      </li>
    `;
    })
    .join('');

  // Видалення
  listEl.querySelectorAll('.ingredient-item__remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      removeIngredient(parseInt(btn.dataset.index));
    });
  });
}

// ==================== ПІДРАХУНОК КБЖУ ====================

function updateTotals() {
  const totalEl = document.getElementById('ingredientTotal');
  if (!totalEl) return;

  const totals = ingredientsList.reduce(
    (acc, ing) => {
      acc.kcal += ing.kcal || 0;
      acc.protein += ing.protein || 0;
      acc.fat += ing.fat || 0;
      acc.carbs += ing.carbs || 0;
      return acc;
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );

  const valuesEl = totalEl.querySelector('.ingredient-builder__total-values');
  if (valuesEl) {
    valuesEl.textContent = `${totals.kcal} ${t('kcal')} · ${t('proteinShort')}${totals.protein.toFixed(1)} · ${t('fatShort')}${totals.fat.toFixed(1)} · ${t('carbsShort')}${totals.carbs.toFixed(1)}`;
  }
}

function notifyChange() {
  if (onIngredientsChange && typeof onIngredientsChange === 'function') {
    const totals = getTotals();
    onIngredientsChange(ingredientsList, totals);
  }
}

// ==================== ЕКСПОРТ ДАНИХ ====================

export function getIngredients() {
  return ingredientsList;
}

export function getTotals() {
  return ingredientsList.reduce(
    (acc, ing) => {
      acc.kcal += ing.kcal || 0;
      acc.protein += ing.protein || 0;
      acc.fat += ing.fat || 0;
      acc.carbs += ing.carbs || 0;
      return acc;
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

export function clearIngredients() {
  ingredientsList = [];
  const textarea = document.getElementById('ingredientTextarea');
  if (textarea) textarea.value = '';
  renderIngredientsList();
  updateTotals();
}

export function setIngredients(ingredients) {
  ingredientsList = ingredients || [];
  renderIngredientsList();
  updateTotals();
}

export function setLanguage(lang) {
  currentLang = lang;
  // Перемальовуємо UI
  const container = document.querySelector('.ingredient-builder');
  if (container) {
    const textarea = document.getElementById('ingredientTextarea');
    if (textarea) textarea.placeholder = t('pasteIngredients');

    const parseBtn = document.getElementById('parseIngredientsBtn');
    if (parseBtn) parseBtn.textContent = t('parseBtn');

    const clearBtn = document.getElementById('clearIngredientsBtn');
    if (clearBtn) clearBtn.textContent = t('clearAll');

    const totalLabel = document.querySelector('.ingredient-builder__total-label');
    if (totalLabel) totalLabel.textContent = t('total');

    renderIngredientsList();
    updateTotals();
  }
}
