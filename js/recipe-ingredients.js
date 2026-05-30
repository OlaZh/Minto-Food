/**
 * Recipe Ingredients Module
 * Конструктор інгредієнтів з автопарсингом та підрахунком КБЖУ
 */

import { supabase } from './supabaseClient.js';
import { parseIngredientsText, findProductMatch, findAllMatches, resolveScannedProduct } from './parse-food.js';
import { iconCheck, iconClose, iconScan, iconBarcode } from './icons.js';
import { scanBarcode } from './barcode-scanner.js';

let ingredientsList = [];
let onIngredientsChange = null;
let currentLang = 'ua';
let productUnitsCache = [];

// ==================== ЛОКАЛІЗАЦІЯ ====================

const i18nIngredients = {
  ua: {
    pasteIngredients: 'Вставте список інгредієнтів...',
    parseBtn: 'Розпізнати',
    parsing: 'Розпізнаю...',
    scanBtn: 'Сканувати',
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
    scanBtn: 'Scan',
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
    scanBtn: 'Skanuj',
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
          <button type="button" class="ingredient-builder__scan-btn" id="scanIngredientBtn">
            ${iconScan} ${t('scanBtn')}
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

  initEventListeners();

  // Завантажуємо кеш одиниць в фоні (не блокуємо рендер)
  loadProductsCache();
  renderIngredientsList();
}

// ==================== ЗАВАНТАЖЕННЯ КЕШУ ====================

let cacheReady = false;
let cachePromise = null;

function loadProductsCache() {
  if (cachePromise) return cachePromise;
  cachePromise = supabase
    .from('product_units')
    .select('product_id, unit_type, size, grams')
    .then(({ data }) => {
      productUnitsCache = data || [];
      cacheReady = true;
    })
    .catch(() => {});
  return cachePromise;
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
  const scanBtn = document.getElementById('scanIngredientBtn');
  const textarea = document.getElementById('ingredientTextarea');

  parseBtn?.addEventListener('click', () => {
    parseAndAddIngredients(textarea?.value || '');
  });

  // Сканування штрихкоду → вага → інгредієнт із бренд-специфічними КБЖУ
  scanBtn?.addEventListener('click', () => {
    scanBarcode(addScannedIngredient, { askWeight: true });
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

  // Чекаємо завантаження кешу одиниць (шт→г)
  if (!cacheReady) await loadProductsCache();

  try {
    // Парсимо текст
    const parsed = parseIngredientsText(text);

    // Для кожного розпізнаного інгредієнта шукаємо в базі
    for (const item of parsed) {
      const product = await findProductMatch(item.name);

      let grams = item.grams;

      // Якщо знайшли продукт і є кількість але немає грамів — беремо з product_units.
      // Розмір не вказано в рецепті → завжди беремо 'medium'
      if (product && item.amount && !grams) {
        const unitWeight = getProductWeight(product.id, 'medium');
        if (unitWeight) {
          grams = Math.round(item.amount * unitWeight);
        }
      }

      // Для вагових одиниць без ваги — дефолт 100г
      // Для штучних (шт, pcs, piece) — НЕ підставляємо вагу, показуємо "N шт"
      const PIECE_UNIT_LIST = ['шт', 'шт.', 'штука', 'штуки', 'штук', 'pcs', 'piece', 'pieces'];
      const isPieceUnit = item.unit && PIECE_UNIT_LIST.includes(item.unit.toLowerCase());
      if (!grams && !isPieceUnit) grams = 100;

      const factor = grams ? grams / 100 : 0;

      const ingredient = {
        id: product?.id || null,
        name_ua: product?.name_ua || item.name,
        name_en: product?.name_en || null,
        name_pl: product?.name_pl || null,
        original: item.original,
        weight: grams,
        parsedAmount: item.amount || 1,
        parsedUnit: item.unit || 'шт',
        unit: grams ? 'g' : 'шт',
        kcal: product ? Math.round((product.kcal || 0) * factor) : 0,
        protein: product ? parseFloat(((product.protein || 0) * factor).toFixed(1)) : 0,
        fat: product ? parseFloat(((product.fat || 0) * factor).toFixed(1)) : 0,
        carbs: product ? parseFloat(((product.carbs || 0) * factor).toFixed(1)) : 0,
        fiber: product ? parseFloat(((product.fiber || 0) * factor).toFixed(1)) : 0,
        matched: !!product,
        foodState: product?.food_state || null,
        originalQuery: item.name,
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

// ==================== ДОДАВАННЯ ВІДСКАНОВАНОГО ІНГРЕДІЄНТА ====================

// product — об'єкт зі сканера (КБЖУ на 100 г), grams — введена вага
function addScannedIngredient(product, grams) {
  if (!product || !grams || grams <= 0) return;

  const factor = grams / 100;
  const displayName = getProductName(product) || product.name || product.name_ua || 'Продукт';
  const brandSuffix = product.brand ? ` ${product.brand}` : '';

  const ingredient = {
    id: null, // не з таблиці products → не пишемо в product_recipe, лише текст + КБЖУ
    name_ua: product.name_ua || displayName,
    name_en: product.name_en || null,
    name_pl: product.name_pl || null,
    original: `${displayName}${brandSuffix} — ${grams} ${t('unitG')}`,
    weight: grams,
    parsedAmount: grams,
    parsedUnit: t('unitG'),
    unit: 'g',
    kcal: Math.round((product.kcal || 0) * factor),
    protein: parseFloat(((product.protein || 0) * factor).toFixed(1)),
    fat: parseFloat(((product.fat || 0) * factor).toFixed(1)),
    carbs: parseFloat(((product.carbs || 0) * factor).toFixed(1)),
    fiber: parseFloat(((product.fiber || 0) * factor).toFixed(1)),
    matched: true,
    fromBarcode: true,
    barcode: product.barcode || null,
    brand: product.brand || null,
    originalQuery: displayName,
  };

  ingredientsList.push(ingredient);
  renderIngredientsList();
  updateTotals();
  notifyChange();
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
      const statusIcon = ing.matched ? iconCheck : '?';
      const statusTitle = ing.matched ? t('found') : t('notFound');

      const STATE_LABELS = { raw: 'сирий', dry: 'сухий' };
      const stateLabel = ing.foodState ? (STATE_LABELS[ing.foodState] ?? null) : null;
      const stateHtml = stateLabel
        ? `<em class="ingredient-item__state">${stateLabel}</em>`
        : '';

      const weightDisplay = ing.weight
        ? `${ing.weight} ${t('unitG')}`
        : `${ing.parsedAmount} ${ing.parsedUnit}`;

      return `
      <li class="ingredient-item ${statusClass}" data-index="${index}">
        <span class="ingredient-item__status" title="${statusTitle}">${statusIcon}</span>
        <span class="ingredient-item__name" title="Натисніть щоб змінити">
          ${name}${stateHtml}
        </span>
        <span class="ingredient-item__weight">${weightDisplay}</span>
        <span class="ingredient-item__kcal">${ing.kcal} ${t('kcal')}</span>
        <button type="button" class="ingredient-item__remove" data-index="${index}">${iconClose}</button>
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

  // Клік по назві → дропдаун вибору продукту
  listEl.querySelectorAll('.ingredient-item__name').forEach((nameEl) => {
    nameEl.style.cursor = 'pointer';
    nameEl.addEventListener('click', async (e) => {
      const li = e.target.closest('.ingredient-item');
      const index = parseInt(li?.dataset.index);
      if (isNaN(index)) return;

      const ing = ingredientsList[index];
      const query = ing.originalQuery || ing.name_ua || '';
      if (!query) return;

      // Закриваємо попередній дропдаун
      document.querySelectorAll('.ingredient-picker').forEach((d) => d.remove());

      const matches = await findAllMatches(query, 8);
      if (!matches.length) return;

      const STATE_LABELS = { raw: 'сирий', dry: 'сухий' };

      const dropdown = document.createElement('ul');
      dropdown.className = 'ingredient-picker';
      dropdown.innerHTML = matches.map((p) => {
        const isBarcode = p._source === 'barcode';
        const badge = isBarcode
          ? `<span class="ingredient-picker__barcode-icon">${iconBarcode}</span>`
          : '';
        let label = '';
        if (p.raw_edible === 'sometimes') {
          label = '<em class="ingredient-picker__raw"> (сире)</em>';
        } else if (!isBarcode && p.food_state && STATE_LABELS[p.food_state]) {
          label = `<em> (${STATE_LABELS[p.food_state]})</em>`;
        }
        const pid = isBarcode ? '0' : p.id;
        const barcodeAttr = isBarcode ? ` data-barcode="${p.barcode}"` : '';
        return `<li data-pid="${pid}" data-name="${escapeHTML(p.name_ua || '')}"${barcodeAttr}>${badge}${escapeHTML(p.name_ua || p.name_en || '')}${label} — ${p.kcal || 0} ккал/100г</li>`;
      }).join('');

      li.style.position = 'relative';
      li.appendChild(dropdown);

      dropdown.querySelectorAll('li').forEach((item) => {
        item.addEventListener('click', async () => {
          const barcode = item.dataset.barcode;
          let chosen;

          if (barcode) {
            const scanned = matches.find((p) => p._source === 'barcode' && p.barcode === barcode);
            if (!scanned) return;
            const productId = await resolveScannedProduct(scanned);
            if (!productId) return;
            chosen = { ...scanned, id: productId };
          } else {
            const pid = parseInt(item.dataset.pid);
            chosen = matches.find((p) => p.id === pid);
          }

          if (!chosen) return;

          const grams = ingredientsList[index].weight;
          const factor = grams ? grams / 100 : 0;
          ingredientsList[index] = {
            ...ingredientsList[index],
            id: chosen.id,
            name_ua: chosen.name_ua,
            name_en: chosen.name_en,
            name_pl: chosen.name_pl,
            foodState: chosen.food_state,
            kcal:    Math.round((chosen.kcal    || 0) * factor),
            protein: parseFloat(((chosen.protein || 0) * factor).toFixed(1)),
            fat:     parseFloat(((chosen.fat     || 0) * factor).toFixed(1)),
            carbs:   parseFloat(((chosen.carbs   || 0) * factor).toFixed(1)),
            matched: true,
          };

          dropdown.remove();
          renderIngredientsList();
          updateTotals();
          notifyChange();
        });
      });

      // Закрити при кліку поза
      setTimeout(() => {
        document.addEventListener('click', function close(ev) {
          if (!dropdown.contains(ev.target)) {
            dropdown.remove();
            document.removeEventListener('click', close);
          }
        });
      }, 10);
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
      acc.fiber += ing.fiber || 0;
      return acc;
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
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

// Текстовий список інгредієнтів для збереження в recipes.ingredients
// (зберігає оригінальні рядки, відскановані бренд-продукти — окремими рядками)
export function getIngredientsText() {
  return ingredientsList
    .map((ing) => {
      if (ing.fromBarcode) {
        const brand = ing.brand ? ` ${ing.brand}` : '';
        const name = getProductName(ing) || ing.name_ua || '';
        return `${name}${brand} — ${ing.weight} ${t('unitG')}`;
      }
      if (ing.original) return ing.original;
      const name = getProductName(ing) || ing.name_ua || '';
      return ing.weight ? `${name} — ${ing.weight} ${t('unitG')}` : name;
    })
    .filter(Boolean)
    .join('\n');
}

export function getTotals() {
  return ingredientsList.reduce(
    (acc, ing) => {
      acc.kcal += ing.kcal || 0;
      acc.protein += ing.protein || 0;
      acc.fat += ing.fat || 0;
      acc.carbs += ing.carbs || 0;
      acc.fiber += ing.fiber || 0;
      return acc;
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
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

    const scanBtn = document.getElementById('scanIngredientBtn');
    if (scanBtn) scanBtn.innerHTML = `${iconScan} ${t('scanBtn')}`;

    const clearBtn = document.getElementById('clearIngredientsBtn');
    if (clearBtn) clearBtn.textContent = t('clearAll');

    const totalLabel = document.querySelector('.ingredient-builder__total-label');
    if (totalLabel) totalLabel.textContent = t('total');

    renderIngredientsList();
    updateTotals();
  }
}
