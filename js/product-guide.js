/* ============================================================
   1. КОНФІГУРАЦІЯ SUPABASE
   ============================================================ */
const SUPABASE_URL = 'https://xpaibteyntflrixmigfx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5aziCmaq0rxAJ24MznPycw_eY5iVZxZ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let products = [];

/* ============================================================
   2. ДОПОМІЖНІ ФУНКЦІЇ НОРМАЛІЗАЦІЇ
   ============================================================ */

// Нормалізація масивів ID (int8[])
function normalizeIdArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number);

  if (typeof value === 'string' && value.startsWith('{')) {
    return value
      .replace('{', '')
      .replace('}', '')
      .split(',')
      .map(Number)
      .filter((n) => !isNaN(n));
  }

  return [];
}

// Нормалізація списків benefits, harm, body_effects (text[])
function normalizeList(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    return value
      .replace('{', '')
      .replace('}', '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}

/* ============================================================
   3. ЕЛЕМЕНТИ DOM
   ============================================================ */
const productList = document.querySelector('.product-list');
const modal = document.querySelector('[data-modal="product"]');
const searchInput = document.querySelector('.product-search__input');
const searchContainer = document.querySelector('.product-search');
const filterBtns = document.querySelectorAll('.product-filters__item');
const subGroups = document.querySelectorAll('.subfilter-group');

/* ============================================================
   4. ЗАВАНТАЖЕННЯ ДАНИХ
   ============================================================ */
async function loadProducts() {
  try {
    const { data, error } = await supabaseClient.from('products').select('*');
    if (error) throw error;
    products = data || [];
    renderProducts(products);
  } catch (err) {
    console.error('Помилка Supabase:', err.message);
    if (productList) productList.innerHTML = `<p style="color:red">Помилка завантаження даних</p>`;
  }
}

/* ============================================================
   5. РЕНДЕР КАРТОК
   ============================================================ */
function renderProducts(items) {
  if (!productList) return;
  productList.innerHTML = '';

  if (!items || items.length === 0) {
    productList.innerHTML = '<p class="no-results">Продуктів не знайдено 🌿</p>';
    return;
  }

  items.forEach((product) => {
    const card = document.createElement('div');
    card.className = 'product-card-mini';

    const imgSrc =
      typeof product.image === 'string' && product.image.trim() !== '' && product.image !== 'NULL'
        ? product.image
        : 'img/placeholder.jpg';

    card.innerHTML = `
      <div class="product-card-mini__img-wrapper">
        <img src="${imgSrc}" alt="${product.name_ua || ''}" 
             class="product-card-mini__image" 
             onerror="this.src='img/placeholder.jpg'">
      </div>
      <div class="product-card-mini__content">
        <h3 class="product-card-mini__title">${product.name_ua || 'Без назви'}</h3>
        <p class="product-card-mini__desc">${product.short_desc || ''}</p>
        <div class="product-card-mini__macros">
          <span>${product.kcal || 0} ккал</span>
          <span>${product.protein || 0}Б</span>
          <span>${product.fat || 0}Ж</span>
          <span>${product.carbs || 0}В</span>
        </div>
      </div>
    `;
    card.onclick = () => openProductModal(product);
    productList.appendChild(card);
  });
}

/* ============================================================
   6. ЛОГІКА ФІЛЬТРАЦІЇ
   ============================================================ */
const checkCondition = (product, filterValue) => {
  if (!product || !filterValue) return false;
  const val = filterValue.toLowerCase().trim();
  const p = product;

  // КБЖУ
  if (val.includes('високобілкові')) return (Number(p.protein) || 0) >= 15;
  if (val.includes('низьковуглеводні')) return (Number(p.carbs) || 0) <= 10;
  if (val.includes('високовуглеводні')) return (Number(p.carbs) || 0) >= 40;
  if (val.includes('низькокалорійні')) return (Number(p.kcal) || 0) <= 100;
  if (val.includes('висококалорійні')) return (Number(p.kcal) || 0) >= 400;
  if (val.includes('низькожирні')) return (Number(p.fat) || 0) <= 3;

  // ГІ
  const giVal = parseInt(p.gi) || 0;
  if (val === 'низький гі') return giVal > 0 && giVal <= 55;
  if (val === 'середній гі') return giVal > 55 && giVal <= 69;
  if (val === 'високий гі') return giVal >= 70;

  // Текстові поля
  const searchFields = [
    p.name_ua,
    p.category,
    p.tags,
    p.purpose,
    p.time_of_day,
    p.best_time_to_eat,
    p.alt_names,
  ];

  return searchFields.some((field) => field && String(field).toLowerCase().includes(val));
};

const applyFilters = () => {
  const searchText = (searchInput.value || '').toLowerCase().trim();
  const activeChips = [...document.querySelectorAll('.search-chip')].map((c) => c.dataset.value);

  const filtered = products.filter((p) => {
    const nameStr = String(p.name_ua || '').toLowerCase();
    const altStr = String(p.alt_names || '').toLowerCase();
    const matchesSearch =
      !searchText || nameStr.includes(searchText) || altStr.includes(searchText);

    const matchesChips = activeChips.every((chip) => checkCondition(p, chip));

    return matchesSearch && matchesChips;
  });

  renderProducts(filtered);
};

/* ============================================================
   7. ОБРОБКА ПОДІЙ
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
  btn.onclick = (e) => {
    e.stopPropagation();
    const target = btn.dataset.filter;
    const group = document.querySelector(`.subfilter-group[data-subfilter="${target}"]`);
    const isAlreadyOpen = group?.classList.contains('active');
    subGroups.forEach((g) => g.classList.remove('active'));
    filterBtns.forEach((b) => b.classList.remove('is-active'));
    if (group && !isAlreadyOpen) {
      group.classList.add('active');
      btn.classList.add('is-active');
    }
  };
});

subGroups.forEach((group) => {
  group.onclick = (e) => {
    const item = e.target.closest('.subfilter-item');
    if (!item) return;
    addNewChip(item.textContent.trim());
    group.classList.remove('active');
    filterBtns.forEach((b) => b.classList.remove('is-active'));
  };
});

if (searchInput) {
  searchInput.oninput = applyFilters;
}

/* ============================================================
   8. МОДАЛКА
   ============================================================ */
function openProductModal(product) {
  if (!modal || !product) return;

  modal.querySelector('[data-i18n="productName"]').textContent = product.name_ua || '';
  modal.querySelector('.product-modal__image').src =
    typeof product.image === 'string' && product.image.trim() !== '' && product.image !== 'NULL'
      ? product.image
      : 'img/placeholder.jpg';

  modal.querySelector('[data-i18n="productShortDesc"]').textContent = product.short_desc || '';

  modal.querySelector('[data-i18n="kcal"]').textContent = `${product.kcal || 0} ккал`;
  modal.querySelector('[data-i18n="protein"]').textContent = `${product.protein || 0}Б`;
  modal.querySelector('[data-i18n="fat"]').textContent = `${product.fat || 0}Ж`;
  modal.querySelector('[data-i18n="carbs"]').textContent = `${product.carbs || 0}В`;

  const updateList = (i18nKey, value) => {
    const list = modal
      .querySelector(`[data-i18n="${i18nKey}"]`)
      ?.closest('.accordion')
      ?.querySelector('.accordion__list');

    if (list) {
      const items = normalizeList(value);
      list.innerHTML =
        items.length > 0 ? items.map((i) => `<li>${i}</li>`).join('') : '<li>Немає інформації</li>';
    }
  };

  updateList('benefit1', product.benefits);
  updateList('harm1', product.harm);
  updateList('eatMorning', product.best_time_to_eat);
  updateList('notEatNight', product.when_to_avoid);
  updateList('reaction1', product.body_effects);
  updateList('myths1', product.myths_and_truths);

  const updateLinked = (selector, ids) => {
    const box = modal.querySelector(selector);
    if (!box) return;
    box.innerHTML = '';

    const idList = normalizeIdArray(ids);

    if (idList.length === 0) {
      box.innerHTML = '<span class="no-data">Не знайдено</span>';
      return;
    }

    idList.forEach((id) => {
      const found = products.find((p) => Number(p.id) === Number(id));
      if (found) {
        const chip = document.createElement('span');
        chip.className = 'product-chip';
        chip.textContent = found.name_ua;
        chip.onclick = () => {
          modal.scrollTo(0, 0);
          openProductModal(found);
        };
        box.appendChild(chip);
      }
    });
  };

  updateLinked('.substitutes-container', product.substitute_ids);
  updateLinked('.similar-products-container', product.similar_products);

  modal.hidden = false;
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('accordion__toggle')) {
    e.target.nextElementSibling?.classList.toggle('open');
    e.target.classList.toggle('active');
  }
  if (e.target.matches('[data-modal-close]')) modal.hidden = true;
  if (!e.target.closest('.product-filters') && !e.target.closest('.subfilter-group')) {
    subGroups.forEach((g) => g.classList.remove('active'));
    filterBtns.forEach((b) => b.classList.remove('is-active'));
  }
});

document.addEventListener('DOMContentLoaded', loadProducts);
