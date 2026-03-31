console.log('meals.js запустився');

import { updateStats, updateWaterUI } from './stats.js';
import { i18n } from './i18n.js';
import { supabase } from './supabaseClient.js';
import { initAuth, requireAuth } from './auth.js';
import { initBarcodeScanner, closeScanner } from './barcode-scanner.js';

document.addEventListener('DOMContentLoaded', async () => {
  // ================== ДАТА ХЕЛПЕР — має бути першим ==================
  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  let currentSelectedDate = getLocalDateString();

  // ================== AUTH ==================
  await initAuth((event, user) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      loadMealsFromSupabase(currentSelectedDate);
      loadWaterFromSupabase(currentSelectedDate);
    }
  });

  // ================== LANGUAGE ==================
  let lang = localStorage.getItem('lang') || 'ua';

  const langSwitcher = document.getElementById('langSwitcher');
  if (langSwitcher) {
    langSwitcher.value = lang;
    langSwitcher.addEventListener('change', () => {
      lang = langSwitcher.value;
      localStorage.setItem('lang', lang);
      renderAllMeals();
      renderSummary();
    });
  }

  function t(key) {
    return i18n[lang][key];
  }

  // ================== STATE ==================
  const mealsState = {
    breakfast: [],
    snack1: [],
    lunch: [],
    snack2: [],
    dinner: [],
  };

  const STORAGE_KEY = 'mealsState';
  let activeMealKey = null;
  let selectedFood = null;
  let editingIndex = null;

  const summaryValue = document.querySelector('.day-summary__value');
  const dayDateDisplay = document.getElementById('dayDate');

  // ================== DAILY NORM ==================
  const dailyNorm = Number(localStorage.getItem('dailyCaloriesNorm')) || 0;

  // ================== SUPABASE LOGIC ==================

  async function loadMealsFromSupabase(date) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase.from('meals').select('*').eq('date', date);

    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Помилка Supabase:', error);
      return;
    }

    Object.keys(mealsState).forEach((key) => (mealsState[key] = []));

    if (data) {
      data.forEach((item) => {
        if (mealsState[item.meal_type]) {
          mealsState[item.meal_type].push({
            id: item.id,
            name: item.name,
            weight: item.weight,
            kcal: item.kcal,
            protein: item.protein,
            fat: item.fat,
            carbs: item.carbs,
          });
        }
      });
    }

    renderAllMeals();
    renderSummary();
    loadWaterFromSupabase(date);
  }

  // --- ЛОГІКА ВОДИ ---

  async function loadWaterFromSupabase(date) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let query = supabase.from('water').select('amount').eq('date', date);

    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Помилка води:', error);
      return;
    }

    const total = data ? data.reduce((acc, item) => acc + Number(item.amount), 0) : 0;
    updateWaterUI(total);
  }

  async function addWaterToSupabase(amount) {
    if (!requireAuth()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('water').insert([
      {
        amount: amount,
        date: currentSelectedDate,
        user_id: user ? user.id : null,
      },
    ]);

    if (!error) {
      loadWaterFromSupabase(currentSelectedDate);
    }
  }

  async function resetWaterDay() {
    if (!requireAuth()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    let query = supabase.from('water').delete().eq('date', currentSelectedDate);

    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.is('user_id', null);
    }

    const { error } = await query;
    if (!error) {
      updateWaterUI(0);
    }
  }

  // --- КІНЕЦЬ ЛОГІКИ ВОДИ ---


  function saveMealsToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mealsState));
  }

  async function clearDay() {
    if (!requireAuth()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase.from('meals').delete().eq('date', currentSelectedDate);

    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.is('user_id', null);
    }

    const { error } = await query;

    if (!error) {
      Object.keys(mealsState).forEach((mealKey) => {
        mealsState[mealKey] = [];
        renderMeal(mealKey);
      });
      renderSummary();
      saveMealsToStorage();
    }
  }

  // ================== RENDER ==================
  function renderAllMeals() {
    Object.keys(mealsState).forEach(renderMeal);
  }

  function renderMeal(mealKey) {
    const mealBlock = document.querySelector(`.meal[data-meal="${mealKey}"]`);
    if (!mealBlock) return;

    const list = mealBlock.querySelector('.meal__recipes');
    list.innerHTML = '';

    mealsState[mealKey].forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'meal__recipe';

      li.innerHTML = `
      <div class="meal__recipe-line">
        <div class="meal__recipe-info">
          <div class="meal__recipe-name">${item.name}</div>
          <div class="meal__recipe-kcal">
            ${item.kcal} ${t('kcal')} · 
            ${t('protein')} ${item.protein} · 
            ${t('fat')} ${item.fat} · 
            ${t('carbs')} ${item.carbs}
          </div>
        </div>
        <button class="meal__delete-btn" data-index="${index}">🗑</button>
      </div>
    `;

      li.addEventListener('click', (e) => {
        if (e.target.closest('.meal__delete-btn')) return;
        editingIndex = index;
        openModal(mealKey, item);
      });

      const deleteBtn = li.querySelector('.meal__delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteConfirm(mealKey, index);
      });

      list.appendChild(li);
    });
  }

  // ================== SUMMARY ==================
  function renderSummary() {
    const total = Object.values(mealsState)
      .flat()
      .reduce(
        (acc, item) => {
          acc.kcal += Number(item.kcal) || 0;
          acc.protein += Number(item.protein) || 0;
          acc.fat += Number(item.fat) || 0;
          acc.carbs += Number(item.carbs) || 0;
          return acc;
        },
        { kcal: 0, protein: 0, fat: 0, carbs: 0 },
      );

    if (summaryValue) {
      summaryValue.textContent = `${total.kcal} ${t('kcal')} · ${t('protein')} ${total.protein.toFixed(1)} · ${t('fat')} ${total.fat.toFixed(1)} · ${t('carbs')} ${total.carbs.toFixed(1)}`;
    }

    const progress = dailyNorm ? total.kcal / dailyNorm : 0;

    updateStats({
      ...total,
      dailyNorm,
      progress,
    });
  }

  // ================== DELETE CONFIRM ==================
  function openDeleteConfirm(mealKey, index) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;

    modal.classList.add('active');
    modal.hidden = false;

    const yes = document.getElementById('confirm-yes');
    const no = document.getElementById('confirm-no');

    yes.onclick = async () => {
      const itemToDelete = mealsState[mealKey][index];
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let query = supabase.from('meals').delete().eq('id', itemToDelete.id);

      if (user) {
        query = query.eq('user_id', user.id);
      } else {
        query = query.is('user_id', null);
      }

      const { error } = await query;

      if (!error) {
        mealsState[mealKey].splice(index, 1);
        saveMealsToStorage();
        renderMeal(mealKey);
        renderSummary();
      }

      modal.classList.remove('active');
      modal.hidden = true;
    };

    no.onclick = () => {
      modal.classList.remove('active');
      modal.hidden = true;
    };
  }

  // ================== MODAL ELEMENTS (ADD FOOD) ==================
  const modal = document.getElementById('addFoodModal');
  const overlay = modal.querySelector('.modal__overlay');
  const closeBtn = modal.querySelector('.modal__close');
  const confirmBtn = modal.querySelector('.modal__confirm');
  const resultsList = modal.querySelector('#foodResults');

  const nameInput = document.getElementById('foodSearch');

  const weightInput = modal.querySelector('.modal__weight');
  weightInput.placeholder = t('weight');

  // ================== SCANNED PRODUCT CARD ==================
  const scannedCard = document.getElementById('scannedProductCard');
  const scKcalInput = document.getElementById('scKcal');
  const scProteinInput = document.getElementById('scProtein');
  const scFatInput = document.getElementById('scFat');
  const scCarbsInput = document.getElementById('scCarbs');

  function showScannedProductCard(product) {
    if (!scannedCard) return;

    const nameEl = scannedCard.querySelector('.scanned-card__name');
    const brandEl = scannedCard.querySelector('.scanned-card__brand');
    const clearBtn = scannedCard.querySelector('.scanned-card__clear');

    const displayName = product.name_ua || product.name_en || product.name || 'Без назви';

    nameEl.textContent = displayName;
    brandEl.textContent = product.brand || '';

    // Заповнюємо інпути
    scKcalInput.value = product.kcal || 0;
    scProteinInput.value = product.protein || 0;
    scFatInput.value = product.fat || 0;
    scCarbsInput.value = product.carbs || 0;

    scannedCard.hidden = false;

    // Слухачі для оновлення selectedFood при редагуванні
    const updateSelectedFood = () => {
      if (selectedFood) {
        selectedFood.kcal = Number(scKcalInput.value) || 0;
        selectedFood.protein = Number(scProteinInput.value) || 0;
        selectedFood.fat = Number(scFatInput.value) || 0;
        selectedFood.carbs = Number(scCarbsInput.value) || 0;
      }
    };

    scKcalInput.oninput = updateSelectedFood;
    scProteinInput.oninput = updateSelectedFood;
    scFatInput.oninput = updateSelectedFood;
    scCarbsInput.oninput = updateSelectedFood;

    // Очищення картки
    clearBtn.onclick = () => {
      hideScannedProductCard();
      selectedFood = null;
      nameInput.value = '';
      updateConfirmState();
    };
  }

  function hideScannedProductCard() {
    if (scannedCard) {
      scannedCard.hidden = true;
      scKcalInput.value = '';
      scProteinInput.value = '';
      scFatInput.value = '';
      scCarbsInput.value = '';
    }
  }

  // ================== MODAL LOGIC ==================
  function updateConfirmState() {
    const weight = Number(weightInput.value);
    confirmBtn.disabled = !(selectedFood && weight > 0);
  }

  function openModal(mealKey, item = null) {
    activeMealKey = mealKey;

    selectedFood = item ? { ...item, kcal: item.kcal / (item.weight / 100) } : null;

    resultsList.innerHTML = '';
    confirmBtn.disabled = !item;

    nameInput.value = item ? item.name.replace(/\s\(.*?\)$/, '') : '';
    weightInput.value = item ? item.weight : '';

    // Ховаємо картку сканованого продукту при відкритті
    hideScannedProductCard();

    modal.hidden = false;
    nameInput.focus();
  }

  function closeModal() {
    modal.hidden = true;
    activeMealKey = null;
    selectedFood = null;
    editingIndex = null;

    nameInput.value = '';
    weightInput.value = '';
    resultsList.innerHTML = '';

    // Ховаємо картку сканованого продукту
    hideScannedProductCard();
  }

  // ================== SEARCH ==================
  const EXCLUDED_CATEGORY_IDS = [
    3, 4, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 27, 28, 29, 31, 34, 41, 47,
  ];

  let searchTimeout = null;

  async function handleSearch() {
    const query = nameInput.value.trim().toLowerCase();

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    resultsList.innerHTML = '';
    selectedFood = null;
    confirmBtn.disabled = true;

    // Ховаємо картку при новому пошуку
    hideScannedProductCard();

    if (!query || query.length < 2) return;

    searchTimeout = setTimeout(async () => {
      await performSearch(query);
    }, 300);
  }

  async function performSearch(query) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // ========== 1. ПОШУК В PRODUCTS ==========
    // Спочатку ті, що ПОЧИНАЮТЬСЯ з query
    let productsStartsQuery = supabase
      .from('products')
      .select('*')
      .or(`name_ua.ilike.${query}%,name_en.ilike.${query}%,name_pl.ilike.${query}%`)
      .not('category_id', 'in', `(${EXCLUDED_CATEGORY_IDS.join(',')})`)
      .limit(10);

    // Фільтр: загальні (user_id IS NULL) АБО власні (user_id = current)
    if (user) {
      productsStartsQuery = productsStartsQuery.or(`user_id.is.null,user_id.eq.${user.id}`);
    } else {
      productsStartsQuery = productsStartsQuery.is('user_id', null);
    }

    const { data: productsStartsWith } = await productsStartsQuery;

    // Потім ті, що МІСТЯТЬ query
    let productsContainsQuery = supabase
      .from('products')
      .select('*')
      .or(`name_ua.ilike.%${query}%,name_en.ilike.%${query}%,name_pl.ilike.%${query}%`)
      .not('category_id', 'in', `(${EXCLUDED_CATEGORY_IDS.join(',')})`)
      .limit(20);

    if (user) {
      productsContainsQuery = productsContainsQuery.or(`user_id.is.null,user_id.eq.${user.id}`);
    } else {
      productsContainsQuery = productsContainsQuery.is('user_id', null);
    }

    const { data: productsContains } = await productsContainsQuery;

    // ========== 2. ПОШУК В RECIPES ==========
    const { data: recipesStartsWith } = await supabase
      .from('recipes')
      .select('*')
      .or(`name_ua.ilike.${query}%,name_en.ilike.${query}%,name_pl.ilike.${query}%`)
      .limit(10);

    const { data: recipesContains } = await supabase
      .from('recipes')
      .select('*')
      .or(`name_ua.ilike.%${query}%,name_en.ilike.%${query}%,name_pl.ilike.%${query}%`)
      .limit(20);

    // ========== 3. ОБ'ЄДНАННЯ І ДЕДУПЛІКАЦІЯ ==========
    const seenProductIds = new Set();
    const allProducts = [];

    (productsStartsWith || []).forEach((p) => {
      if (!seenProductIds.has(p.id)) {
        seenProductIds.add(p.id);
        allProducts.push(p);
      }
    });

    (productsContains || []).forEach((p) => {
      if (!seenProductIds.has(p.id)) {
        seenProductIds.add(p.id);
        allProducts.push(p);
      }
    });

    const seenRecipeIds = new Set();
    const allRecipes = [];

    (recipesStartsWith || []).forEach((r) => {
      if (!seenRecipeIds.has(r.id)) {
        seenRecipeIds.add(r.id);
        allRecipes.push(r);
      }
    });

    (recipesContains || []).forEach((r) => {
      if (!seenRecipeIds.has(r.id)) {
        seenRecipeIds.add(r.id);
        allRecipes.push(r);
      }
    });

    // ========== 4. СОРТУВАННЯ PRODUCTS ==========
    const sortedProducts = allProducts.sort((a, b) => {
      const aName = (a.name_ua || '').toLowerCase();
      const bName = (b.name_ua || '').toLowerCase();

      // Власні продукти користувача — трохи вище
      const aIsOwn = a.user_id && user && a.user_id === user.id;
      const bIsOwn = b.user_id && user && b.user_id === user.id;
      if (aIsOwn && !bIsOwn) return -1;
      if (!aIsOwn && bIsOwn) return 1;

      // Exact match — найвище
      if (aName === query && bName !== query) return -1;
      if (aName !== query && bName === query) return 1;

      // Починається з query — вище
      const aStarts = aName.startsWith(query);
      const bStarts = bName.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Коротша назва — вище
      return aName.length - bName.length;
    });

    // ========== 5. СОРТУВАННЯ RECIPES ==========
    const sortedRecipes = allRecipes.sort((a, b) => {
      const aName = (a.name_ua || '').toLowerCase();
      const bName = (b.name_ua || '').toLowerCase();

      if (aName === query && bName !== query) return -1;
      if (aName !== query && bName === query) return 1;

      const aStarts = aName.startsWith(query);
      const bStarts = bName.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      const queryWordRegex = new RegExp(`(^|\\s)${query}`, 'i');
      const aHasWord = queryWordRegex.test(aName);
      const bHasWord = queryWordRegex.test(bName);
      if (aHasWord && !bHasWord) return -1;
      if (!aHasWord && bHasWord) return 1;

      return aName.length - bName.length;
    });

    // ========== 6. РЕНДЕР ==========
    const topProducts = sortedProducts.slice(0, 5);
    const topRecipes = sortedRecipes.slice(0, 5);

    resultsList.innerHTML = '';

    if (topProducts.length > 0) {
      const headerProducts = document.createElement('li');
      headerProducts.className = 'modal__group-header';
      headerProducts.textContent = lang === 'ua' ? '🥬 Продукти' : '🥬 Products';
      resultsList.appendChild(headerProducts);

      topProducts.forEach((food) => {
        const li = createFoodItem(food, 'product');
        resultsList.appendChild(li);
      });
    }

    if (topRecipes.length > 0) {
      const headerRecipes = document.createElement('li');
      headerRecipes.className = 'modal__group-header';
      headerRecipes.textContent = lang === 'ua' ? '🍽️ Страви' : '🍽️ Dishes';
      resultsList.appendChild(headerRecipes);

      topRecipes.forEach((recipe) => {
        const li = createFoodItem(recipe, 'recipe');
        resultsList.appendChild(li);
      });
    }

    // ========== 7. НІЧОГО НЕ ЗНАЙДЕНО + КНОПКА СТВОРИТИ ==========
    if (topProducts.length === 0 && topRecipes.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'modal__item modal__item--empty';
      emptyLi.innerHTML = `
        <div>${lang === 'ua' ? 'Нічого не знайдено' : 'Nothing found'}</div>
      `;
      resultsList.appendChild(emptyLi);
    }

    // Завжди показуємо кнопку "Створити продукт"
    const createBtn = document.createElement('li');
    createBtn.className = 'modal__item modal__item--create';
    createBtn.innerHTML = `
      <span>➕ ${lang === 'ua' ? 'Створити свій продукт' : 'Create custom product'}</span>
    `;
    createBtn.addEventListener('click', () => {
      openCreateProductModal(nameInput.value.trim());
    });
    resultsList.appendChild(createBtn);
  }

  // ========== HELPER: Створення елемента списку ==========
  function createFoodItem(food, type) {
    const li = document.createElement('li');
    li.className = 'modal__item';

    const name = food.name_ua || food.name || '';
    const kcal = food.kcal || 0;
    const isOwn = food.user_id ? true : false;

    li.innerHTML = `
      <div>
        <strong>${name}</strong>${isOwn ? ' <span class="modal__badge">Мій</span>' : ''}
        <div style="font-size:12px; opacity:0.7;">
          ${kcal} ${t('kcal')} / ${t('per100')}
        </div>
      </div>
    `;

    li.addEventListener('click', () => {
      selectedFood = {
        ...food,
        name: name,
        source: type,
      };
      nameInput.value = name;

      // Ховаємо картку сканованого продукту при виборі зі списку
      hideScannedProductCard();

      Array.from(resultsList.children).forEach((el) => el.classList.remove('modal__item--active'));

      li.classList.add('modal__item--active');

      updateConfirmState();
      weightInput.focus();
    });

    return li;
  }

  // ================== CREATE PRODUCT MODAL ==================
  const createProductModal = document.getElementById('createProductModal');
  const createProductForm = createProductModal?.querySelector('.modal__form');
  const createProductClose = createProductModal?.querySelector('.modal__close');
  const createProductOverlay = createProductModal?.querySelector('.modal__overlay');
  const createProductConfirm = createProductModal?.querySelector('.modal__confirm');

  const cpNameInput = document.getElementById('cpName');
  const cpKcalInput = document.getElementById('cpKcal');
  const cpProteinInput = document.getElementById('cpProtein');
  const cpFatInput = document.getElementById('cpFat');
  const cpCarbsInput = document.getElementById('cpCarbs');

  // Флаг: чи користувач вручну редагував ккал
  let kcalManuallyEdited = false;

  // Авторахунок ккал: Б×4 + Ж×9 + В×4
  function autoCalculateKcal() {
    if (kcalManuallyEdited) return;

    const protein = Number(cpProteinInput?.value) || 0;
    const fat = Number(cpFatInput?.value) || 0;
    const carbs = Number(cpCarbsInput?.value) || 0;

    const kcal = Math.round(protein * 4 + fat * 9 + carbs * 4);

    if (cpKcalInput) {
      cpKcalInput.value = kcal > 0 ? kcal : '';
    }
  }

  // Слухачі для БЖВ — перераховують ккал
  if (cpProteinInput) {
    cpProteinInput.addEventListener('input', autoCalculateKcal);
  }
  if (cpFatInput) {
    cpFatInput.addEventListener('input', autoCalculateKcal);
  }
  if (cpCarbsInput) {
    cpCarbsInput.addEventListener('input', autoCalculateKcal);
  }

  // Якщо користувач клікнув на поле ккал і почав вводити — вимикаємо авторахунок
  if (cpKcalInput) {
    cpKcalInput.addEventListener('input', () => {
      kcalManuallyEdited = true;
    });
  }

  function openCreateProductModal(prefillName = '') {
    if (!createProductModal) return;

    // Скидаємо флаг при відкритті
    kcalManuallyEdited = false;

    cpNameInput.value = prefillName;
    cpKcalInput.value = '';
    cpProteinInput.value = '';
    cpFatInput.value = '';
    cpCarbsInput.value = '';

    createProductModal.hidden = false;
    cpNameInput.focus();
  }

  function closeCreateProductModal() {
    if (!createProductModal) return;
    createProductModal.hidden = true;
  }

  async function saveCustomProduct() {
    if (!requireAuth()) return;

    const name = cpNameInput.value.trim();
    const kcal = Number(cpKcalInput.value) || 0;
    const protein = Number(cpProteinInput.value) || 0;
    const fat = Number(cpFatInput.value) || 0;
    const carbs = Number(cpCarbsInput.value) || 0;

    if (!name) {
      alert(lang === 'ua' ? 'Введіть назву продукту' : 'Enter product name');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          name_ua: name,
          kcal,
          protein,
          fat,
          carbs,
          user_id: user.id,
          is_verified: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Помилка збереження:', error);
      alert(lang === 'ua' ? 'Помилка збереження' : 'Save error');
      return;
    }

    // Автоматично вибираємо створений продукт
    selectedFood = {
      ...data,
      name: data.name_ua,
      source: 'product',
    };

    nameInput.value = data.name_ua;
    resultsList.innerHTML = '';

    closeCreateProductModal();
    updateConfirmState();
    weightInput.focus();
  }

  // Events для модалки створення
  if (createProductClose) {
    createProductClose.addEventListener('click', closeCreateProductModal);
  }
  if (createProductOverlay) {
    createProductOverlay.addEventListener('click', closeCreateProductModal);
  }
  if (createProductConfirm) {
    createProductConfirm.addEventListener('click', saveCustomProduct);
  }

  // ================== ADD FOOD ==================

  async function addSelectedFood() {
    if (!requireAuth()) return;
    if (!activeMealKey || !selectedFood) return;

    const grams = Number(weightInput.value);
    if (grams <= 0) return;

    const factor = grams / 100;
    const gramsLabel = lang === 'ua' ? 'гр' : lang === 'pl' ? 'g' : 'g';

    const newItem = {
      name: `${selectedFood.name} (${grams} ${gramsLabel})`,
      weight: grams,
      kcal: Math.round(selectedFood.kcal * factor),
      protein: Number((selectedFood.protein * factor).toFixed(1)),
      fat: Number((selectedFood.fat * factor).toFixed(1)),
      carbs: Number((selectedFood.carbs * factor).toFixed(1)),
    };

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      meal_type: activeMealKey,
      name: newItem.name,
      weight: newItem.weight,
      kcal: newItem.kcal,
      protein: newItem.protein,
      fat: newItem.fat,
      carbs: newItem.carbs,
      date: currentSelectedDate,
      user_id: user ? user.id : null,
    };

    let result;
    if (editingIndex !== null) {
      result = await supabase
        .from('meals')
        .update(payload)
        .eq('id', mealsState[activeMealKey][editingIndex].id);
    } else {
      result = await supabase.from('meals').insert([payload]);
    }

    if (!result.error) {
      loadMealsFromSupabase(currentSelectedDate);
      closeModal();
    }
  }

  // ================== EVENTS ==================

  document.querySelectorAll('.meal__add').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!requireAuth()) return;
      const mealBlock = btn.closest('.meal');
      if (!mealBlock) return;
      const mealKey = mealBlock.dataset.meal;
      if (!mealKey) return;
      editingIndex = null;
      openModal(mealKey);
    });
  });

  document.querySelectorAll('.water-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const amount = parseFloat(btn.dataset.amount);
      if (!isNaN(amount)) {
        addWaterToSupabase(amount);
      }
    });
  });

  const resetWater = document.getElementById('resetWater');
  if (resetWater) {
    resetWater.addEventListener('click', resetWaterDay);
  }

  nameInput.addEventListener('input', handleSearch);
  weightInput.addEventListener('input', updateConfirmState);

  confirmBtn.textContent = t('add');
  confirmBtn.addEventListener('click', addSelectedFood);

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);

  const clearBtn = document.getElementById('clearDayBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearDay);
  }

  // ================== INIT ==================

  // Ініціалізація сканера штрих-кодів
  initBarcodeScanner((product) => {
    selectedFood = {
      ...product,
      name: product.name_ua || product.name_en || product.name,
      source: 'barcode',
    };

    nameInput.value = selectedFood.name;
    resultsList.innerHTML = '';

    // Показуємо картку сканованого продукту з КБЖУ
    showScannedProductCard(product);

    updateConfirmState();
    weightInput.focus();
  });
  // Експорт для sidebar-days.js
  window.mealsAPI = {
    loadMealsForDate: (dateString) => {
      currentSelectedDate = dateString;
      loadMealsFromSupabase(dateString);
    },
  };

  // Початкове завантаження
  loadMealsFromSupabase(currentSelectedDate);
});
