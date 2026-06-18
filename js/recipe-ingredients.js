import { supabase } from './supabaseClient.js';
import {
  parseIngredientsText,
  findProductMatch,
  findAllMatches,
  resolveScannedProduct,
  isDirectUnit,
  learnAlias,
} from './parse-food.js';
import { iconCheck, iconClose, iconScan, iconBarcode } from './icons.js';
import { scanBarcode } from './barcode-scanner.js';
import { escapeHTML } from './utils.js';

let ingredientsList = [];
let onIngredientsChange = null;
let currentLang = 'ua';
let productUnitsCache = [];
let productMeasureCache = [];

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
    notFound: 'Не розпізнано',
    found: 'Розпізнано',
    addIngredients: 'Вставте інгредієнти та натисніть "Розпізнати"',
    clearAll: 'Очистити',
    searchProduct: 'Пошук продукту...',
    productNotFound: 'Продукт не знайдено в базі',
    tapToChoose: 'Натисніть, щоб вибрати продукт',
    checkHint: 'Перевірте, чи правильно розпізналися продукти. Якщо ні — натисніть на інгредієнт і змініть.',
    productFallback: 'Продукт',
    stateRaw: 'сирий',
    stateDry: 'сухий',
    rawHint: 'сире',
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
    notFound: 'Not recognized',
    found: 'Recognized',
    addIngredients: 'Paste ingredients and click "Parse"',
    clearAll: 'Clear',
    searchProduct: 'Search product...',
    productNotFound: 'Product not found in database',
    tapToChoose: 'Tap to choose a product',
    checkHint: 'Check that the products were recognized correctly. If not — tap an ingredient to change it.',
    productFallback: 'Product',
    stateRaw: 'raw',
    stateDry: 'dry',
    rawHint: 'raw',
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
    notFound: 'Nie rozpoznano',
    found: 'Rozpoznano',
    addIngredients: 'Wklej składniki i kliknij "Rozpoznaj"',
    clearAll: 'Wyczyść',
    searchProduct: 'Szukaj produktu...',
    productNotFound: 'Produktu nie znaleziono w bazie',
    tapToChoose: 'Kliknij, aby wybrać produkt',
    checkHint: 'Sprawdź, czy produkty zostały poprawnie rozpoznane. Jeśli nie — kliknij składnik, aby go zmienić.',
    productFallback: 'Produkt',
    stateRaw: 'surowy',
    stateDry: 'suchy',
    rawHint: 'surowe',
  },
};

function t(key) {
  return i18nIngredients[currentLang]?.[key] || i18nIngredients.ua[key] || key;
}

function getProductName(product) {
  if (!product) return '';
  if (currentLang === 'pl' && product.name_pl) return product.name_pl;
  if (currentLang === 'en' && product.name_en) return product.name_en;
  return product.name_ua || product.name_en || product.name_pl || '';
}

function getTextareaEl() {
  return document.getElementById('ingredientTextarea');
}

function getTextareaValue() {
  return getTextareaEl()?.value?.trim() || '';
}

function keepOnlyScannedIngredients() {
  ingredientsList = ingredientsList.filter((ing) => ing.fromBarcode);
}

function getStatusMeta(ingredient) {
  if (!ingredient.matched) return t('tapToChoose');

  const matchedName = getProductName(ingredient);
  const originalQuery = (ingredient.originalQuery || '').trim().toLowerCase();
  const canonicalName = matchedName.trim().toLowerCase();

  if (matchedName && canonicalName && canonicalName !== originalQuery) {
    return `→ ${matchedName}`;
  }

  return t('found');
}

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

      <p class="ingredient-builder__check-hint" id="ingredientCheckHint" hidden>${t('checkHint')}</p>

      <ul class="ingredient-builder__list" id="ingredientList"></ul>

      <div class="ingredient-builder__total" id="ingredientTotal">
        <span class="ingredient-builder__total-label">${t('total')}</span>
        <span class="ingredient-builder__total-values">0 ${t('kcal')}</span>
      </div>
    </div>
  `;

  initEventListeners();
  loadProductsCache();
  renderIngredientsList();
}

let cacheReady = false;
let cachePromise = null;

function loadProductsCache() {
  if (cachePromise) return cachePromise;

  cachePromise = Promise.all([
    supabase.from('product_units').select('product_id, unit_type, size, grams'),
    supabase.from('product_measure_weights').select('product_id, unit_type, grams, state, note'),
  ])
    .then(([units, measures]) => {
      productUnitsCache = units?.data || [];
      productMeasureCache = measures?.data || [];
      cacheReady = true;
    })
    .catch(() => {});

  return cachePromise;
}

function getProductWeight(productId, unitType, size = 'medium') {
  if (!unitType) return null;

  if (unitType === 'шт') {
    const exact = productUnitsCache.find(
      (unit) => unit.product_id === productId && unit.unit_type === 'шт' && unit.size === size,
    );
    if (exact) return exact.grams;

    const medium = productUnitsCache.find(
      (unit) => unit.product_id === productId && unit.unit_type === 'шт' && unit.size === 'medium',
    );
    if (medium) return medium.grams;

    const fallback = productUnitsCache.find(
      (unit) => unit.product_id === productId && unit.unit_type === 'шт',
    );
    return fallback ? fallback.grams : null;
  }

  const measure = productMeasureCache.find(
    (item) => item.product_id === productId && item.unit_type === unitType,
  );
  return measure ? measure.grams : null;
}

function initEventListeners() {
  const parseBtn = document.getElementById('parseIngredientsBtn');
  const clearBtn = document.getElementById('clearIngredientsBtn');
  const scanBtn = document.getElementById('scanIngredientBtn');
  const textarea = getTextareaEl();

  parseBtn?.addEventListener('click', () => {
    parseAndAddIngredients(textarea?.value || '');
  });

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

  textarea?.addEventListener('input', () => {
    const hadParsedTextIngredients = ingredientsList.some((ing) => !ing.fromBarcode);
    if (!hadParsedTextIngredients) return;

    keepOnlyScannedIngredients();
    renderIngredientsList();
    updateTotals();
    notifyChange();
  });

  textarea?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      parseBtn?.click();
    }
  });
}

async function parseAndAddIngredients(text) {
  if (!text.trim()) return;

  const parseBtn = document.getElementById('parseIngredientsBtn');
  const originalText = parseBtn?.textContent;
  if (parseBtn) parseBtn.textContent = t('parsing');

  if (!cacheReady) await loadProductsCache();

  try {
    keepOnlyScannedIngredients();
    const parsed = parseIngredientsText(text);

    for (const item of parsed) {
      const product = await findProductMatch(item.name);

      let grams = item.grams;
      if (product && grams == null && item.amount) {
        const unitWeight = getProductWeight(product.id, item.unitType, 'medium');
        if (unitWeight) grams = Math.round(item.amount * unitWeight);
      }

      const hasWeight = grams != null;
      const factor = hasWeight ? grams / 100 : 0;
      const matched = !!product && hasWeight;

      ingredientsList.push({
        id: product?.id || null,
        name_ua: product?.name_ua || item.name,
        name_en: product?.name_en || null,
        name_pl: product?.name_pl || null,
        original: item.original,
        weight: grams,
        // Не вигадуємо "1 шт", коли парсер не виділив кількість/одиницю
        // (напр. "перець на смак"). null → рендер не покаже фейкову міру.
        parsedAmount: item.amount ?? null,
        parsedUnit: item.unit || null,
        unitType: item.unitType,
        unit: hasWeight ? 'g' : (item.unit || null),
        kcal: matched ? Math.round((product.kcal || 0) * factor) : 0,
        protein: matched ? parseFloat(((product.protein || 0) * factor).toFixed(1)) : 0,
        fat: matched ? parseFloat(((product.fat || 0) * factor).toFixed(1)) : 0,
        carbs: matched ? parseFloat(((product.carbs || 0) * factor).toFixed(1)) : 0,
        fiber: matched ? parseFloat(((product.fiber || 0) * factor).toFixed(1)) : 0,
        matched,
        foodState: product?.food_state || null,
        originalQuery: item.name,
      });
    }

    renderIngredientsList();
    updateTotals();
    notifyChange();
  } catch (error) {
    console.error('Помилка парсингу:', error);
  } finally {
    if (parseBtn) parseBtn.textContent = originalText || t('parseBtn');
  }
}

function addScannedIngredient(product, grams) {
  if (!product || !grams || grams <= 0) return;

  const factor = grams / 100;
  const displayName = getProductName(product) || product.name || product.name_ua || t('productFallback');
  const brandSuffix = product.brand ? ` ${product.brand}` : '';

  ingredientsList.push({
    id: null,
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
  });

  renderIngredientsList();
  updateTotals();
  notifyChange();
}

function removeIngredient(index) {
  ingredientsList.splice(index, 1);
  renderIngredientsList();
  updateTotals();
  notifyChange();
}

function renderIngredientsList() {
  const listEl = document.getElementById('ingredientList');
  if (!listEl) return;

  const hintEl = document.getElementById('ingredientCheckHint');
  if (hintEl) hintEl.hidden = ingredientsList.length === 0;

  if (ingredientsList.length === 0) {
    listEl.innerHTML = `<li class="ingredient-item ingredient-item--empty">${t('addIngredients')}</li>`;
    return;
  }

  listEl.innerHTML = ingredientsList
    .map((ingredient, index) => {
      const name = escapeHTML(ingredient.original || ingredient.originalQuery || ingredient.name_ua || '');
      const statusClass = ingredient.matched ? 'ingredient-item--matched' : 'ingredient-item--unmatched';
      const statusIcon = ingredient.matched ? iconCheck : '?';
      const statusTitle = ingredient.matched ? t('found') : t('notFound');
      const meta = escapeHTML(getStatusMeta(ingredient));

      return `
        <li class="ingredient-item ${statusClass}" data-index="${index}">
          <button type="button" class="ingredient-item__select" data-index="${index}" title="${t('tapToChoose')}">
            <span class="ingredient-item__status" title="${statusTitle}">${statusIcon}</span>
            <span class="ingredient-item__content">
              <span class="ingredient-item__name">${name}</span>
              <span class="ingredient-item__meta">${meta}</span>
            </span>
          </button>
          <button type="button" class="ingredient-item__remove" data-index="${index}">${iconClose}</button>
        </li>
      `;
    })
    .join('');

  listEl.querySelectorAll('.ingredient-item__remove').forEach((button) => {
    button.addEventListener('click', () => {
      removeIngredient(parseInt(button.dataset.index, 10));
    });
  });

  listEl.querySelectorAll('.ingredient-item__select').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const li = event.currentTarget.closest('.ingredient-item');
      const index = parseInt(li?.dataset.index, 10);
      if (Number.isNaN(index)) return;

      const ingredient = ingredientsList[index];
      const query = ingredient.originalQuery || ingredient.name_ua || '';
      if (!query) return;

      document.querySelectorAll('.ingredient-picker').forEach((dropdown) => dropdown.remove());

      const matches = await findAllMatches(query, 8);
      const dropdown = document.createElement('ul');
      dropdown.className = 'ingredient-picker';

      if (!matches.length) {
        dropdown.classList.add('ingredient-picker--empty');
        dropdown.innerHTML = `<li class="ingredient-picker__empty">${t('productNotFound')}</li>`;
        li.appendChild(dropdown);
        setTimeout(() => {
          document.addEventListener('click', function close(ev) {
            if (!dropdown.contains(ev.target)) {
              dropdown.remove();
              document.removeEventListener('click', close);
            }
          });
        }, 0);
        return;
      }

      const stateLabels = { raw: t('stateRaw'), dry: t('stateDry') };

      dropdown.innerHTML = matches.map((product) => {
        const isBarcode = product._source === 'barcode';
        const badge = isBarcode
          ? `<span class="ingredient-picker__barcode-icon">${iconBarcode}</span>`
          : '';
        let label = '';
        if (product.raw_edible === 'sometimes') {
          label = `<em class="ingredient-picker__raw"> (${t('rawHint')})</em>`;
        } else if (!isBarcode && product.food_state && stateLabels[product.food_state]) {
          label = `<em> (${stateLabels[product.food_state]})</em>`;
        }

        const pid = isBarcode ? '0' : product.id;
        const barcodeAttr = isBarcode ? ` data-barcode="${product.barcode}"` : '';

        return `<li data-pid="${pid}"${barcodeAttr}>${badge}${escapeHTML(product.name_ua || product.name_en || '')}${label} — ${product.kcal || 0} ${t('kcal')}/100${t('unitG')}</li>`;
      }).join('');

      li.appendChild(dropdown);

      dropdown.querySelectorAll('li').forEach((item) => {
        item.addEventListener('click', async () => {
          const barcode = item.dataset.barcode;
          let chosen;

          if (barcode) {
            const scanned = matches.find((product) => product._source === 'barcode' && product.barcode === barcode);
            if (!scanned) return;
            const productId = await resolveScannedProduct(scanned);
            if (!productId) return;
            chosen = { ...scanned, id: productId };
          } else {
            const pid = parseInt(item.dataset.pid, 10);
            chosen = matches.find((product) => product.id === pid);
          }

          if (!chosen) return;

          const current = ingredientsList[index];
          learnAlias(current.originalQuery || query, chosen.id);

          let grams = current.weight;
          const directWeight = isDirectUnit(current.parsedUnit);
          if (!directWeight && current.unitType) {
            const unitWeight = getProductWeight(chosen.id, current.unitType, 'medium');
            grams = unitWeight != null ? Math.round((current.parsedAmount || 1) * unitWeight) : null;
          }

          const hasWeight = grams != null;
          const factor = hasWeight ? grams / 100 : 0;

          ingredientsList[index] = {
            ...current,
            id: chosen.id,
            name_ua: chosen.name_ua,
            name_en: chosen.name_en,
            name_pl: chosen.name_pl,
            foodState: chosen.food_state,
            weight: grams,
            kcal: hasWeight ? Math.round((chosen.kcal || 0) * factor) : 0,
            protein: hasWeight ? parseFloat(((chosen.protein || 0) * factor).toFixed(1)) : 0,
            fat: hasWeight ? parseFloat(((chosen.fat || 0) * factor).toFixed(1)) : 0,
            carbs: hasWeight ? parseFloat(((chosen.carbs || 0) * factor).toFixed(1)) : 0,
            fiber: hasWeight ? parseFloat(((chosen.fiber || 0) * factor).toFixed(1)) : 0,
            matched: hasWeight,
          };

          dropdown.remove();
          renderIngredientsList();
          updateTotals();
          notifyChange();
        });
      });

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

function updateTotals() {
  const totalEl = document.getElementById('ingredientTotal');
  if (!totalEl) return;

  const totals = ingredientsList.reduce(
    (acc, ingredient) => {
      acc.kcal += ingredient.kcal || 0;
      acc.protein += ingredient.protein || 0;
      acc.fat += ingredient.fat || 0;
      acc.carbs += ingredient.carbs || 0;
      acc.fiber += ingredient.fiber || 0;
      return acc;
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
  );

  const valuesEl = totalEl.querySelector('.ingredient-builder__total-values');
  if (valuesEl) {
    valuesEl.textContent = `${totals.kcal} ${t('kcal')}`;
  }
}

function notifyChange() {
  if (typeof onIngredientsChange !== 'function') return;
  onIngredientsChange(ingredientsList, getTotals());
}

export function getIngredients() {
  return ingredientsList;
}

export function getIngredientsText() {
  if (ingredientsList.length === 0) {
    return getTextareaValue();
  }

  return ingredientsList
    .map((ingredient) => {
      if (ingredient.fromBarcode) {
        const brand = ingredient.brand ? ` ${ingredient.brand}` : '';
        const name = getProductName(ingredient) || ingredient.name_ua || '';
        return `${name}${brand} — ${ingredient.weight} ${t('unitG')}`;
      }

      if (ingredient.original) return ingredient.original;

      const name = getProductName(ingredient) || ingredient.name_ua || '';
      return ingredient.weight ? `${name} — ${ingredient.weight} ${t('unitG')}` : name;
    })
    .filter(Boolean)
    .join('\n');
}

export function getTotals() {
  return ingredientsList.reduce(
    (acc, ingredient) => {
      acc.kcal += ingredient.kcal || 0;
      acc.protein += ingredient.protein || 0;
      acc.fat += ingredient.fat || 0;
      acc.carbs += ingredient.carbs || 0;
      acc.fiber += ingredient.fiber || 0;
      return acc;
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
  );
}

export function clearIngredients() {
  ingredientsList = [];
  const textarea = getTextareaEl();
  if (textarea) textarea.value = '';
  renderIngredientsList();
  updateTotals();
}

export async function setIngredientsFromText(text) {
  const normalizedText = String(text || '').trim();

  ingredientsList = [];

  const textarea = getTextareaEl();
  if (textarea) textarea.value = normalizedText;

  if (!normalizedText) {
    renderIngredientsList();
    updateTotals();
    notifyChange();
    return;
  }

  await parseAndAddIngredients(normalizedText);
}

export function setLanguage(lang) {
  currentLang = lang;

  const textarea = getTextareaEl();
  if (textarea) textarea.placeholder = t('pasteIngredients');

  const parseBtn = document.getElementById('parseIngredientsBtn');
  if (parseBtn) parseBtn.textContent = t('parseBtn');

  const scanBtn = document.getElementById('scanIngredientBtn');
  if (scanBtn) scanBtn.innerHTML = `${iconScan} ${t('scanBtn')}`;

  const clearBtn = document.getElementById('clearIngredientsBtn');
  if (clearBtn) clearBtn.textContent = t('clearAll');

  const hintEl = document.getElementById('ingredientCheckHint');
  if (hintEl) hintEl.textContent = t('checkHint');

  const totalLabel = document.querySelector('.ingredient-builder__total-label');
  if (totalLabel) totalLabel.textContent = t('total');

  renderIngredientsList();
  updateTotals();
}
