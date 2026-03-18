console.log('meals.js запустився');

import { updateStats, updateWaterUI } from './stats.js';
import { i18n } from './i18n.js';
import { supabase } from './supabaseClient.js';
import { initAuth, requireAuth } from './auth.js';

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
    updateDateDisplay(date);
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

  function updateDateDisplay(dateStr) {
    if (dayDateDisplay) {
      const options = { weekday: 'long', day: 'numeric', month: 'long' };
      const dateObj = new Date(dateStr);
      dayDateDisplay.textContent = dateObj.toLocaleDateString(
        lang === 'ua' ? 'uk-UA' : lang,
        options,
      );
    }
  }

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

  // ================== MODAL ELEMENTS ==================
  const modal = document.getElementById('addFoodModal');
  const overlay = modal.querySelector('.modal__overlay');
  const closeBtn = modal.querySelector('.modal__close');
  const confirmBtn = modal.querySelector('.modal__confirm');
  const resultsList = modal.querySelector('#foodResults');

  // беремо input з HTML
  const nameInput = document.getElementById('foodSearch');

  const weightInput = modal.querySelector('.modal__weight');
  weightInput.placeholder = t('weight');

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
  }

  // ================== SEARCH ==================
  // Категорії які НЕ показуємо з products (сировина, потребує готування)
  const EXCLUDED_CATEGORY_IDS = [
    3, 4, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 27, 28, 29, 31, 34, 41, 47,
  ];

  // Debounce для пошуку
  let searchTimeout = null;

  async function handleSearch() {
    const query = nameInput.value.trim().toLowerCase();

    // Очищуємо попередній таймер
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    resultsList.innerHTML = '';
    selectedFood = null;
    confirmBtn.disabled = true;

    if (!query || query.length < 2) return;

    // Debounce 300ms
    searchTimeout = setTimeout(async () => {
      await performSearch(query);
    }, 300);
  }

  async function performSearch(query) {
    // ========== 1. ПОШУК В PRODUCTS (тільки їстівні категорії) ==========
    // Спочатку шукаємо ті, що ПОЧИНАЮТЬСЯ з query
    const { data: productsStartsWith } = await supabase
      .from('products')
      .select('*')
      .or(`name_ua.ilike.${query}%,name_en.ilike.${query}%,name_pl.ilike.${query}%`)
      .not('category_id', 'in', `(${EXCLUDED_CATEGORY_IDS.join(',')})`)
      .limit(10);

    // Потім шукаємо ті, що МІСТЯТЬ query (для доповнення)
    const { data: productsContains } = await supabase
      .from('products')
      .select('*')
      .or(`name_ua.ilike.%${query}%,name_en.ilike.%${query}%,name_pl.ilike.%${query}%`)
      .not('category_id', 'in', `(${EXCLUDED_CATEGORY_IDS.join(',')})`)
      .limit(20);

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

    // Спочатку додаємо ті що починаються з query
    (productsStartsWith || []).forEach((p) => {
      if (!seenProductIds.has(p.id)) {
        seenProductIds.add(p.id);
        allProducts.push(p);
      }
    });

    // Потім додаємо решту
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

      // Exact match — найвище
      if (aName === query && bName !== query) return -1;
      if (aName !== query && bName === query) return 1;

      // Починається з query — вище
      const aStarts = aName.startsWith(query);
      const bStarts = bName.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Коротша назва — вище (чистіший продукт)
      return aName.length - bName.length;
    });

    // ========== 5. СОРТУВАННЯ RECIPES ==========
    const sortedRecipes = allRecipes.sort((a, b) => {
      const aName = (a.name_ua || '').toLowerCase();
      const bName = (b.name_ua || '').toLowerCase();

      // Exact match — найвище
      if (aName === query && bName !== query) return -1;
      if (aName !== query && bName === query) return 1;

      // Починається з query — вище
      const aStarts = aName.startsWith(query);
      const bStarts = bName.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Містить query як окреме слово — вище
      const queryWordRegex = new RegExp(`(^|\\s)${query}`, 'i');
      const aHasWord = queryWordRegex.test(aName);
      const bHasWord = queryWordRegex.test(bName);
      if (aHasWord && !bHasWord) return -1;
      if (!aHasWord && bHasWord) return 1;

      // Коротша назва — вище
      return aName.length - bName.length;
    });

    // ========== 6. РЕНДЕР — ПРОДУКТИ (топ 5) ==========
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

    // ========== 7. РЕНДЕР — СТРАВИ (топ 5) ==========
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

    // ========== 8. НІЧОГО НЕ ЗНАЙДЕНО ==========
    if (topProducts.length === 0 && topRecipes.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'modal__item modal__item--empty';
      emptyLi.textContent = lang === 'ua' ? 'Нічого не знайдено' : 'Nothing found';
      resultsList.appendChild(emptyLi);
    }
  }

  // ========== HELPER: Створення елемента списку ==========
  function createFoodItem(food, type) {
    const li = document.createElement('li');
    li.className = 'modal__item';

    const name = food.name_ua || food.name || '';
    const kcal = food.kcal || 0;

    li.innerHTML = `
      <div>
        <strong>${name}</strong>
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

      Array.from(resultsList.children).forEach((el) => el.classList.remove('modal__item--active'));

      li.classList.add('modal__item--active');

      updateConfirmState();
      weightInput.focus();
    });

    return li;
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

  // ================== BARCODE ==================
  async function handleBarcode(barcode) {
    console.log('Скануємо:', barcode);

    // 1. шукаємо в твоїй БД
    const { data: localProduct } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle();

    if (localProduct) {
      selectFood(localProduct);
      return;
    }

    // 2. OpenFoodFacts
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);

    const data = await response.json();

    if (data.status === 1) {
      const p = data.product;

      const product = {
        barcode,
        name: p.product_name || 'Без назви',
        kcal: p.nutriments?.['energy-kcal_100g'] || 0,
        protein: p.nutriments?.proteins_100g || 0,
        fat: p.nutriments?.fat_100g || 0,
        carbs: p.nutriments?.carbohydrates_100g || 0,
      };

      await supabase.from('products').insert([product]);

      selectFood(product);
      return;
    }

    alert('Продукт не знайдено 😔');
  }

  // helper
  function selectFood(food) {
    selectedFood = food;
    nameInput.value = food.name;
    resultsList.innerHTML = '';
    updateConfirmState();
    weightInput.focus();
  }

  // ================== SIDEBAR DAYS ==================
  function initDaysNavigation() {
    const dayButtons = document.querySelectorAll('.sidebar__day-btn');

    dayButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const dayName = btn.dataset.day;
        const today = new Date();
        const currentDayIndex = today.getDay() || 7;

        const targetDayIndex = {
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
          sunday: 7,
        }[dayName];

        const diff = targetDayIndex - currentDayIndex;
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + diff);

        currentSelectedDate = getLocalDateString(targetDate);

        dayButtons.forEach((b) => b.classList.remove('sidebar__day-btn--active'));
        btn.classList.add('sidebar__day-btn--active');

        loadMealsFromSupabase(currentSelectedDate);
      });
    });
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

  // 📷 BARCODE BUTTON
  const barcodeBtn = document.getElementById('barcodeBtn');

  if (barcodeBtn) {
    barcodeBtn.addEventListener('click', async () => {
      const barcode = prompt('Введи штрих-код');

      if (!barcode) return;

      await handleBarcode(barcode);
    });
  }

  // ================== INIT ==================
  initDaysNavigation();
  loadMealsFromSupabase(currentSelectedDate);
});
