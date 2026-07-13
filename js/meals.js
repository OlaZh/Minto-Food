import { updateStats, updateWaterUI } from './stats.js';
import { iconTrash, iconPlus, iconBarcode } from './icons.js';
import { i18n } from './i18n.js';
import { supabase } from './supabaseClient.js';
import { initAuth, requireAuth } from './auth.js';
import { initBarcodeScanner, closeScanner } from './barcode-scanner.js';
import { decodeHTMLEntities, escapeHTML, getLocalDateString, showToast } from './utils.js';
import { getDailyCaloriesNorm, getLang, setLang, getItem, setItem } from './storage.js';
import { showConfirmModal } from './ui-components.js';

document.addEventListener('DOMContentLoaded', async () => {
  let currentSelectedDate = getLocalDateString();

  // ================== AUTH ==================
  await initAuth((event, user) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      loadMealsFromSupabase(currentSelectedDate);
      loadWaterFromSupabase(currentSelectedDate);
    }
  });

  // ================== LANGUAGE ==================
  let lang = getLang();

  const langSwitcher = document.getElementById('langSwitcher');
  if (langSwitcher) {
    langSwitcher.value = lang;
    langSwitcher.addEventListener('change', () => {
      lang = langSwitcher.value;
      setLang(lang);
      renderAllMeals();
      renderSummary();
    });
  }

  function t(key) {
    // норм. uk→ua (recipe-page вживає uk) + фолбек: lang → ua → сам ключ
    const l = lang === 'uk' ? 'ua' : lang;
    const dict = i18n[l] || i18n.ua;
    return dict?.[key] ?? i18n.ua?.[key] ?? key;
  }

  // ================== STATE ==================
  const mealsState = {
    breakfast: [],
    snack1: [],
    lunch: [],
    snack2: [],
    dinner: [],
  };

  let activeMealKey = null;
  let selectedFood = null;
  let editingIndex = null;

  const summaryValue = document.querySelector('.day-summary__value');
  const dayDateDisplay = document.getElementById('dayDate');

  // ================== DAILY NORM ==================
  const dailyNorm = getDailyCaloriesNorm();

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
    }
  }

  function copyDay() {
    const snapshot = JSON.parse(JSON.stringify(mealsState));
    const hasItems = Object.values(snapshot).some((arr) => arr.length > 0);
    if (!hasItems) {
      showToast(t('copyNoMeals'), 'info');
      return;
    }
    setItem('copied_day', snapshot);
    showToast(t('dayCopied'));
  }

  async function pasteDay() {
    if (!requireAuth()) return;

    const saved = getItem('copied_day');
    if (!saved) {
      showToast(t('noCopiedDay'), 'info');
      return;
    }

    const copiedMeals = typeof saved === 'string' ? JSON.parse(saved) : saved;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Видаляємо поточний день
    let deleteQuery = supabase.from('meals').delete().eq('date', currentSelectedDate);
    if (user) {
      deleteQuery = deleteQuery.eq('user_id', user.id);
    } else {
      deleteQuery = deleteQuery.is('user_id', null);
    }
    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      showToast(t('pasteError'), 'error');
      return;
    }

    // Вставляємо скопійовані страви
    const rows = [];
    Object.entries(copiedMeals).forEach(([mealType, items]) => {
      items.forEach((item) => {
        rows.push({
          meal_type: mealType,
          name: item.name,
          weight: item.weight,
          kcal: item.kcal,
          protein: item.protein,
          fat: item.fat,
          carbs: item.carbs,
          date: currentSelectedDate,
          user_id: user ? user.id : null,
        });
      });
    });

    if (rows.length === 0) {
      showToast(t('copiedDayEmpty'), 'info');
      return;
    }

    const { error: insertError } = await supabase.from('meals').insert(rows);
    if (!insertError) {
      await loadMealsFromSupabase(currentSelectedDate);
      showToast(t('dayPasted'));
    } else {
      showToast(t('pasteError'), 'error');
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
            ${Math.round(item.kcal)} ${t('kcal')} ·
            ${t('protein')} ${Math.round(item.protein)} ·
            ${t('fat')} ${Math.round(item.fat)} ·
            ${t('carbs')} ${Math.round(item.carbs)}
          </div>
        </div>
        <button class="meal__delete-btn" data-index="${index}">${iconTrash}</button>
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
      summaryValue.textContent = `${Math.round(total.kcal)} ${t('kcal')} · ${t('protein')} ${Math.round(total.protein)} · ${t('fat')} ${Math.round(total.fat)} · ${t('carbs')} ${Math.round(total.carbs)}`;
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
    showConfirmModal({
      title: t('deleteConfirmTitle'),
      confirmText: t('yes'),
      onConfirm: async () => {
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
          renderMeal(mealKey);
          renderSummary();
        }
      },
    });
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
  const scFiberInput = document.getElementById('scFiber');
  const scSugarInput = document.getElementById('scSugar');
  const scSaltInput = document.getElementById('scSalt');
  const scEditNameBtn = scannedCard?.querySelector('.scanned-card__edit-name');
  const scNameForm = scannedCard?.querySelector('.scanned-card__name-form');
  const scCorrectedName = document.getElementById('scCorrectedName');
  const scCorrectedBrand = document.getElementById('scCorrectedBrand');
  const scSaveNameCorrection = document.getElementById('scSaveNameCorrection');
  const scCancelNameCorrection = document.getElementById('scCancelNameCorrection');
  const scNameStatus = scannedCard?.querySelector('.scanned-card__name-status');

  function showScannedProductCard(product) {
    if (!scannedCard) return;

    const nameEl = scannedCard.querySelector('.scanned-card__name');
    const brandEl = scannedCard.querySelector('.scanned-card__brand');
    const clearBtn = scannedCard.querySelector('.scanned-card__clear');

    const displayName = decodeHTMLEntities(
      product._displayName || product.name_ua || product.name_en || product.name_pl || product.name || t('noName')
    );
    const displayBrand = decodeHTMLEntities(product.brand);

    nameEl.textContent = displayName;
    brandEl.textContent = displayBrand;

    if (scEditNameBtn) scEditNameBtn.hidden = !product.barcode;
    if (scNameForm) scNameForm.hidden = true;
    if (scCorrectedName) scCorrectedName.value = displayName;
    if (scCorrectedBrand) scCorrectedBrand.value = displayBrand;
    if (scNameStatus) {
      scNameStatus.hidden = !product._hasPersonalNameCorrection;
      scNameStatus.textContent = product._hasPersonalNameCorrection
        ? t('personalNameSaved')
        : '';
    }

    if (scEditNameBtn) {
      scEditNameBtn.onclick = () => {
        if (!scNameForm) return;
        scNameForm.hidden = false;
        scEditNameBtn.hidden = true;
        scCorrectedName?.focus();
        scCorrectedName?.select();
      };
    }

    if (scCancelNameCorrection) {
      scCancelNameCorrection.onclick = () => {
        if (scNameForm) scNameForm.hidden = true;
        if (scEditNameBtn) scEditNameBtn.hidden = false;
        if (scCorrectedName) scCorrectedName.value = displayName;
        if (scCorrectedBrand) scCorrectedBrand.value = displayBrand;
      };
    }

    if (scSaveNameCorrection) {
      scSaveNameCorrection.onclick = async () => {
        const proposedName = scCorrectedName?.value.trim() || '';
        const proposedBrand = scCorrectedBrand?.value.trim() || '';

        if (!proposedName) {
          if (scNameStatus) {
            scNameStatus.hidden = false;
            scNameStatus.textContent = t('enterCorrectProductName');
          }
          scCorrectedName?.focus();
          return;
        }

        scSaveNameCorrection.disabled = true;
        try {
          const correctionLanguage = getLang() === 'uk' ? 'ua' : getLang();
          const { error } = await supabase.rpc('submit_scanned_name_correction', {
            p_barcode: product.barcode,
            p_language: correctionLanguage,
            p_proposed_name: proposedName,
            p_proposed_brand: proposedBrand || null,
          });
          if (error) throw error;

          product._displayName = proposedName;
          product._hasPersonalNameCorrection = true;
          product._personalNameCorrectionStatus = 'pending';
          if (proposedBrand) product.brand = proposedBrand;
          if (selectedFood) {
            selectedFood._displayName = proposedName;
            selectedFood._hasPersonalNameCorrection = true;
            selectedFood.name = proposedName;
            if (proposedBrand) selectedFood.brand = proposedBrand;
          }

          nameEl.textContent = proposedName;
          brandEl.textContent = product.brand || '';
          nameInput.value = proposedName;
          if (scNameForm) scNameForm.hidden = true;
          if (scEditNameBtn) scEditNameBtn.hidden = false;
          if (scNameStatus) {
            scNameStatus.hidden = false;
            scNameStatus.textContent = t('nameCorrectionQueued');
          }
        } catch (error) {
          console.error('Не вдалося надіслати виправлення назви:', error);
          if (scNameStatus) {
            scNameStatus.hidden = false;
            scNameStatus.textContent = t('nameCorrectionSaveError');
          }
        } finally {
          scSaveNameCorrection.disabled = false;
        }
      };
    }

    // Заповнюємо інпути
    scKcalInput.value = product.kcal || 0;
    scProteinInput.value = product.protein || 0;
    scFatInput.value = product.fat || 0;
    scCarbsInput.value = product.carbs || 0;
    if (scFiberInput) scFiberInput.value = product.fiber || 0;
    if (scSugarInput) scSugarInput.value = product.sugar || 0;
    if (scSaltInput) scSaltInput.value = product.salt || 0;

    // Підказка: якщо показуємо збережену правку самого користувача
    const hintEl = scannedCard.querySelector('.scanned-card__hint');
    if (hintEl) {
      hintEl.textContent = product._hasPersonalCorrection
        ? t('savedValuesHint')
        : t('per100Hint');
    }

    scannedCard.hidden = false;

    // Слухачі для оновлення selectedFood при редагуванні
    const updateSelectedFood = () => {
      if (selectedFood) {
        selectedFood.kcal = Number(scKcalInput.value) || 0;
        selectedFood.protein = Number(scProteinInput.value) || 0;
        selectedFood.fat = Number(scFatInput.value) || 0;
        selectedFood.carbs = Number(scCarbsInput.value) || 0;
        selectedFood.fiber = Number(scFiberInput?.value) || 0;
        selectedFood.sugar = Number(scSugarInput?.value) || 0;
        selectedFood.salt = Number(scSaltInput?.value) || 0;
      }
    };

    scKcalInput.oninput = updateSelectedFood;
    scProteinInput.oninput = updateSelectedFood;
    scFatInput.oninput = updateSelectedFood;
    scCarbsInput.oninput = updateSelectedFood;
    if (scFiberInput) scFiberInput.oninput = updateSelectedFood;
    if (scSugarInput) scSugarInput.oninput = updateSelectedFood;
    if (scSaltInput) scSaltInput.oninput = updateSelectedFood;

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
      if (scFiberInput) scFiberInput.value = '';
      if (scSugarInput) scSugarInput.value = '';
      if (scSaltInput) scSaltInput.value = '';
      if (scNameForm) scNameForm.hidden = true;
      if (scNameStatus) {
        scNameStatus.hidden = true;
        scNameStatus.textContent = '';
      }
    }
  }

  // ================== MODAL LOGIC ==================
  function updateConfirmState() {
    const weight = Number(weightInput.value);
    confirmBtn.disabled = !(selectedFood && weight > 0);
  }

  function openModal(mealKey, item = null) {
    activeMealKey = mealKey;

    selectedFood = item
      ? {
          ...item,
          kcal: item.kcal / (item.weight / 100),
          protein: item.protein / (item.weight / 100),
          fat: item.fat / (item.weight / 100),
          carbs: item.carbs / (item.weight / 100),
        }
      : null;

    resultsList.innerHTML = '';
    confirmBtn.disabled = !item;

    nameInput.value = item ? item.name.replace(/\s\(.*?\)$/, '') : '';
    weightInput.value = item ? item.weight : '';

    // Ховаємо картку сканованого продукту при відкритті
    hideScannedProductCard();

    modal.classList.add('is-open');
    nameInput.focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
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
      // Не показуємо продукти, які не їдять сирими (raw_edible = 'never').
      // NULL (власні продукти без стану) лишаємо у видачі.
      .or('raw_edible.is.null,raw_edible.neq.never')
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
      .or('raw_edible.is.null,raw_edible.neq.never')
      .limit(20);

    if (user) {
      productsContainsQuery = productsContainsQuery.or(`user_id.is.null,user_id.eq.${user.id}`);
    } else {
      productsContainsQuery = productsContainsQuery.is('user_id', null);
    }

    const { data: productsContains } = await productsContainsQuery;

    // ========== 1b. ПОШУК У SCANNED_PRODUCTS ==========
    // Раніше скановані продукти (кеш Open Food Facts) — щоб не сканувати вдруге.
    const { data: scannedStartsWith } = await supabase
      .from('scanned_products')
      .select('*')
      .or(`name_ua.ilike.${query}%,name_en.ilike.${query}%,name_pl.ilike.${query}%`)
      .not('kcal', 'is', null)
      .limit(10);

    const { data: scannedContains } = await supabase
      .from('scanned_products')
      .select('*')
      .or(`name_ua.ilike.%${query}%,name_en.ilike.%${query}%,name_pl.ilike.%${query}%`)
      .not('kcal', 'is', null)
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

    // Скановані продукти — додаємо з позначкою сканера.
    // Дедуплікуємо за штрихкодом та назвою, щоб не дублювати те, що вже є в products.
    const seenScannedNames = new Set(
      allProducts.map((p) => (p.name_ua || p.name_en || p.name_pl || '').toLowerCase())
    );
    const seenScannedBarcodes = new Set(
      allProducts.map((p) => p.barcode).filter(Boolean)
    );

    [...(scannedStartsWith || []), ...(scannedContains || [])].forEach((p) => {
      const nameKey = (p.name_ua || p.name_en || p.name_pl || '').toLowerCase();
      if (!nameKey) return;
      if (p.barcode && seenScannedBarcodes.has(p.barcode)) return;
      if (seenScannedNames.has(nameKey)) return;
      seenScannedNames.add(nameKey);
      if (p.barcode) seenScannedBarcodes.add(p.barcode);
      allProducts.push({ ...p, _isScanned: true });
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
      headerProducts.textContent = t('searchProducts');
      resultsList.appendChild(headerProducts);

      topProducts.forEach((food) => {
        const li = createFoodItem(food, 'product');
        resultsList.appendChild(li);
      });
    }

    if (topRecipes.length > 0) {
      const headerRecipes = document.createElement('li');
      headerRecipes.className = 'modal__group-header';
      headerRecipes.textContent = t('searchDishes');
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
        <div>${t('nothingFound')}</div>
      `;
      resultsList.appendChild(emptyLi);
    }

    // Завжди показуємо кнопку "Створити продукт"
    const createBtn = document.createElement('li');
    createBtn.className = 'modal__item modal__item--create';
    createBtn.innerHTML = `
      <span>${iconPlus} ${t('createCustomProduct')}</span>
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

    const name = decodeHTMLEntities(food.name_ua || food.name_en || food.name_pl || food.name || '');
    const safeName = escapeHTML(name);
    const kcal = food.kcal || 0;
    const isOwn = food.user_id ? true : false;
    const isScanned = food._isScanned ? true : false;

    const scannedBadge = isScanned
      ? ` <span class="modal__badge modal__badge--scanned" title="${t('scannedProductTitle')}">${iconBarcode}</span>`
      : '';

    // Продукт, який зазвичай готують, але інколи їдять сирим → позначка "(сире)".
    const rawHint = type === 'product' && food.raw_edible === 'sometimes'
      ? ` <em class="modal__raw-hint">(${t('rawHint')})</em>`
      : '';

    li.innerHTML = `
      <div>
        <strong>${safeName}</strong>${rawHint}${isOwn ? ` <span class="modal__badge">${t('ownBadge')}</span>` : ''}${scannedBadge}
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
  const cpBrandInput = document.getElementById('cpBrand');
  const cpBrandField = document.getElementById('cpBrandField');
  const cpKcalInput = document.getElementById('cpKcal');
  const cpProteinInput = document.getElementById('cpProtein');
  const cpFatInput = document.getElementById('cpFat');
  const cpCarbsInput = document.getElementById('cpCarbs');
  const cpFiberInput = document.getElementById('cpFiber');
  const cpSugarInput = document.getElementById('cpSugar');
  const cpSaltInput = document.getElementById('cpSalt');

  // Флаг: чи користувач вручну редагував ккал
  let kcalManuallyEdited = false;
  let currentLabelType = 'EU';

  // Перемикач EU/US
  document.querySelectorAll('.modal__label-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal__label-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentLabelType = btn.dataset.label;
      autoCalculateKcal();
    });
  });

  // Авторахунок ккал: EU = Б×4 + Ж×9 + В×4 + Кл×2 / US = Б×4 + Ж×9 + В×4
  function autoCalculateKcal() {
    if (kcalManuallyEdited) return;

    const protein = Number(cpProteinInput?.value) || 0;
    const fat = Number(cpFatInput?.value) || 0;
    const carbs = Number(cpCarbsInput?.value) || 0;
    const fiber = Number(cpFiberInput?.value) || 0;

    const kcal = currentLabelType === 'EU'
      ? Math.round(protein * 4 + fat * 9 + carbs * 4 + fiber * 2)
      : Math.round(protein * 4 + fat * 9 + carbs * 4);

    if (cpKcalInput) {
      cpKcalInput.value = kcal > 0 ? kcal : '';
    }
  }

  // Слухачі для БЖВ+Кл — перераховують ккал
  if (cpProteinInput) cpProteinInput.addEventListener('input', autoCalculateKcal);
  if (cpFatInput)     cpFatInput.addEventListener('input', autoCalculateKcal);
  if (cpCarbsInput)   cpCarbsInput.addEventListener('input', autoCalculateKcal);
  if (cpFiberInput)   cpFiberInput.addEventListener('input', autoCalculateKcal);

  // Якщо користувач клікнув на поле ккал і почав вводити — вимикаємо авторахунок
  if (cpKcalInput) {
    cpKcalInput.addEventListener('input', () => {
      kcalManuallyEdited = true;
    });
  }

  let _pendingBarcode = null;

  function openCreateProductModal(prefillName = '', barcode = null, prefillBrand = '') {
    if (!createProductModal) return;

    kcalManuallyEdited = false;
    currentLabelType = 'EU';
    _pendingBarcode = barcode;

    cpNameInput.value = prefillName;
    // Бренд лише для продуктів зі штрихкодом (scanned_products); сирі products його не мають
    if (cpBrandField) cpBrandField.hidden = !barcode;
    if (cpBrandInput) cpBrandInput.value = prefillBrand;
    cpKcalInput.value = '';
    cpProteinInput.value = '';
    cpFatInput.value = '';
    cpCarbsInput.value = '';
    if (cpFiberInput) cpFiberInput.value = '';
    if (cpSugarInput) cpSugarInput.value = '';
    if (cpSaltInput) cpSaltInput.value = '';

    document.querySelectorAll('.modal__label-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.label === 'EU');
    });

    createProductModal.classList.add('is-open');
    cpNameInput.focus();
  }

  function closeCreateProductModal() {
    if (!createProductModal) return;
    createProductModal.classList.remove('is-open');
    _pendingBarcode = null;
  }

  async function saveCustomProduct() {
    if (!requireAuth()) return;

    const name = cpNameInput.value.trim();
    const brand = cpBrandInput?.value.trim() || null;
    const kcal = Number(cpKcalInput.value) || 0;
    const protein = Number(cpProteinInput.value) || 0;
    const fat = Number(cpFatInput.value) || 0;
    const carbs = Number(cpCarbsInput.value) || 0;
    const fiber = Number(cpFiberInput?.value) || 0;
    const sugar = Number(cpSugarInput?.value) || 0;
    const salt = Number(cpSaltInput?.value) || 0;
    const label_type = currentLabelType;

    if (!name) {
      alert(t('enterProductName'));
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let savedProduct;

    if (_pendingBarcode) {
      // Barcode-originated manual entry → save to scanned_products (no moderation needed)
      const { data, error } = await supabase
        .from('scanned_products')
        .upsert([{ barcode: _pendingBarcode, name_ua: name, brand, kcal, protein, fat, carbs, fiber, sugar, salt, label_type, source: 'manual' }], {
          onConflict: 'barcode',
        })
        .select()
        .single();

      if (error) {
        console.error('Помилка збереження:', error);
        alert(t('saveError'));
        return;
      }
      savedProduct = { ...data, name: data.name_ua };
    } else {
      // Regular manual product creation → save to products (goes through moderation)
      const { data, error } = await supabase
        .from('products')
        .insert([{ name_ua: name, kcal, protein, fat, carbs, fiber, sugar, salt, label_type, user_id: user.id, is_verified: false }])
        .select()
        .single();

      if (error) {
        console.error('Помилка збереження:', error);
        alert(t('saveError'));
        return;
      }
      savedProduct = { ...data, name: data.name_ua };
    }

    _pendingBarcode = null;

    selectedFood = { ...savedProduct, source: 'product' };
    nameInput.value = savedProduct.name;
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

  // Якщо користувач відредагував КБЖУ сканованого продукту — зберігаємо
  // ОСОБИСТУ правку (не чіпаємо спільну scanned_products). Пишемо лише
  // коли значення реально відрізняються від канонічних.
  async function maybeSaveBarcodeCorrection(food, user) {
    if (!user || !food || food.source !== 'barcode' || !food.barcode) return;

    const canon = food._canonical;
    if (!canon) return;

    const keys = ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'salt'];
    const current = {};
    keys.forEach((k) => {
      current[k] = Number(food[k]) || 0;
    });

    const changed = keys.some((k) => Math.abs(current[k] - (Number(canon[k]) || 0)) > 0.05);
    if (!changed) return;

    try {
      await supabase
        .from('scanned_product_corrections')
        .upsert([{ barcode: food.barcode, user_id: user.id, ...current, updated_at: new Date().toISOString() }], {
          onConflict: 'barcode,user_id',
        });
    } catch (err) {
      console.warn('Не вдалося зберегти правку продукту:', err);
    }
  }

  async function addSelectedFood() {
    if (!requireAuth()) return;
    if (!activeMealKey || !selectedFood) return;

    const grams = Number(weightInput.value);
    if (grams <= 0) return;

    const factor = grams / 100;
    const gramsLabel = t('gramsLabel');
    const baseName = nameInput.value.trim() || selectedFood.name;

    const newItem = {
      name: `${baseName} (${grams} ${gramsLabel})`,
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

    let error;

    if (editingIndex !== null && selectedFood.id) {
      let query = supabase.from('meals').update(payload).eq('id', selectedFood.id);
      if (user) {
        query = query.eq('user_id', user.id);
      } else {
        query = query.is('user_id', null);
      }
      ({ error } = await query);
    } else {
      ({ error } = await supabase.from('meals').insert([payload]));
    }

    if (!error) {
      await maybeSaveBarcodeCorrection(selectedFood, user);
      closeModal();
      await loadMealsFromSupabase(currentSelectedDate);
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

        // Хвилеподібна анімація стовпчика.
        // Щоб вимкнути — просто видали цей блок.
        const fill = document.getElementById('waterFill');
        if (fill) {
          fill.classList.remove('water-meter__fill--ripple');
          requestAnimationFrame(() => fill.classList.add('water-meter__fill--ripple'));
          fill.addEventListener('animationend', () => fill.classList.remove('water-meter__fill--ripple'), { once: true });
        }
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

  const copyBtn = document.getElementById('copyDayBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyDay);
  }

  const insertBtn = document.getElementById('insertDayBtn');
  if (insertBtn) {
    insertBtn.addEventListener('click', pasteDay);
  }

  const clearBtn = document.getElementById('clearDayBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearDay);
  }

  // ================== 3-КРАПКИ МЕНЮ ==================

  const menuActionsBtn = document.getElementById('menuActionsBtn');
  const menuActionsDropdown = document.getElementById('menuActionsDropdown');

  function closeActionsMenu() {
    menuActionsDropdown?.classList.remove('is-open');
    menuActionsBtn?.classList.remove('is-open');
  }

  if (menuActionsBtn && menuActionsDropdown) {
    menuActionsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menuActionsDropdown.classList.toggle('is-open');
      menuActionsBtn.classList.toggle('is-open', isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!menuActionsBtn.contains(e.target) && !menuActionsDropdown.contains(e.target)) {
        closeActionsMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeActionsMenu();
    });
  }

  const copyMenuBtn = document.getElementById('copyDayMenuBtn');
  if (copyMenuBtn) {
    copyMenuBtn.addEventListener('click', () => { closeActionsMenu(); copyDay(); });
  }

  const insertMenuBtn = document.getElementById('insertDayMenuBtn');
  if (insertMenuBtn) {
    insertMenuBtn.addEventListener('click', () => { closeActionsMenu(); pasteDay(); });
  }

  const clearMenuBtn = document.getElementById('clearDayMenuBtn');
  if (clearMenuBtn) {
    clearMenuBtn.addEventListener('click', () => {
      closeActionsMenu();
      showConfirmModal({
        title: t('clearDayConfirmTitle'),
        confirmText: t('yes'),
        onConfirm: clearDay,
      });
    });
  }

  // ================== INIT ==================

  // Ініціалізація сканера штрих-кодів
  initBarcodeScanner((product) => {
    selectedFood = {
      ...product,
      name: product._displayName || product.name_ua || product.name_en || product.name_pl || product.name,
      source: 'barcode',
    };

    nameInput.value = selectedFood.name;
    resultsList.innerHTML = '';

    // Показуємо картку сканованого продукту з КБЖУ
    showScannedProductCard(product);

    updateConfirmState();
    weightInput.focus();
  });

  document.addEventListener('scanner:manualEntry', (e) => {
    openCreateProductModal(e.detail?.name || '', e.detail?.barcode || null, e.detail?.brand || '');
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
