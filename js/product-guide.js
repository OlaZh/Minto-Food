/* ============================================================
   product-guide.js
   ============================================================ */

import { supabase } from './supabaseClient.js';
import { initAuth } from './auth.js';
import { escapeHTML } from './utils.js';
import { getLang } from './storage.js';

let products = [];
let currentLang = 'ua';

/* ============================================================
   МОВА
   ============================================================ */

function txt(row, field) {
  if (!row) return '';
  if (currentLang === 'en' && row[`${field}_en`]) return row[`${field}_en`];
  if (currentLang === 'pl' && row[`${field}_pl`]) return row[`${field}_pl`];
  return row[field] || '';
}

function nameForLang(row) {
  if (!row) return '';
  if (currentLang === 'en' && row.name_en) return row.name_en;
  if (currentLang === 'pl' && row.name_pl) return row.name_pl;
  return row.name_ua || '';
}

/* ============================================================
   ДОПОМІЖНІ ФУНКЦІЇ
   ============================================================ */

function normalizeIdArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === 'string' && value.startsWith('{')) {
    return value.replace('{', '').replace('}', '').split(',').map(Number).filter((n) => !isNaN(n));
  }
  return [];
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.replace('{', '').replace('}', '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/* ============================================================
   DOM
   ============================================================ */

const productList    = document.querySelector('#productList');
const modal          = document.querySelector('[data-modal="product"]');
const searchInput    = document.querySelector('.product-search__input');
const searchContainer= document.querySelector('.product-search');
const filterBtns     = document.querySelectorAll('.product-filters__item');
const subGroups      = document.querySelectorAll('.subfilter-group');

/* ============================================================
   ЗАВАНТАЖЕННЯ ПРОДУКТІВ
   ============================================================ */

function showProductSkeletons(count = 12) {
  if (!productList) return;
  productList.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-card__image"></div>
      <div class="skeleton-card__content">
        <div class="skeleton-card__title"></div>
        <div class="skeleton-card__subtitle"></div>
        <div class="skeleton-card__footer">
          <div class="skeleton-card__badge"></div>
          <div class="skeleton-card__btn"></div>
        </div>
      </div>
    </div>
  `).join('');
}

async function loadProducts() {
  showProductSkeletons();
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name_ua', { ascending: true });

    if (error) throw error;

    products = data || [];
    renderProducts(products);
  } catch (err) {
    console.error('Помилка Supabase:', err.message);
    if (productList) productList.innerHTML = `
      <div class="no-results">⚠️ Помилка завантаження — перевірте з'єднання</div>`;
  }
}

/* ============================================================
   РЕНДЕР КАРТОК
   ============================================================ */

function renderProducts(items) {
  if (!productList) return;

  productList.innerHTML = '';

  if (!items || items.length === 0) {
    productList.innerHTML = `
      <div class="no-results">
        <div class="no-results__icon">🌿</div>
        <p class="no-results__title">Продуктів не знайдено</p>
        <p class="no-results__text">Спробуйте змінити фільтри або пошуковий запит</p>
      </div>`;
    return;
  }

  items.forEach((product) => {
    const card = document.createElement('div');
    card.className = 'product-card content-fade-in';

    const imgSrc =
      typeof product.image === 'string' && product.image.trim() !== '' && product.image !== 'NULL'
        ? product.image
        : 'img/placeholder.jpg';

    card.innerHTML = `
      <div class="product-card__image-box">
        <img src="${imgSrc}"
             alt="${escapeHTML(product.name_ua)}"
             class="product-card__img"
             loading="lazy"
             onerror="this.src='img/placeholder.jpg'">
      </div>
      <div class="product-card__content">
        <h3 class="product-card__name">${escapeHTML(product.name_ua) || 'Без назви'}</h3>
        <p class="product-card__desc">${escapeHTML(product.short_desc) || ''}</p>
        <div class="product-card__footer">
          <span class="product-card__kcal">${product.kcal || 0} ккал</span>
          <button class="product-card__btn">Детальніше</button>
        </div>
      </div>`;

    card.addEventListener('click', () => openProductModal(product));
    productList.appendChild(card);
  });
}

/* ============================================================
   ФІЛЬТРАЦІЯ
   ============================================================ */

const checkCondition = (product, filterValue) => {
  if (!product || !filterValue) return false;

  const val = filterValue.toLowerCase().trim();
  const p = product;

  if (val.includes('високобілкові'))  return (Number(p.protein) || 0) >= 15;
  if (val.includes('низьковуглеводні'))return (Number(p.carbs)   || 0) <= 10;
  if (val.includes('високовуглеводні'))return (Number(p.carbs)   || 0) >= 40;
  if (val.includes('низькокалорійні')) return (Number(p.kcal)    || 0) <= 100;
  if (val.includes('висококалорійні')) return (Number(p.kcal)    || 0) >= 400;
  if (val.includes('низькожирні'))     return (Number(p.fat)     || 0) <= 3;

  const giVal = parseInt(p.gi) || 0;
  if (val === 'низький гі')  return giVal > 0  && giVal <= 55;
  if (val === 'середній гі') return giVal > 55 && giVal <= 69;
  if (val === 'високий гі')  return giVal >= 70;

  const searchFields = [p.name_ua, p.category, p.tags, p.purpose, p.time_of_day, p.alt_names];
  return searchFields.some((field) => field && String(field).toLowerCase().includes(val));
};

const applyFilters = () => {
  const searchText = (searchInput.value || '').toLowerCase().trim();
  const activeChips = [...document.querySelectorAll('.search-chip')].map((c) => c.dataset.value);

  const filtered = products.filter((p) => {
    const nameStr = String(p.name_ua    || '').toLowerCase();
    const altStr  = String(p.alt_names  || '').toLowerCase();
    const descStr = String(p.short_desc || '').toLowerCase();

    const matchesSearch =
      !searchText ||
      nameStr.includes(searchText) ||
      altStr.includes(searchText) ||
      descStr.includes(searchText);

    const matchesChips = activeChips.every((chip) => checkCondition(p, chip));

    return matchesSearch && matchesChips;
  });

  renderProducts(filtered);
};

/* ============================================================
   ПОДІЇ ФІЛЬТРІВ
   ============================================================ */

const addNewChip = (label) => {
  if (document.querySelector(`.search-chip[data-value="${label}"]`)) return;

  const chip = document.createElement('span');
  chip.className = 'search-chip';
  chip.dataset.value = label;
  chip.innerHTML = `${label}<button class="chip-remove">✕</button>`;

  chip.querySelector('.chip-remove').onclick = () => {
    chip.remove();
    applyFilters();
  };

  searchContainer.insertBefore(chip, searchInput);
  applyFilters();
};

filterBtns.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const target = btn.dataset.filter;
    const group  = document.querySelector(`.subfilter-group[data-subfilter="${target}"]`);
    const isAlreadyOpen = group?.classList.contains('active');

    subGroups.forEach((g) => g.classList.remove('active'));
    filterBtns.forEach((b) => b.classList.remove('is-active'));

    if (group && !isAlreadyOpen) {
      group.classList.add('active');
      btn.classList.add('is-active');
    }
  });
});

subGroups.forEach((group) => {
  group.addEventListener('click', (e) => {
    const item = e.target.closest('.subfilter-item');
    if (!item) return;
    addNewChip(item.textContent.trim());
    group.classList.remove('active');
    filterBtns.forEach((b) => b.classList.remove('is-active'));
  });
});

if (searchInput) {
  searchInput.addEventListener('input', applyFilters);
}

/* ============================================================
   МОДАЛКА — ХЕЛПЕРИ РЕНДЕРУ
   ============================================================ */

function getAccordionList(i18nKey, nth = 0) {
  const accordions = modal ? [...modal.querySelectorAll('.accordion')] : [];
  const accordion  = accordions.find((a) => a.querySelector(`[data-i18n="${i18nKey}"]`));
  if (!accordion) return null;
  return accordion.querySelectorAll('.accordion__list')[nth] || null;
}

function setLoadingState() {
  if (!modal) return;
  modal.querySelectorAll('.accordion__list').forEach((list) => {
    list.innerHTML = '<li class="loading-placeholder">Завантаження...</li>';
  });
  const subs = modal.querySelector('.substitutes-container');
  if (subs) subs.innerHTML = '<span class="loading-placeholder">Завантаження...</span>';
  const sim = modal.querySelector('.similar-products-container');
  if (sim) sim.innerHTML = '<span class="loading-placeholder">Завантаження...</span>';
}

// Простий список: name — text
function renderSimpleList(i18nKey, rows) {
  const list = getAccordionList(i18nKey);
  if (!list) return;

  if (!rows || rows.length === 0) {
    list.innerHTML = '<li class="no-data">Немає інформації</li>';
    return;
  }

  list.innerHTML = rows.map((row) => {
    const name = nameForLang(row);
    const text = txt(row, 'text');
    if (name && text) return `<li><strong>${escapeHTML(name)}</strong> — ${escapeHTML(text)}</li>`;
    return `<li>${escapeHTML(name || text)}</li>`;
  }).join('');
}

// Поєднання (products_combinations) — один список, "погано" ховаємо
function renderCombinations(rows) {
  const accordion = modal
    ? [...modal.querySelectorAll('.accordion')].find((a) => a.querySelector('[data-i18n="combinations"]'))
    : null;

  const list    = accordion?.querySelectorAll('.accordion__list')[0] || null;
  const listBad = accordion?.querySelectorAll('.accordion__list')[1] || null;
  const badSubtitle = accordion?.querySelector('[data-i18n="badComb"]') || null;

  // Ховаємо підзаголовки і другий список — немає поділу на добре/погано в БД
  const goodSubtitle = accordion?.querySelector('[data-i18n="goodComb"]') || null;
  if (goodSubtitle) goodSubtitle.style.display = 'none';
  if (badSubtitle)  badSubtitle.style.display = 'none';
  if (listBad)      { listBad.style.display = 'none'; listBad.innerHTML = ''; }

  if (!list) return;

  if (!rows || rows.length === 0) {
    list.innerHTML = '<li class="no-data">Немає інформації</li>';
    return;
  }

  list.innerHTML = rows.map((row) => {
    const name = nameForLang(row);
    const text = txt(row, 'text');
    if (name && text) return `<li><strong>${escapeHTML(name)}</strong> — ${escapeHTML(text)}</li>`;
    return `<li>${escapeHTML(name || text)}</li>`;
  }).join('');
}

// Міфи: міф + правда парами
function renderMyths(rows) {
  const list = getAccordionList('myths');
  if (!list) return;

  if (!rows || rows.length === 0) {
    list.innerHTML = '<li class="no-data">Немає інформації</li>';
    return;
  }

  list.innerHTML = rows.map((row) => {
    const myth  = currentLang === 'en' ? (row.myth_en  || row.myth)  :
                  currentLang === 'pl' ? (row.myth_pl  || row.myth)  : row.myth;
    const truth = currentLang === 'en' ? (row.truth_en || row.truth) :
                  currentLang === 'pl' ? (row.truth_pl || row.truth) : row.truth;

    return `<li class="myth-item">
      <span class="myth-item__myth">❌ ${escapeHTML(myth  || '')}</span>
      <span class="myth-item__truth">✅ ${escapeHTML(truth || '')}</span>
    </li>`;
  }).join('');
}

// Заміни: product_substitutes з назвами і описом
function renderSubstitutes(rows) {
  const container = modal ? modal.querySelector('.substitutes-container') : null;
  if (!container) return;

  container.innerHTML = '';

  if (!rows || rows.length === 0) {
    container.innerHTML = '<span class="no-data">Немає замін</span>';
    return;
  }

  rows.forEach((row) => {
    const name = currentLang === 'en' ? (row.substitute_name_en || row.substitute_name_ua) :
                 currentLang === 'pl' ? (row.substitute_name_pl || row.substitute_name_ua) :
                 row.substitute_name_ua;
    const desc = currentLang === 'en' ? (row.type_en || row.type_ua) :
                 currentLang === 'pl' ? (row.type_pl || row.type_ua) :
                 row.type_ua;

    const item = document.createElement('div');
    item.className = 'substitute-item';
    item.innerHTML = `
      <span class="substitute-item__name">${escapeHTML(name || '')}</span>
      ${desc ? `<span class="substitute-item__desc">${escapeHTML(desc)}</span>` : ''}
    `;

    if (row.substitute_id) {
      item.querySelector('.substitute-item__name').style.cursor = 'pointer';
      item.querySelector('.substitute-item__name').addEventListener('click', () => {
        const found = products.find((p) => p.id === row.substitute_id);
        if (found) openProductModal(found);
      });
    }

    container.appendChild(item);
  });
}

// Масив-поле з таблиці products (time_of_day, restrictions)
function renderArrayList(i18nKey, arr) {
  const list = getAccordionList(i18nKey);
  if (!list) return;

  const items = normalizeList(arr);

  if (items.length === 0) {
    list.innerHTML = '<li class="no-data">Немає інформації</li>';
    return;
  }

  list.innerHTML = items.map((i) => `<li>${escapeHTML(String(i))}</li>`).join('');
}

/* ============================================================
   МОДАЛКА — ВІДКРИТИ
   ============================================================ */

async function openProductModal(product) {
  if (!modal || !product) return;

  currentLang = getLang();

  // Базова інфо — відображаємо одразу
  const nameEl = modal.querySelector('[data-i18n="productName"]');
  if (nameEl) nameEl.textContent = product.name_ua || '';

  const imgEl = modal.querySelector('.product-modal__image');
  if (imgEl) {
    imgEl.src =
      typeof product.image === 'string' && product.image.trim() && product.image !== 'NULL'
        ? product.image
        : 'img/placeholder.jpg';
    imgEl.onerror = () => { imgEl.src = 'img/placeholder.jpg'; };
  }

  const descEl = modal.querySelector('[data-i18n="productShortDesc"]');
  if (descEl) descEl.textContent = product.short_desc || '';

  const kcalEl = modal.querySelector('[data-i18n="kcal"]');
  if (kcalEl) kcalEl.textContent = `${product.kcal || 0} ккал`;

  const proteinEl = modal.querySelector('[data-i18n="protein"]');
  if (proteinEl) proteinEl.textContent = `${product.protein || 0}Б`;

  const fatEl = modal.querySelector('[data-i18n="fat"]');
  if (fatEl) fatEl.textContent = `${product.fat || 0}Ж`;

  const carbsEl = modal.querySelector('[data-i18n="carbs"]');
  if (carbsEl) carbsEl.textContent = `${product.carbs || 0}В`;

  const fiberRow = modal.querySelector('#productFiberRow');
  if (fiberRow) fiberRow.hidden = true;

  modal.hidden = false;
  setLoadingState();

  // Завантажуємо всі деталі паралельно
  const [
    { data: benefits },
    { data: harm },
    { data: effects },
    { data: myths },
    { data: substitutes },
    { data: combinations },
  ] = await Promise.all([
    supabase.from('product_benefits')   .select('name_ua,name_en,name_pl,text,text_en,text_pl').eq('product_id', product.id),
    supabase.from('product_harm')       .select('name_ua,name_en,name_pl,text,text_en,text_pl').eq('product_id', product.id),
    supabase.from('product_effects')    .select('name_ua,name_en,name_pl,text,text_en,text_pl').eq('product_id', product.id),
    supabase.from('product_myths_new')  .select('name_ua,name_en,name_pl,myth,truth,myth_en,truth_en,myth_pl,truth_pl').eq('product_id', product.id),
    supabase.from('product_substitutes').select('substitute_id,substitute_name_ua,substitute_name_en,substitute_name_pl,type_ua,type_en,type_pl').eq('product_id', product.id),
    supabase.from('product_combinations').select('name_ua,name_en,name_pl,text,text_en,text_pl').eq('product_id', product.id),
  ]);

  renderSimpleList('benefits',     benefits);
  renderSimpleList('harm',         harm);
  renderSimpleList('bodyReaction', effects);
  renderMyths(myths);
  renderSubstitutes(substitutes);
  renderCombinations(combinations);

  // Час вживання і обмеження — з колонок products
  renderArrayList('whenToEat',    product.time_of_day);
  renderArrayList('whenNotToEat', product.restrictions);

  // Схожі продукти — таблиці немає, ховаємо акордеон
  const simAccordion = [...modal.querySelectorAll('.accordion')]
    .find((a) => a.querySelector('[data-i18n="similarProducts"]'));
  if (simAccordion) simAccordion.hidden = true;
}

/* ============================================================
   ГЛОБАЛЬНІ КЛІКИ
   ============================================================ */

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('accordion__toggle')) {
    e.target.nextElementSibling?.classList.toggle('open');
    e.target.classList.toggle('active');
  }

  if (e.target.closest('[data-modal-close]')) {
    if (modal) modal.hidden = true;
  }

  if (!e.target.closest('.product-filters') && !e.target.closest('.subfilter-group')) {
    subGroups.forEach((g) => g.classList.remove('active'));
    filterBtns.forEach((b) => b.classList.remove('is-active'));
  }
});

/* ============================================================
   INIT
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  currentLang = getLang();
  await initAuth();
  loadProducts();
});
