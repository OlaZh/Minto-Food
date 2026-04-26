import { supabase } from './supabaseClient.js';
import { i18n } from './i18n.js';
import { initRecipeModal, openRecipeModal } from './recipe-modal.js';
import { openRecipeView } from './add-recipe.js';
import { initAuth, requireAuth } from './auth.js';
import { showToast, getLocalDateString } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  // ================== МОВА ==================
  let lang = localStorage.getItem('lang') || 'ua';

  const langSwitcher = document.getElementById('langSwitcher');
  if (langSwitcher) {
    langSwitcher.value = lang;
    langSwitcher.addEventListener('change', () => {
      lang = langSwitcher.value;
      localStorage.setItem('lang', lang);
      renderAllCells();
      updateWeekLabel();
    });
  }

  function t(key) {
    return i18n[lang]?.[key] || key;
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
    let name =
      (lang === 'pl' && recipe.name_pl) ||
      (lang === 'en' && recipe.name_en) ||
      recipe.name_ua ||
      recipe.name_en ||
      recipe.name_pl ||
      recipe.name ||
      '';

    return cleanName(name);
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
      console.error('Помилка завантаження week_meals:', error);
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
      const cleanItemName = item.name.replace(/^Рецепт\s+/i, '');

      li.innerHTML = `
      <span class="meal-cell__item-name" title="${cleanItemName}">${cleanItemName}</span>
        <button class="meal-cell__item-delete" title="Видалити">✕</button>
    `;

      // Клік на назву — відкрити картку рецепта
      li.querySelector('.meal-cell__item-name').addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.recipe_id) {
          openRecipeView(item.recipe_id);
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

  // Підтвердження очищення цілого прийому їжі
  function openClearCellConfirm(day, mealType) {
    deleteTarget = { day, mealType, clearAll: true };
    if (confirmModal) {
      confirmModal.classList.add('is-active');
      confirmModal.hidden = false;
    }
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

    // Збалансованість — відсоток кожного макроса від загальних калорій з БЖВ
    const totalMacroKcal = total.protein * 4 + total.fat * 9 + total.carbs * 4;

    const proteinPct =
      totalMacroKcal > 0 ? Math.round(((total.protein * 4) / totalMacroKcal) * 100) : 0;
    const fatPct = totalMacroKcal > 0 ? Math.round(((total.fat * 9) / totalMacroKcal) * 100) : 0;
    const carbsPct =
      totalMacroKcal > 0 ? Math.round(((total.carbs * 4) / totalMacroKcal) * 100) : 0;

    summaryCell.innerHTML = `
      <span class="summary-kcal">${total.kcal} ккал</span>
      <div class="summary-balance">
        <div class="balance-bar" title="Білки ${proteinPct}%">
          <div class="balance-bar__label">Б</div>
          <div class="balance-bar__track">
            <div class="balance-bar__fill balance-bar__fill--protein" style="width: ${proteinPct}%"></div>
          </div>
          <div class="balance-bar__pct">${proteinPct}%</div>
        </div>
        <div class="balance-bar" title="Жири ${fatPct}%">
          <div class="balance-bar__label">Ж</div>
          <div class="balance-bar__track">
            <div class="balance-bar__fill balance-bar__fill--fat" style="width: ${fatPct}%"></div>
          </div>
          <div class="balance-bar__pct">${fatPct}%</div>
        </div>
        <div class="balance-bar" title="Вуглеводи ${carbsPct}%">
          <div class="balance-bar__label">В</div>
          <div class="balance-bar__track">
            <div class="balance-bar__fill balance-bar__fill--carbs" style="width: ${carbsPct}%"></div>
          </div>
          <div class="balance-bar__pct">${carbsPct}%</div>
        </div>
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
      console.error('Помилка додавання страви:', error);
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

  const confirmModal = document.getElementById('week-confirm-modal');
  const confirmYes = document.getElementById('week-confirm-yes');
  const confirmNo = document.getElementById('week-confirm-no');

  let deleteTarget = null;

  function openDeleteConfirm(id, day, mealType) {
    deleteTarget = { id, day, mealType };
    if (confirmModal) {
      confirmModal.classList.add('is-active');
      confirmModal.hidden = false;
    }
  }

  if (confirmYes) {
    confirmYes.addEventListener('click', async () => {
      if (!deleteTarget) return;

      const { id, day, mealType, clearAll } = deleteTarget;

      if (clearAll) {
        // Видаляємо всі страви з клітинки
        const items = weekMealsState[day][mealType] || [];
        const ids = items.map((item) => item.id);

        if (ids.length > 0) {
          const { error } = await supabase.from('week_meals').delete().in('id', ids);
          if (!error) {
            weekMealsState[day][mealType] = [];
            renderCell(day, mealType);
            renderDaySummary(day);
            renderMobileView();
          }
        }
      } else {
        // Видаляємо одну страву
        const { error } = await supabase.from('week_meals').delete().eq('id', id);
        if (!error) {
          weekMealsState[day][mealType] = weekMealsState[day][mealType].filter(
            (item) => item.id !== id,
          );
          renderCell(day, mealType);
          renderDaySummary(day);
          renderMobileView();
        }
      }

      deleteTarget = null;
      if (confirmModal) {
        confirmModal.classList.remove('is-active');
        confirmModal.hidden = true;
      }
    });
  }

  if (confirmNo) {
    confirmNo.addEventListener('click', () => {
      deleteTarget = null;
      if (confirmModal) {
        confirmModal.classList.remove('is-active');
        confirmModal.hidden = true;
      }
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
      addModal.hidden = false;
      resetModalState();
      searchAllRecipes('');

      // Підключаємо кнопку "Створити рецепт" (статична в HTML)
      const createBtn = addModal.querySelector('#weekCreateRecipeBtn');
      if (createBtn) {
        createBtn.onclick = () => {
          closeAddModal();
          openRecipeModal((savedRecipe) => {
            openAddModal(activeDay, activeMealType);
            const searchEl = addModal?.querySelector('#weekUnifiedSearch');
            if (searchEl && savedRecipe) {
              const name = savedRecipe.name_ua || '';
              searchEl.value = name;
              searchAllRecipes(name);
            }
          });
        };
      }
    }
  }

  function closeAddModal() {
    if (addModal) addModal.hidden = true;
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

    resultsEl.innerHTML = '<p class="week-modal__loading">Завантаження...</p>';

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Будуємо запит
    let dbQuery = supabase.from('recipes').select('*');

    if (query) {
      dbQuery = dbQuery.or(
        `name_ua.ilike.%${query}%,name_en.ilike.%${query}%,name_pl.ilike.%${query}%`,
      );
    }

    // Показуємо: опубліковані (спільна база) + власні рецепти користувача
    if (user) {
      dbQuery = dbQuery.or(`status.eq.published,user_id.eq.${user.id}`);
    } else {
      dbQuery = dbQuery.eq('status', 'published');
    }

    dbQuery = dbQuery.limit(50);

    const { data, error } = await dbQuery;

    if (error) {
      resultsEl.innerHTML = '<p class="week-modal__error">Помилка завантаження</p>';
      return;
    }

    const recipes = data || [];

    if (recipes.length === 0) {
      renderEmptyState(resultsEl, query);
      return;
    }

    // Розділяємо на "мої" і "спільна база"
    const myRecipes = user ? recipes.filter((r) => r.user_id === user.id) : [];
    const sharedRecipes = recipes.filter(
      (r) => r.status === 'published' && (!user || r.user_id !== user.id),
    );

    resultsEl.innerHTML = '';

    // Мої рецепти
    if (myRecipes.length > 0) {
      const section = document.createElement('div');
      section.className = 'week-modal__section';
      section.innerHTML = '<p class="week-modal__section-title">📚 Мої рецепти</p>';
      myRecipes.forEach((recipe) => {
        section.appendChild(createRecipeResultItem(recipe));
      });
      resultsEl.appendChild(section);
    }

    // Спільна база
    if (sharedRecipes.length > 0) {
      const section = document.createElement('div');
      section.className = 'week-modal__section';
      section.innerHTML = '<p class="week-modal__section-title">🌍 Спільна база</p>';
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
        <span class="week-modal__result-kcal">${recipe.kcal || 0} ккал · Б${recipe.protein || 0} Ж${recipe.fat || 0} В${recipe.carbs || 0}</span>
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
      msg.textContent = `За запитом "${query}" нічого не знайдено`;
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
      showToast('Немає рецептів для формування списку покупок', 'info');
      return;
    }

    // Завантажуємо інгредієнти через product_recipe
    const { data: productRecipes, error } = await supabase
      .from('product_recipe')
      .select('amount, unit, ingredient_id, products(id, name_ua, name_en, name_pl), recipe_id')
      .in('recipe_id', recipeIds);

    if (error) {
      console.error('Помилка завантаження інгредієнтів:', error);
      showToast('Помилка формування списку', 'error');
      return;
    }

    // Групуємо інгредієнти
    const grouped = {};

    const unitConversion = {
      кг: { base: 'г', factor: 1000 },
      л: { base: 'мл', factor: 1000 },
    };

    (productRecipes || []).forEach((pr) => {
      const productName =
        lang === 'pl'
          ? pr.products?.name_pl
          : lang === 'en'
            ? pr.products?.name_en
            : pr.products?.name_ua;

      if (!productName) return;

      let amount = parseFloat(pr.amount) || 0;
      let unit = pr.unit || 'шт';

      // Конвертуємо кг → г, л → мл для правильного підсумовування
      if (unitConversion[unit]) {
        amount = amount * unitConversion[unit].factor;
        unit = unitConversion[unit].base;
      }

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

    // Зберігаємо в localStorage тимчасово (до реалізації сторінки списку покупок)
    localStorage.setItem('week_shopping_list', JSON.stringify(shoppingList));

    showToast(`Список покупок сформовано: ${shoppingList.length} продуктів ✓`);
  }

  // ================== КОПІЮВАННЯ ТИЖНЯ ==================

  const copyWeekBtn = document.getElementById('copyWeekBtn');
  const pasteWeekBtn = document.getElementById('pasteWeekBtn');

  if (copyWeekBtn) {
    copyWeekBtn.addEventListener('click', () => {
      const snapshot = JSON.parse(JSON.stringify(weekMealsState));
      localStorage.setItem('copied_week', JSON.stringify(snapshot));
      showToast('Тиждень скопійовано! ✓');
    });
  }

  if (pasteWeekBtn) {
    pasteWeekBtn.addEventListener('click', async () => {
      const saved = localStorage.getItem('copied_week');
      if (!saved) {
        showToast('Немає скопійованого тижня', 'info');
        return;
      }

      const copiedState = JSON.parse(saved);
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
          console.error('Помилка вставки тижня:', error);
          showToast('Помилка вставки тижня', 'error');
          return;
        }
      }

      showToast('Тиждень вставлено! ✓');
      loadWeekFromSupabase();
    });
  }

  // ================== ОЧИЩЕННЯ ТИЖНЯ ==================

  const clearWeekBtn = document.getElementById('clearWeekBtn');
  const clearWeekModal = document.getElementById('week-clear-modal');
  const clearWeekYes = document.getElementById('week-clear-yes');
  const clearWeekNo = document.getElementById('week-clear-no');

  function openClearWeekModal() {
    if (clearWeekModal) {
      clearWeekModal.classList.add('is-active');
      clearWeekModal.hidden = false;
    }
  }

  function closeClearWeekModal() {
    if (clearWeekModal) {
      clearWeekModal.classList.remove('is-active');
      clearWeekModal.hidden = true;
    }
  }

  if (clearWeekBtn) {
    clearWeekBtn.addEventListener('click', openClearWeekModal);
  }

  if (clearWeekYes) {
    clearWeekYes.addEventListener('click', async () => {
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
        showToast('Тиждень очищено ✓');
      }

      closeClearWeekModal();
    });
  }

  if (clearWeekNo) {
    clearWeekNo.addEventListener('click', closeClearWeekModal);
  }

  // ================== МОБІЛЬНИЙ ВИГЛЯД ==================

  function renderMobileView() {
    const mobileView = document.getElementById('weekMobileView');
    if (!mobileView) return;

    const weekDates = getWeekDates(currentWeekStart);
    const todayStr = new Date().toDateString();
    const locale = lang === 'ua' ? 'uk-UA' : lang === 'pl' ? 'pl-PL' : 'en-US';

    mobileView.innerHTML = '';

    const navEl = document.createElement('div');
    navEl.className = 'week-mobile__nav';
    navEl.innerHTML = `
      <button type="button" class="week-nav-btn js-mob-prev" aria-label="Попередній тиждень">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="week-mobile__nav-actions">
        <button type="button" class="week-action-btn js-mob-copy">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Копіювати
        </button>
        <button type="button" class="week-action-btn js-mob-paste">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
          Вставити
        </button>
        <button type="button" class="week-action-btn js-mob-clear">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          Очистити
        </button>
      </div>
      <button type="button" class="week-nav-btn js-mob-next" aria-label="Наступний тиждень">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    `;

    navEl.querySelector('.js-mob-prev').addEventListener('click', () => {
      currentWeekStart = addDays(currentWeekStart, -7);
      loadWeekFromSupabase();
    });
    navEl.querySelector('.js-mob-next').addEventListener('click', () => {
      currentWeekStart = addDays(currentWeekStart, 7);
      loadWeekFromSupabase();
    });
    navEl.querySelector('.js-mob-copy').addEventListener('click', () => copyWeekBtn?.click());
    navEl.querySelector('.js-mob-paste').addEventListener('click', () => pasteWeekBtn?.click());
    navEl.querySelector('.js-mob-clear').addEventListener('click', () => clearWeekBtn?.click());

    mobileView.appendChild(navEl);

    // Картки днів
    DAYS.forEach((day, i) => {
      const date = weekDates[i];
      const isToday = date.toDateString() === todayStr;

      const allItems = MEAL_TYPES.flatMap((meal) => weekMealsState[day][meal] || []);
      const totalKcal = allItems.reduce((sum, item) => sum + (Number(item.kcal) || 0), 0);

      const rawAbbr = date.toLocaleDateString(locale, { weekday: 'short' });
      const abbr = (rawAbbr.charAt(0).toUpperCase() + rawAbbr.slice(1)).replace('.', '');

      const dayCard = document.createElement('div');
      dayCard.className = `week-mobile__day${isToday ? ' week-mobile__day--today is-open' : ''}`;

      // Тіло картки (з прийомами їжі)
      const body = document.createElement('div');
      body.className = 'week-mobile__day-body';
      if (!isToday) body.hidden = true;

      MEAL_TYPES.forEach((mealType) => {
        const items = weekMealsState[day][mealType] || [];
        const mealSection = document.createElement('div');
        mealSection.className = 'week-mobile__meal';

        const mealLabel = t(mealType);
        const mealHeader = document.createElement('div');
        mealHeader.className = 'week-mobile__meal-header';
        mealHeader.innerHTML = `
          <span class="week-mobile__meal-name">${mealLabel}</span>
          <button type="button" class="week-mobile__add-btn" data-day="${day}" data-meal="${mealType}" aria-label="Додати до ${mealLabel}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        `;
        mealSection.appendChild(mealHeader);

        if (items.length > 0) {
          const ul = document.createElement('ul');
          ul.className = 'week-mobile__items';

          items.forEach((item) => {
            const cleanName = item.name.replace(/^Рецепт\s+/i, '');
            const li = document.createElement('li');
            li.className = 'week-mobile__item';
            li.innerHTML = `
              <label class="week-mobile__item-label">
                <input type="checkbox" class="week-mobile__checkbox">
                <span class="week-mobile__item-name" title="${cleanName}">${cleanName}</span>
              </label>
              <span class="week-mobile__item-kcal">${item.kcal || 0} ккал</span>
            `;

            li.querySelector('.week-mobile__checkbox').addEventListener('change', (e) => {
              li.classList.toggle('is-done', e.target.checked);
            });

            ul.appendChild(li);
          });

          mealSection.appendChild(ul);
        }

        body.appendChild(mealSection);
      });

      // Заголовок картки
      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'week-mobile__day-header';
      header.setAttribute('aria-expanded', isToday ? 'true' : 'false');
      header.innerHTML = `
        <div class="week-mobile__day-pill${isToday ? ' week-mobile__day-pill--today' : ''}">
          <span class="week-mobile__day-abbr">${abbr}</span>
          <span class="week-mobile__day-num">${date.getDate()}</span>
        </div>
        <span class="week-mobile__day-kcal">${totalKcal > 0 ? totalKcal + ' ккал' : 'Порожній'}</span>
        <svg class="week-mobile__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      `;

      header.addEventListener('click', () => {
        const isOpen = dayCard.classList.contains('is-open');
        mobileView.querySelectorAll('.week-mobile__day').forEach((d) => {
          d.classList.remove('is-open');
          d.querySelector('.week-mobile__day-header')?.setAttribute('aria-expanded', 'false');
          const b = d.querySelector('.week-mobile__day-body');
          if (b) b.hidden = true;
        });
        if (!isOpen) {
          dayCard.classList.add('is-open');
          header.setAttribute('aria-expanded', 'true');
          body.hidden = false;
        }
      });

      dayCard.appendChild(header);
      dayCard.appendChild(body);
      mobileView.appendChild(dayCard);
    });

    // Кнопки "+" для додавання страв
    mobileView.querySelectorAll('.week-mobile__add-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAddModal(btn.dataset.day, btn.dataset.meal);
        searchAllRecipes('');
      });
    });
  }

  // ================== ІНІЦІАЛІЗАЦІЯ ==================
  await initAuth();
  initRecipeModal();
  initDragAndDrop();
  loadWeekFromSupabase();
});
