import { supabase } from './supabaseClient.js';
import { i18n } from './i18n.js';
import { initRecipeModal, openRecipeModal } from './recipe-modal.js';
import { initAuth, requireAuth } from './auth.js';
import { showToast, getLocalDateString, pluralUA, convertToBaseUnit } from './utils.js';
import { showLoading, showEmpty, showConfirmModal } from './ui-components.js';
import { getLang, setLang, saveWeekShoppingList, setItem, getItem } from './storage.js';
import { getRecipeDisplayName } from './recipe-utils.js';
import { iconMoreVertical, iconPlus, iconAlert, iconBookOpen, iconGlobe, iconClose } from './icons.js';

document.addEventListener('DOMContentLoaded', async () => {
  // ================== МОВА ==================
  let lang = getLang();

  const langSwitcher = document.getElementById('langSwitcher');
  if (langSwitcher) {
    langSwitcher.value = lang;
    langSwitcher.addEventListener('change', () => {
      lang = langSwitcher.value;
      setLang(lang);
      renderAllCells();
      updateWeekLabel();
    });
  }

  function t(key) {
    return i18n[lang]?.[key] || key;
  }

  function formatText(key, vars = {}) {
    return Object.entries(vars).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      t(key),
    );
  }

  function getMacroLetter(type) {
    if (type === 'protein') return t('proteinLetter');
    if (type === 'fat') return t('fatLetter');
    return t('carbsLetter');
  }

  function getMealWord(count) {
    if (lang === 'en') return count === 1 ? t('mealSingle') : t('mealMany');
    if (lang === 'pl') return pluralUA(count, [t('mealSingle'), t('mealFew'), t('mealMany')]);
    return pluralUA(count, [t('mealSingle'), t('mealFew'), t('mealMany')]);
  }

  function getProductWord(count) {
    if (lang === 'en') return count === 1 ? t('productSingle') : t('productMany');
    if (lang === 'pl') {
      return pluralUA(count, [t('productSingle'), t('productFew'), t('productMany')]);
    }
    return pluralUA(count, [t('productSingle'), t('productFew'), t('productMany')]);
  }

  function cleanName(name) {
    if (!name) return '';
    return name
      .replace(/рецепт:?/gi, '')
      .replace(/recipe:?/gi, '')
      .trim()
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  function getRecipeName(recipe) {
    return cleanName(getRecipeDisplayName(recipe, lang));
  }

  // ================== СТАН ==================
  // weekMealsState: { "monday": { "breakfast": [...], "snack1": [...], ... }, ... }
  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const MEAL_TYPES = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];

  let weekMealsState = {};
  DAYS.forEach((day) => {
    weekMealsState[day] = {};
    MEAL_TYPES.forEach((meal) => {
      weekMealsState[day][meal] = [];
    });
  });

  // Поточний тиждень — дата понеділка
  let currentWeekStart = getMonday(new Date());

  // ================== ДАТА ХЕЛПЕРИ ==================

  function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function getWeekDates(mondayDate) {
    return DAYS.map((_, i) => addDays(mondayDate, i));
  }

  // ================== НАВІГАЦІЯ ==================

  const prevWeekBtn = document.getElementById('prevWeek');
  const nextWeekBtn = document.getElementById('nextWeek');

  function updateWeekLabel() {
    const locale = lang === 'ua' ? 'uk-UA' : lang === 'pl' ? 'pl-PL' : 'en-US';
    const dates7 = getWeekDates(currentWeekStart);
    const todayStr = new Date().toDateString();

    DAYS.forEach((day, i) => {
      const row = document.querySelector(`.week-grid__row[data-day="${day}"]`);
      const dateEl = row?.querySelector('.week-grid__day-date');
      const abbrEl = row?.querySelector('.week-grid__day-abbr');
      if (dateEl) {
        dateEl.textContent = dates7[i].getDate();
      }
      if (abbrEl) {
        const raw = dates7[i].toLocaleDateString(locale, { weekday: 'short' });
        abbrEl.textContent = raw.charAt(0).toUpperCase() + raw.slice(1).replace('.', '');
      }
      if (row) {
        row.classList.toggle('week-grid__row--today', dates7[i].toDateString() === todayStr);
      }
    });
  }

  if (prevWeekBtn) {
    prevWeekBtn.addEventListener('click', () => {
      currentWeekStart = addDays(currentWeekStart, -7);
      loadWeekFromSupabase();
    });
  }

  if (nextWeekBtn) {
    nextWeekBtn.addEventListener('click', () => {
      currentWeekStart = addDays(currentWeekStart, 7);
      loadWeekFromSupabase();
    });
  }

  // ================== ЗАВАНТАЖЕННЯ З SUPABASE ==================

  async function loadWeekFromSupabase() {
    const weekStartStr = getLocalDateString(currentWeekStart);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase.from('week_meals').select('*').eq('week_start', weekStartStr);

    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error(t('weekLoadError'), error);
      return;
    }

    // Очищаємо стан
    DAYS.forEach((day) => {
      weekMealsState[day] = {};
      MEAL_TYPES.forEach((meal) => {
        weekMealsState[day][meal] = [];
      });
    });

    if (data) {
      data.forEach((item) => {
        if (weekMealsState[item.day] && weekMealsState[item.day][item.meal_type] !== undefined) {
          weekMealsState[item.day][item.meal_type].push({
            id: item.id,
            recipe_id: item.recipe_id,
            name: item.name,
            kcal: item.kcal || 0,
            protein: item.protein || 0,
            fat: item.fat || 0,
            carbs: item.carbs || 0,
          });
        }
      });
    }

    updateWeekLabel();
    renderAllCells();
  }

  // ================== РЕНДЕР ==================

  function renderAllCells() {
    DAYS.forEach((day) => {
      MEAL_TYPES.forEach((meal) => {
        renderCell(day, meal);
      });
      renderDaySummary(day);
    });
    renderMobileView();
  }

  function renderCell(day, mealType) {
    const cell = document.querySelector(
      `.week-grid__row[data-day="${day}"] .meal-cell[data-meal="${mealType}"]`,
    );
    if (!cell) return;

    const list = cell.querySelector('.meal-cell__list');
    if (!list) return;

    list.innerHTML = '';

    const items = weekMealsState[day][mealType] || [];

    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'meal-cell__item';
      li.draggable = true;
      li.dataset.id = item.id;
      li.dataset.day = day;
      li.dataset.meal = mealType;

      // Прибираємо слово "Рецепт" з початку назви
      const cleanItemName = cleanName(item.name);

      li.innerHTML = `
      <span class="meal-cell__item-name" title="${cleanItemName}">${cleanItemName}</span>
        <button class="meal-cell__item-delete" title="${t('delete')}">${iconClose}</button>
    `;

      // Клік на назву — відкрити картку рецепта
      li.querySelector('.meal-cell__item-name').addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.recipe_id) {
          window.location.href = `recipes.html?recipe=${item.recipe_id}&from=week-menu`;
        }
      });

      // Видалення
      li.querySelector('.meal-cell__item-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteConfirm(item.id, day, mealType);
      });

      // Drag & Drop
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, day, mealType, item }));
        li.classList.add('dragging');
      });

      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
      });

      list.appendChild(li);
    });
  }

  function renderDaySummary(day) {
    const row = document.querySelector(`.week-grid__row[data-day="${day}"]`);
    if (!row) return;

    const summaryCell = row.querySelector('.week-grid__cell--summary');
    if (!summaryCell) return;

    const allItems = MEAL_TYPES.flatMap((meal) => weekMealsState[day][meal] || []);

    const total = allItems.reduce(
      (acc, item) => {
        acc.kcal += Number(item.kcal) || 0;
        acc.protein += Number(item.protein) || 0;
        acc.fat += Number(item.fat) || 0;
        acc.carbs += Number(item.carbs) || 0;
        return acc;
      },
      { kcal: 0, protein: 0, fat: 0, carbs: 0 },
    );

    // Баланс БЖВ: норма 30% / 30% / 40% з допуском ±3%
    const TOLERANCE = 3;
    const totalMacroKcal = total.protein * 4 + total.fat * 9 + total.carbs * 4;

    if (totalMacroKcal === 0) {
      summaryCell.innerHTML = `
        <div class="summary-balance summary-balance--empty">
          <div class="balance-bar"><div class="balance-bar__label">${t('proteinLetter')}</div>
            <div class="balance-bar__track" style="--target: 30%"><div class="balance-bar__fill" style="width: 0%"></div></div>
            <div class="balance-bar__pct">—</div>
          </div>
          <div class="balance-bar"><div class="balance-bar__label">${t('fatLetter')}</div>
            <div class="balance-bar__track" style="--target: 30%"><div class="balance-bar__fill" style="width: 0%"></div></div>
            <div class="balance-bar__pct">—</div>
          </div>
          <div class="balance-bar"><div class="balance-bar__label">${t('carbsLetter')}</div>
            <div class="balance-bar__track" style="--target: 40%"><div class="balance-bar__fill" style="width: 0%"></div></div>
            <div class="balance-bar__pct">—</div>
          </div>
        </div>
      `;
      return;
    }

    const proteinPct = Math.round(((total.protein * 4) / totalMacroKcal) * 100);
    const fatPct = Math.round(((total.fat * 9) / totalMacroKcal) * 100);
    const carbsPct = Math.round(((total.carbs * 4) / totalMacroKcal) * 100);

    const getStatus = (actual, ideal) => {
      const diff = actual - ideal;
      if (Math.abs(diff) <= TOLERANCE) return 'ok';
      return diff > 0 ? 'over' : 'under';
    };

    const proteinStatus = getStatus(proteinPct, 30);
    const fatStatus = getStatus(fatPct, 30);
    const carbsStatus = getStatus(carbsPct, 40);

    const renderBar = (label, pct, target, status, type) => `
      <div class="balance-bar" data-status="${status}">
        <div class="balance-bar__label">${label}</div>
        <div class="balance-bar__track" style="--target: ${target}%">
          <div class="balance-bar__fill balance-bar__fill--${type}" style="width: ${pct}%"></div>
        </div>
        <div class="balance-bar__pct">${pct}%</div>
      </div>
    `;

    summaryCell.innerHTML = `
      <div class="summary-balance">
        ${renderBar(getMacroLetter('protein'), proteinPct, 30, proteinStatus, 'protein')}
        ${renderBar(getMacroLetter('fat'), fatPct, 30, fatStatus, 'fat')}
        ${renderBar(getMacroLetter('carbs'), carbsPct, 40, carbsStatus, 'carbs')}
      </div>
    `;
  }

  // ================== DRAG & DROP ==================

  function initDragAndDrop() {
    document.querySelectorAll('.meal-cell').forEach((cell) => {
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        cell.classList.add('drag-over');
      });

      cell.addEventListener('dragleave', () => {
        cell.classList.remove('drag-over');
      });

      cell.addEventListener('drop', async (e) => {
        e.preventDefault();
        cell.classList.remove('drag-over');

        let dragData;
        try {
          dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
        } catch {
          return;
        }

        const targetDay = cell.closest('.week-grid__row')?.dataset.day;
        const targetMeal = cell.dataset.meal;

        if (!targetDay || !targetMeal) return;

        // Якщо кидаємо в ту саму клітинку — нічого не робимо
        if (dragData.day === targetDay && dragData.mealType === targetMeal) return;

        // Копіюємо страву в нову клітинку
        await addMealToCell(targetDay, targetMeal, {
          recipe_id: dragData.item.recipe_id,
          name: dragData.item.name,
          kcal: dragData.item.kcal,
          protein: dragData.item.protein,
          fat: dragData.item.fat,
          carbs: dragData.item.carbs,
        });
      });
    });
  }

  // ================== ДОДАВАННЯ СТРАВИ ==================

  async function addMealToCell(day, mealType, mealData) {
    const weekStartStr = getLocalDateString(currentWeekStart);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      user_id: user ? user.id : null,
      week_start: weekStartStr,
      day: day,
      meal_type: mealType,
      recipe_id: mealData.recipe_id || null,
      name: mealData.name,
      kcal: mealData.kcal || 0,
      protein: mealData.protein || 0,
      fat: mealData.fat || 0,
      carbs: mealData.carbs || 0,
    };

    const { data, error } = await supabase.from('week_meals').insert([payload]).select().single();

    if (error) {
      console.error(t('mealAddError'), error);
      return;
    }

    weekMealsState[day][mealType].push({
      id: data.id,
      recipe_id: data.recipe_id,
      name: data.name,
      kcal: data.kcal || 0,
      protein: data.protein || 0,
      fat: data.fat || 0,
      carbs: data.carbs || 0,
    });

    renderCell(day, mealType);
    renderDaySummary(day);
    renderMobileView();
  }

  // ================== ВИДАЛЕННЯ ==================

  function openDeleteConfirm(id, day, mealType) {
    showConfirmModal({
      title: t('deleteMealTitle'),
      confirmText: t('confirmDelete'),
      onConfirm: async () => {
        const { error } = await supabase.from('week_meals').delete().eq('id', id);
        if (!error) {
          weekMealsState[day][mealType] = weekMealsState[day][mealType].filter(
            (item) => item.id !== id,
          );
          renderCell(day, mealType);
          renderDaySummary(day);
          renderMobileView();
        }
      },
    });
  }

  // ================== МОДАЛЬНЕ ВІКНО ДОДАВАННЯ ==================

  const addModal = document.getElementById('weekAddModal');
  const addModalOverlay = addModal?.querySelector('.modal__overlay');
  const addModalClose = addModal?.querySelector('.modal__close');

  let activeDay = null;
  let activeMealType = null;

  function openAddModal(day, mealType) {
    activeDay = day;
    activeMealType = mealType;

    if (addModal) {
      addModal.classList.add('is-open');
      resetModalState();
      searchAllRecipes('');

      // Підключаємо кнопку "Створити рецепт" (статична в HTML)
      const createBtn = addModal.querySelector('#weekCreateRecipeBtn');
      if (createBtn) {
        createBtn.onclick = () => {
          const targetDay = activeDay;
          const targetMealType = activeMealType;
          closeAddModal();
          openRecipeModal((savedRecipe) => {
            openAddModal(targetDay, targetMealType);
            const searchEl = addModal?.querySelector('#weekUnifiedSearch');
            if (searchEl && savedRecipe) {
              const name = getRecipeDisplayName(savedRecipe, lang);
              searchEl.value = name;
              searchAllRecipes(name);
            }
          });
        };
      }
    }
  }

  function closeAddModal() {
    if (addModal) addModal.classList.remove('is-open');
    activeDay = null;
    activeMealType = null;
    resetModalState();
  }

  if (addModalOverlay) addModalOverlay.addEventListener('click', closeAddModal);
  if (addModalClose) addModalClose.addEventListener('click', closeAddModal);

  function resetModalState() {
    const searchInput = addModal?.querySelector('#weekUnifiedSearch');
    if (searchInput) searchInput.value = '';

    const resultsEl = addModal?.querySelector('#weekUnifiedResults');
    if (resultsEl) resultsEl.innerHTML = '';
  }

  // ================== ЄДИНИЙ ПОШУК ==================

  const weekUnifiedSearch = addModal?.querySelector('#weekUnifiedSearch');
  let searchTimeout = null;

  if (weekUnifiedSearch) {
    weekUnifiedSearch.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchAllRecipes(weekUnifiedSearch.value.trim());
      }, 300);
    });
  }

  async function searchAllRecipes(query) {
    const resultsEl = addModal?.querySelector('#weekUnifiedResults');
    if (!resultsEl) return;

    showLoading(resultsEl);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const searchFilter = query
      ? `name_ua.ilike.%${query}%,name_en.ilike.%${query}%,name_pl.ilike.%${query}%`
      : null;

    const sharedQuery = supabase.from('recipes').select('*').eq('status', 'published').limit(50);

    const [sharedResponse, savedLinksResponse] = await Promise.all([
      searchFilter ? sharedQuery.or(searchFilter) : sharedQuery,
      user
        ? supabase
            .from('cookbook_recipes')
            .select('recipe_id, cookbooks!inner(user_id)')
            .eq('cookbooks.user_id', user.id)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (sharedResponse.error || savedLinksResponse.error) {
      showEmpty(resultsEl, iconAlert, t('weekLoadError'));
      return;
    }

    const savedRecipeIds = [
      ...new Set((savedLinksResponse.data || []).map((entry) => entry.recipe_id).filter(Boolean)),
    ];

    let savedRecipes = [];
    if (savedRecipeIds.length > 0) {
      let savedQuery = supabase.from('recipes').select('*').in('id', savedRecipeIds).limit(50);
      if (searchFilter) {
        savedQuery = savedQuery.or(searchFilter);
      }

      const { data: savedData, error: savedError } = await savedQuery;
      if (savedError) {
        showEmpty(resultsEl, iconAlert, t('weekLoadError'));
        return;
      }

      savedRecipes = savedData || [];
    }

    const sharedRecipes = (sharedResponse.data || []).filter(
      (recipe) => !savedRecipeIds.includes(recipe.id),
    );

    if (savedRecipes.length === 0 && sharedRecipes.length === 0) {
      renderEmptyState(resultsEl, query);
      return;
    }

    resultsEl.innerHTML = '';

    if (savedRecipes.length > 0) {
      const section = document.createElement('div');
      section.className = 'week-modal__section';
      section.innerHTML = `<p class="week-modal__section-title">${iconBookOpen} ${t('myBooks')}</p>`;
      savedRecipes.forEach((recipe) => {
        section.appendChild(createRecipeResultItem(recipe));
      });
      resultsEl.appendChild(section);
    }

    if (sharedRecipes.length > 0) {
      const section = document.createElement('div');
      section.className = 'week-modal__section';
      section.innerHTML = `<p class="week-modal__section-title">${iconGlobe} ${t('communityBase')}</p>`;
      sharedRecipes.forEach((recipe) => {
        section.appendChild(createRecipeResultItem(recipe));
      });
      resultsEl.appendChild(section);
    }
  }

  function createRecipeResultItem(recipe) {
    const name = getRecipeName(recipe);
    const item = document.createElement('div');
    item.className = 'week-modal__result-item';
    item.innerHTML = `
      <div class="week-modal__result-info">
        <span class="week-modal__result-name">${name}</span>
        <span class="week-modal__result-kcal">${recipe.kcal || 0} ${t('kcalShort')} · ${t('proteinLetter')}${recipe.protein || 0} ${t('fatLetter')}${recipe.fat || 0} ${t('carbsLetter')}${recipe.carbs || 0}</span>
      </div>
      <button class="week-modal__result-add">+</button>
    `;

    item.querySelector('.week-modal__result-add').addEventListener('click', async () => {
      await addMealToCell(activeDay, activeMealType, {
        recipe_id: recipe.id,
        name: name,
        kcal: recipe.kcal || 0,
        protein: recipe.protein || 0,
        fat: recipe.fat || 0,
        carbs: recipe.carbs || 0,
      });
      closeAddModal();
    });

    return item;
  }

  function renderEmptyState(container, query) {
    container.innerHTML = '';

    if (query) {
      const msg = document.createElement('p');
      msg.className = 'week-modal__empty';
      msg.textContent = formatText('searchNoResults', { query });
      container.appendChild(msg);
    }
  }

  // ================== КНОПКИ "+" В КЛІТИНКАХ ==================

  document.querySelectorAll('.meal-cell__add').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cell = btn.closest('.meal-cell');
      const row = btn.closest('.week-grid__row');
      if (!cell || !row) return;

      const mealType = cell.dataset.meal;
      const day = row.dataset.day;
      if (!mealType || !day) return;

      openAddModal(day, mealType);
      // Завантажуємо рецепти одразу
      searchAllRecipes('');
    });
  });

  // ================== СПИСОК ПОКУПОК ==================

  const shoppingBtn = document.getElementById('weekToShoppingBtn');

  if (shoppingBtn) {
    shoppingBtn.addEventListener('click', async () => {
      await exportToShoppingList();
    });
  }

  async function exportToShoppingList() {
    // Збираємо всі recipe_id з поточного тижня
    const recipeIds = [];

    DAYS.forEach((day) => {
      MEAL_TYPES.forEach((meal) => {
        weekMealsState[day][meal].forEach((item) => {
          if (item.recipe_id && !recipeIds.includes(item.recipe_id)) {
            recipeIds.push(item.recipe_id);
          }
        });
      });
    });

    if (recipeIds.length === 0) {
      showToast(t('noRecipesForShopping'), 'info');
      return;
    }

    // Завантажуємо інгредієнти через product_recipe
    const { data: productRecipes, error } = await supabase
      .from('product_recipe')
      .select('amount, unit, ingredient_id, products(id, name_ua, name_en, name_pl), recipe_id')
      .in('recipe_id', recipeIds);

    if (error) {
      console.error(t('shoppingBuildError'), error);
      showToast(t('shoppingBuildError'), 'error');
      return;
    }

    // Групуємо інгредієнти
    const grouped = {};

    (productRecipes || []).forEach((pr) => {
      const productName =
        lang === 'pl'
          ? pr.products?.name_pl
          : lang === 'en'
            ? pr.products?.name_en
            : pr.products?.name_ua;

      if (!productName) return;

      // Конвертуємо кг → г, л → мл для правильного підсумовування
      const converted = convertToBaseUnit(parseFloat(pr.amount) || 0, pr.unit || 'шт');
      const amount = converted.amount;
      const unit = converted.unit;

      const key = `${productName}__${unit}`;

      if (grouped[key]) {
        grouped[key].amount += amount;
      } else {
        grouped[key] = {
          product_id: pr.products?.id,
          name: productName,
          amount,
          unit,
        };
      }
    });

    const shoppingList = Object.values(grouped);

    saveWeekShoppingList(shoppingList);

    showToast(
      formatText('shoppingBuilt', {
        count: shoppingList.length,
        word: getProductWord(shoppingList.length),
      }),
    );
  }

  // ================== КОПІЮВАННЯ ТИЖНЯ ==================

  const copyWeekBtn = document.getElementById('copyWeekBtn');
  const pasteWeekBtn = document.getElementById('pasteWeekBtn');

  if (copyWeekBtn) {
    copyWeekBtn.addEventListener('click', () => {
      const snapshot = JSON.parse(JSON.stringify(weekMealsState));
      setItem('copied_week', snapshot);
      showToast(t('weekCopied'));
    });
  }

  if (pasteWeekBtn) {
    pasteWeekBtn.addEventListener('click', async () => {
      const saved = getItem('copied_week');
      if (!saved) {
        showToast(t('noCopiedWeek'), 'info');
        return;
      }

      const copiedState = typeof saved === 'string' ? JSON.parse(saved) : saved;
      const weekStartStr = getLocalDateString(currentWeekStart);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Видаляємо поточний тиждень
      let deleteQuery = supabase.from('week_meals').delete().eq('week_start', weekStartStr);
      if (user) {
        deleteQuery = deleteQuery.eq('user_id', user.id);
      } else {
        deleteQuery = deleteQuery.is('user_id', null);
      }
      await deleteQuery;

      // Вставляємо скопійований тиждень
      const rows = [];
      DAYS.forEach((day) => {
        MEAL_TYPES.forEach((meal) => {
          (copiedState[day]?.[meal] || []).forEach((item) => {
            rows.push({
              user_id: user ? user.id : null,
              week_start: weekStartStr,
              day,
              meal_type: meal,
              recipe_id: item.recipe_id || null,
              name: item.name,
              kcal: item.kcal || 0,
              protein: item.protein || 0,
              fat: item.fat || 0,
              carbs: item.carbs || 0,
            });
          });
        });
      });

      if (rows.length > 0) {
        const { error } = await supabase.from('week_meals').insert(rows);
        if (error) {
          console.error(t('weekPasteError'), error);
          showToast(t('weekPasteError'), 'error');
          return;
        }
      }

      showToast(t('weekPasted'));
      loadWeekFromSupabase();
    });
  }

  // ================== ОЧИЩЕННЯ ТИЖНЯ ==================

  const clearWeekBtn = document.getElementById('clearWeekBtn');

  if (clearWeekBtn) {
    clearWeekBtn.addEventListener('click', () => {
      showConfirmModal({
        title: t('clearWeekTitle'),
        message: t('clearWeekMessage'),
        confirmText: t('clearWeekConfirm'),
        onConfirm: async () => {
          const weekStartStr = getLocalDateString(currentWeekStart);
          const {
            data: { user },
          } = await supabase.auth.getUser();

          let query = supabase.from('week_meals').delete().eq('week_start', weekStartStr);
          if (user) {
            query = query.eq('user_id', user.id);
          } else {
            query = query.is('user_id', null);
          }

          const { error } = await query;
          if (!error) {
            DAYS.forEach((day) => {
              MEAL_TYPES.forEach((meal) => {
                weekMealsState[day][meal] = [];
              });
            });
            renderAllCells();
            showToast(t('weekCleared'));
          }
        },
      });
    });
  }

  // ================== МОБІЛЬНИЙ ВИГЛЯД ==================

  function renderMobileView() {
    const mobileView = document.getElementById('weekMobileView');
    if (!mobileView) return;

    const weekDates = getWeekDates(currentWeekStart);
    const todayStr = new Date().toDateString();
    const locale = lang === 'ua' ? 'uk-UA' : lang === 'pl' ? 'pl-PL' : 'en-US';

    mobileView.innerHTML = '';

    // Precompute per-day info
    const dayInfo = DAYS.map((day, i) => {
      const date = weekDates[i];
      const isToday = date.toDateString() === todayStr;
      const rawAbbr = date.toLocaleDateString(locale, { weekday: 'short' });
      const abbr = (rawAbbr.charAt(0).toUpperCase() + rawAbbr.slice(1)).replace('.', '');
      return { day, date, isToday, abbr };
    });

    let activeDayIdx = dayInfo.findIndex((d) => d.isToday);
    if (activeDayIdx === -1) activeDayIdx = 0;

    // ── PILLS ДНІВ (всі 7 в ряд, без стрілок) ────────────────────────────────
    const pillsEl = document.createElement('div');
    pillsEl.className = 'week-mobile__day-pills';

    dayInfo.forEach(({ date, abbr }, i) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'week-mobile__pill';
      pill.dataset.idx = i;
      if (i === activeDayIdx) pill.setAttribute('aria-current', 'true');
      pill.innerHTML = `<span class="week-mobile__pill-abbr">${abbr}</span><span class="week-mobile__pill-num">${date.getDate()}</span>`;
      pillsEl.appendChild(pill);
    });

    mobileView.appendChild(pillsEl);

    let swipeStartX = 0;
    mobileView.addEventListener(
      'touchstart',
      (e) => {
        swipeStartX = e.touches[0].clientX;
      },
      { passive: true },
    );
    mobileView.addEventListener(
      'touchend',
      (e) => {
        const dx = e.changedTouches[0].clientX - swipeStartX;
        if (Math.abs(dx) > 60) {
          currentWeekStart = addDays(currentWeekStart, dx < 0 ? 7 : -7);
          loadWeekFromSupabase();
        }
      },
      { passive: true },
    );

    // ── ТУЛБАР ───────────────────────────────────────────────────────────────
    const toolbarEl = document.createElement('div');
    toolbarEl.className = 'week-mobile__toolbar';
    toolbarEl.innerHTML = `
      <div class="week-mobile__toggle-group">
        <button type="button" class="week-mobile__toggle-btn week-mobile__toggle-btn--active" data-view="day">${t('dayView')}</button>
        <button type="button" class="week-mobile__toggle-btn" data-view="week">${t('fullWeekView')}</button>
      </div>
    `;
    mobileView.appendChild(toolbarEl);

    // ── КОНТЕЙНЕРИ ВИГЛЯДУ ────────────────────────────────────────────────────
    const dayViewEl = document.createElement('div');
    dayViewEl.className = 'week-mobile__day-view';
    mobileView.appendChild(dayViewEl);

    const weekViewEl = document.createElement('div');
    weekViewEl.className = 'week-mobile__week-view';
    weekViewEl.hidden = true;
    weekViewEl.innerHTML =
      `<p class="week-mobile__week-placeholder">${t('weekViewSoon')}</p>`;
    mobileView.appendChild(weekViewEl);

    toolbarEl.querySelectorAll('.week-mobile__toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        toolbarEl
          .querySelectorAll('.week-mobile__toggle-btn')
          .forEach((b) => b.classList.remove('week-mobile__toggle-btn--active'));
        btn.classList.add('week-mobile__toggle-btn--active');
        const isDay = btn.dataset.view === 'day';
        dayViewEl.hidden = !isDay;
        weekViewEl.hidden = isDay;
        if (!isDay) renderWeekView();
      });
    });

    function syncActivePill() {
      pillsEl.querySelectorAll('.week-mobile__pill').forEach((p, i) => {
        if (i === activeDayIdx) p.setAttribute('aria-current', 'true');
        else p.removeAttribute('aria-current');
      });
    }

    function renderDayView() {
      const { day } = dayInfo[activeDayIdx];
      dayViewEl.innerHTML = '';

      const mealsCard = document.createElement('div');
      mealsCard.className = 'week-mobile__meals-card';
      mealsCard.innerHTML = `
        <div class="week-mobile__meals-header">
          <span>${t('dayMenuTitle')}</span>
          <div class="week-mobile__menu-wrap">
            <button type="button" class="week-mobile__menu-btn" aria-label="${t('menuActions')}">
              ${iconMoreVertical.replace('<svg ', '<svg width="16" height="16" ')}
            </button>
            <div class="week-mobile__dropdown" hidden>
              <button type="button" class="week-mobile__dropdown-item js-mob-copy">${t('copyWeek')}</button>
              <button type="button" class="week-mobile__dropdown-item js-mob-paste">${t('pasteWeek')}</button>
              <button type="button" class="week-mobile__dropdown-item week-mobile__dropdown-item--danger js-mob-clear">${t('clearWeek')}</button>
              <button type="button" class="week-mobile__dropdown-item js-mob-shopping">${t('toShoppingList')}</button>
            </div>
          </div>
        </div>
      `;

      const dropdown = mealsCard.querySelector('.week-mobile__dropdown');
      mealsCard.querySelector('.week-mobile__menu-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.hidden = !dropdown.hidden;
      });
      mealsCard.querySelector('.js-mob-copy').addEventListener('click', () => {
        copyWeekBtn?.click();
        dropdown.hidden = true;
      });
      mealsCard.querySelector('.js-mob-paste').addEventListener('click', () => {
        pasteWeekBtn?.click();
        dropdown.hidden = true;
      });
      mealsCard.querySelector('.js-mob-clear').addEventListener('click', () => {
        clearWeekBtn?.click();
        dropdown.hidden = true;
      });
      mealsCard.querySelector('.js-mob-shopping').addEventListener('click', () => {
        document.getElementById('weekToShoppingBtn')?.click();
        dropdown.hidden = true;
      });
      dayViewEl.addEventListener('click', (e) => {
        if (!e.target.closest('.week-mobile__menu-wrap')) dropdown.hidden = true;
      });

      MEAL_TYPES.forEach((mealType) => {
        const items = weekMealsState[day][mealType] || [];
        const count = items.length;
        const kcal = items.reduce((s, it) => s + (Number(it.kcal) || 0), 0);
        const countWord = getMealWord(count);

        const accordion = document.createElement('div');
        accordion.className = 'week-mobile__accordion';

        const accHeader = document.createElement('button');
        accHeader.type = 'button';
        accHeader.className = 'week-mobile__accordion-header';

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'week-mobile__acc-add';
        addBtn.dataset.day = day;
        addBtn.dataset.meal = mealType;
        addBtn.innerHTML =
          iconPlus.replace('<svg ', '<svg width="12" height="12" ');

        const infoText =
          count > 0 ? count + ' ' + countWord + ' · ' + kcal + ' ' + t('kcalShort') : '';
        accHeader.innerHTML = `
          <span class="week-mobile__acc-name">${t(mealType)}</span>
          <span class="week-mobile__acc-info">${infoText}</span>
        `;
        accHeader.appendChild(addBtn);

        const accBody = document.createElement('div');
        accBody.className = 'week-mobile__accordion-body';
        accBody.hidden = true;

        if (count > 0) {
          const ul = document.createElement('ul');
          ul.className = 'week-mobile__acc-items';
          items.forEach((item) => {
            const cleanNameValue = cleanName(item.name);
            const li = document.createElement('li');
            li.className = 'week-mobile__acc-item';
            li.innerHTML = `
              <span class="week-mobile__acc-item-name">${cleanNameValue}</span>
              <span class="week-mobile__acc-item-kcal">${item.kcal || 0} ${t('kcalShort')}</span>
              <button type="button" class="week-mobile__acc-item-del">×</button>
            `;
            li.querySelector('.week-mobile__acc-item-del').addEventListener('click', (e) => {
              e.stopPropagation();
              openDeleteConfirm(item.id, day, mealType);
            });
            ul.appendChild(li);
          });
          accBody.appendChild(ul);
        }

        accHeader.addEventListener('click', (e) => {
          if (e.target.closest('.week-mobile__acc-add')) return;
          const isOpen = accordion.classList.contains('is-open');
          accordion.classList.toggle('is-open', !isOpen);
          accBody.hidden = isOpen;
        });

        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openAddModal(day, mealType);
          searchAllRecipes('');
        });

        accordion.appendChild(accHeader);
        accordion.appendChild(accBody);
        mealsCard.appendChild(accordion);
      });

      dayViewEl.appendChild(mealsCard);

      const allItems = MEAL_TYPES.flatMap((m) => weekMealsState[day][m] || []);
      const total = allItems.reduce(
        (acc, it) => ({
          kcal: acc.kcal + (Number(it.kcal) || 0),
          protein: acc.protein + (Number(it.protein) || 0),
          fat: acc.fat + (Number(it.fat) || 0),
          carbs: acc.carbs + (Number(it.carbs) || 0),
        }),
        { kcal: 0, protein: 0, fat: 0, carbs: 0 },
      );

      const summaryEl = document.createElement('div');
      summaryEl.className = 'week-mobile__day-summary';

      const TOLERANCE = 3;
      const totalMacroKcal = total.protein * 4 + total.fat * 9 + total.carbs * 4;

      if (totalMacroKcal === 0) {
        summaryEl.innerHTML = `
          <div class="summary-balance summary-balance--empty">
            <span class="week-mobile__summary-label">${t('balanceTitle')}</span>
            <div class="balance-bar"><div class="balance-bar__label">${t('proteinLetter')}</div>
              <div class="balance-bar__track" style="--target: 30%"><div class="balance-bar__fill" style="width: 0%"></div></div>
              <div class="balance-bar__pct">—</div>
            </div>
            <div class="balance-bar"><div class="balance-bar__label">${t('fatLetter')}</div>
              <div class="balance-bar__track" style="--target: 30%"><div class="balance-bar__fill" style="width: 0%"></div></div>
              <div class="balance-bar__pct">—</div>
            </div>
            <div class="balance-bar"><div class="balance-bar__label">${t('carbsLetter')}</div>
              <div class="balance-bar__track" style="--target: 40%"><div class="balance-bar__fill" style="width: 0%"></div></div>
              <div class="balance-bar__pct">—</div>
            </div>
          </div>
        `;
      } else {
        const proteinPct = Math.round(((total.protein * 4) / totalMacroKcal) * 100);
        const fatPct = Math.round(((total.fat * 9) / totalMacroKcal) * 100);
        const carbsPct = Math.round(((total.carbs * 4) / totalMacroKcal) * 100);

        const getStatus = (actual, ideal) => {
          const diff = actual - ideal;
          if (Math.abs(diff) <= TOLERANCE) return 'ok';
          return diff > 0 ? 'over' : 'under';
        };

        summaryEl.innerHTML = `
          <span class="week-mobile__summary-label">${t('balanceTitle')}</span>
          <div class="summary-balance">
            <div class="balance-bar" data-status="${getStatus(proteinPct, 30)}">
              <div class="balance-bar__label">${t('proteinLetter')}</div>
              <div class="balance-bar__track" style="--target: 30%">
                <div class="balance-bar__fill balance-bar__fill--protein" style="width: ${proteinPct}%"></div>
              </div>
              <div class="balance-bar__pct">${proteinPct}%</div>
            </div>
            <div class="balance-bar" data-status="${getStatus(fatPct, 30)}">
              <div class="balance-bar__label">${t('fatLetter')}</div>
              <div class="balance-bar__track" style="--target: 30%">
                <div class="balance-bar__fill balance-bar__fill--fat" style="width: ${fatPct}%"></div>
              </div>
              <div class="balance-bar__pct">${fatPct}%</div>
            </div>
            <div class="balance-bar" data-status="${getStatus(carbsPct, 40)}">
              <div class="balance-bar__label">${t('carbsLetter')}</div>
              <div class="balance-bar__track" style="--target: 40%">
                <div class="balance-bar__fill balance-bar__fill--carbs" style="width: ${carbsPct}%"></div>
              </div>
              <div class="balance-bar__pct">${carbsPct}%</div>
            </div>
          </div>
        `;
      }

      dayViewEl.appendChild(summaryEl);
    }

    function renderWeekView() {
      weekViewEl.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'mob-week-grid';

      // Кутова клітинка
      const corner = document.createElement('div');
      corner.className = 'mob-week-grid__corner';
      grid.appendChild(corner);

      // Заголовки днів
      dayInfo.forEach(({ abbr, date }, i) => {
        const header = document.createElement('div');
        header.className =
          'mob-week-grid__day-header' +
          (i === activeDayIdx ? ' mob-week-grid__day-header--active' : '');
        header.innerHTML = `<span class="mob-week-grid__day-abbr">${abbr}</span><span class="mob-week-grid__day-num">${date.getDate()}</span>`;
        grid.appendChild(header);
      });

      // Рядки прийомів їжі
      MEAL_TYPES.forEach((mealType) => {
        const label = document.createElement('div');
        label.className = 'mob-week-grid__meal-label';
        label.textContent = t(mealType);
        grid.appendChild(label);

        dayInfo.forEach(({ day }, i) => {
          const items = weekMealsState[day][mealType] || [];
          const count = items.length;
          const kcal = items.reduce((s, it) => s + (Number(it.kcal) || 0), 0);

          const cell = document.createElement('div');
          cell.className =
            'mob-week-grid__cell' + (count > 0 ? ' mob-week-grid__cell--filled' : '');

          if (count > 0) {
            const maxDots = Math.min(count, 4);
            let html = '<div class="mob-week-grid__dots">';
            for (let d = 0; d < maxDots; d++) html += '<span class="mob-week-grid__dot"></span>';
            html += '</div>';
            html += `<div class="mob-week-grid__kcal">${kcal}</div>`;
            cell.innerHTML = html;
          }

          cell.addEventListener('click', () => {
            activeDayIdx = i;
            syncActivePill();
            toolbarEl.querySelectorAll('.week-mobile__toggle-btn').forEach((b) => {
              b.classList.toggle('week-mobile__toggle-btn--active', b.dataset.view === 'day');
            });
            dayViewEl.hidden = false;
            weekViewEl.hidden = true;
            renderDayView();
          });

          grid.appendChild(cell);
        });
      });

      // Рядок "Всього"
      const totalLabel = document.createElement('div');
      totalLabel.className = 'mob-week-grid__total-label';
      totalLabel.textContent = t('totalLabel');
      grid.appendChild(totalLabel);

      dayInfo.forEach(({ day }) => {
        const allItems = MEAL_TYPES.flatMap((m) => weekMealsState[day][m] || []);
        const total = allItems.reduce((s, it) => s + (Number(it.kcal) || 0), 0);
        const cell = document.createElement('div');
        cell.className = 'mob-week-grid__total-cell';
        cell.innerHTML =
          total > 0
            ? `<b>${total}</b><span>${t('kcalShort')}</span>`
            : '<span class="mob-week-grid__empty">—</span>';
        grid.appendChild(cell);
      });

      weekViewEl.appendChild(grid);
    }

    pillsEl.querySelectorAll('.week-mobile__pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        activeDayIdx = Number(pill.dataset.idx);
        syncActivePill();
        renderDayView();
      });
    });

    renderDayView();
  }

  // ================== ІНІЦІАЛІЗАЦІЯ ==================
  // Числа дат рахуються локально — проставляємо їх ОДРАЗУ, не чекаючи
  // на Supabase. Інакше ліва колонка стрибає у висоту, коли дати
  // підтягуються після async-запиту (layout shift / блимання).
  updateWeekLabel();

  await initAuth();
  initRecipeModal();
  initDragAndDrop();
  loadWeekFromSupabase();
});
