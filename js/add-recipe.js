console.log('add-recipe.js запустився');

import { supabase } from './supabaseClient.js';
import { initAuth } from './auth.js';
import { showToast, toBase64, parseNumber } from './utils.js';

// =============================================================
// 1. ОГОЛОШЕННЯ ЕЛЕМЕНТІВ (DOM)
// =============================================================

const addBtn = document.getElementById('open-add-modal');
const modal = document.getElementById('add-recipe-modal');
const closeBtn = document.getElementById('close-modal');
const aiUploadInput = document.getElementById('ai-upload');
const manualBtn = document.getElementById('manual-entry-btn');

const optionsView = document.getElementById('initial-options-view');
const previewForm = document.getElementById('recipe-preview-form');

const previewFormElement = document.querySelector('.preview-form');
const cancelPreview = document.getElementById('cancel-preview');

const confirmModal = document.getElementById('confirm-modal');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');

const viewModal = document.getElementById('view-recipe-modal');
const closeViewModalBtn = document.getElementById('close-view-modal');
const closeViewBtn = document.getElementById('close-view-btn');
const saveNotesBtn = document.getElementById('save-notes-btn');

// =============================================================
// 2. ДАНІ ТА СТАН
// =============================================================

let recipeIdToDelete = null;
let currentViewingId = null;
let editingRecipeId = null;

// =============================================================
// 3. ДОПОМІЖНІ ФУНКЦІЇ
// =============================================================



const updateStarsUI = (rating) => {
  const ratingContainer = document.querySelector('.recipe-rating');
  if (!ratingContainer) return;

  const stars = ratingContainer.querySelectorAll('.star');
  const valDisplay = ratingContainer.querySelector('.rating-value');
  const numericRating = Number(rating) || 0;

  stars.forEach((star) => {
    const starValue = Number(star.dataset.value);
    if (starValue <= numericRating) {
      star.classList.add('filled');
      star.textContent = '★';
    } else {
      star.classList.remove('filled');
      star.textContent = '☆';
    }
  });

  if (valDisplay) {
    valDisplay.textContent = numericRating > 0 ? numericRating.toFixed(1) : '0.0';
  }
};

// Отримуємо назву рецепту залежно від мови
function getRecipeName(recipe) {
  const lang = localStorage.getItem('lang') || 'ua';
  if (lang === 'pl' && recipe.name_pl) return recipe.name_pl;
  if (lang === 'en' && recipe.name_en) return recipe.name_en;
  return recipe.name_ua || recipe.name_en || recipe.name_pl || '';
}



// =============================================================
// 4. ЗАВАНТАЖЕННЯ ТА ВІДОБРАЖЕННЯ РЕЦЕПТІВ З SUPABASE
// =============================================================

async function loadAndDisplayRecipes() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Завантажуємо рецепти: публічні (без user_id) АБО власні користувача
  let query = supabase.from('recipes').select('*');

  if (user) {
    query = query.or(`status.eq.published,user_id.eq.${user.id}`);
  }
  // Без авторизації — показуємо всі рецепти (published + draft)

  const { data, error } = await query;

  if (error) {
    console.error('Помилка завантаження рецептів:', error);
    return;
  }

  displayRecipes(data || []);
}

const categoryTranslations = {
  all: 'Всі',
  breakfast: 'Сніданки',
  lunch: 'Обіди',
  dinner: 'Вечері',
  dessert: 'Десерти',
  snack: 'Перекуси',
  drinks: 'Напої',
  bakery: 'Випічка',
  fast: 'Швидкі рецепти ⚡',
  no_power: 'Без світла 🔋',
};

function displayRecipes(recipes) {
  const recipeGrid = document.querySelector('.recipe-grid');
  if (!recipeGrid) return;

  recipeGrid.innerHTML = '';

  if (recipes.length === 0) {
    recipeGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #888;"><p>Рецептів не знайдено</p></div>`;
    return;
  }

  recipes.forEach((recipe) => {
    const rating = recipe.rating || 0;
    const name = getRecipeName(recipe);
    const cardImage =
      recipe.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?q=80&w=500';
    const displayCategory = categoryTranslations[recipe.category] || recipe.category || '';

    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.dataset.id = recipe.id;

    card.innerHTML = `
      <div class="recipe-card__image-box">
        <img src="${cardImage}" alt="${name}" class="recipe-card__img">
        <div class="recipe-card__rating-badge" style="position:absolute;top:12px;left:48px;background:rgba(255,255,255,0.95);padding:3px 8px;border-radius:6px;font-weight:800;color:#333;font-size:11px;display:flex;align-items:center;gap:4px;box-shadow:0 2px 5px rgba(0,0,0,0.15);z-index:2;">
          <span style="color:#f1c40f;">★</span>
          <span>${rating > 0 ? Number(rating).toFixed(1) : '0'}</span>
        </div>
        <div class="recipe-card__stats">${recipe.kcal || 0} ккал</div>
        <button class="btn-delete-recipe js-delete-recipe">✕</button>
      </div>
      <div class="recipe-card__content">
        <h3 class="recipe-card__name">${name}</h3>
        <p class="recipe-card__macros">Категорія: ${displayCategory}</p>
        <button class="recipe-card__btn js-view-recipe">Переглянути</button>
      </div>
    `;

    // Переглянути
    card.querySelector('.js-view-recipe').addEventListener('click', () => {
      openRecipeView(recipe.id);
    });

    // Видалити
    card.querySelector('.js-delete-recipe').addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteConfirm(recipe.id);
    });

    recipeGrid.appendChild(card);
  });
}

// =============================================================
// 5. ПЕРЕГЛЯД РЕЦЕПТУ
// =============================================================

async function openRecipeView(recipeId) {
  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .single();

  if (error || !recipe) {
    console.error('Помилка завантаження рецепту:', error);
    return;
  }

  currentViewingId = recipeId;

  const name = getRecipeName(recipe);

  const setT = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '0';
  };

  setT('view-title', name);
  setT('view-calories', recipe.kcal);
  setT('view-category', categoryTranslations[recipe.category] || recipe.category);
  setT('view-proteins', recipe.protein);
  setT('view-carbs', recipe.carbs);
  setT('view-fats', recipe.fat);

  updateStarsUI(recipe.rating || 0);

  // --- НОТАТКИ ---
  const notesField = document.getElementById('view-notes');
  if (notesField) notesField.value = recipe.notes || '';

  // --- ІНГРЕДІЄНТИ ---
  const list = document.getElementById('view-ingredients-list');
  if (list) {
    list.innerHTML = '';

    // Завантажуємо інгредієнти через product_recipe
    const { data: productRecipes } = await supabase
      .from('product_recipe')
      .select('amount, unit, product_id, products(name_ua, name_en, name_pl)')
      .eq('recipe_id', recipeId);

    if (productRecipes && productRecipes.length > 0) {
      const lang = localStorage.getItem('lang') || 'ua';
      productRecipes.forEach((pr) => {
        const li = document.createElement('li');
        li.className = 'ingredient-item-row';
        const productName =
          lang === 'pl'
            ? pr.products?.name_pl
            : lang === 'en'
              ? pr.products?.name_en
              : pr.products?.name_ua;
        li.innerHTML = `<span>• ${productName || ''}</span> <span class="ing-count">${pr.amount || ''} ${pr.unit || ''}</span>`;
        list.appendChild(li);
      });
    } else if (recipe.ingredients) {
      // Фолбек на текстові інгредієнти
      const ingLines = recipe.ingredients.split('\n').filter((l) => l.trim().length > 0);
      ingLines.forEach((line) => {
        const li = document.createElement('li');
        li.className = 'ingredient-item-row';
        li.innerHTML = `<span>• ${line.trim()}</span>`;
        list.appendChild(li);
      });
    }
  }

  // --- КРОКИ ПРИГОТУВАННЯ ---
  const stepsContainer = document.getElementById('view-steps');
  if (stepsContainer) {
    stepsContainer.innerHTML = '';

    const stepLines = (recipe.steps || '')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => /[a-zA-Zа-яА-ЯіїєґІЇЄҐ0-9]/.test(s));

    stepLines.forEach((text, i) => {
      const cleanText = text.replace(/^\d+[\s.)-]*\s*/, '');
      const stepDiv = document.createElement('div');
      stepDiv.className = 'step-item';
      stepDiv.style.display = 'flex';
      stepDiv.style.gap = '15px';
      stepDiv.style.marginBottom = '15px';
      stepDiv.innerHTML = `
        <span class="step-num" style="flex-shrink:0;">${i + 1}</span>
        <p style="margin:0; line-height:1.5;">${cleanText}</p>
      `;
      stepsContainer.appendChild(stepDiv);
    });
  }

  // --- КНОПКА РЕДАГУВАННЯ ---
  const editBtn = document.getElementById('edit-recipe-btn');
  if (editBtn) {
    editBtn.onclick = function () {
      editingRecipeId = recipeId;
      if (viewModal) viewModal.classList.remove('is-active');

      if (modal) {
        modal.classList.add('is-active');
        const options = document.getElementById('initial-options-view');
        const form = document.getElementById('recipe-preview-form');
        if (options) options.style.display = 'none';
        if (form) form.style.display = 'block';

        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.value = val || '';
        };

        setVal('prev-name', name);
        setVal('prev-calories', recipe.kcal);
        setVal('prev-ingredients', recipe.ingredients);
        setVal('prev-steps', recipe.steps);
        setVal('prev-category', recipe.category);
        setVal('prev-proteins', recipe.protein);
        setVal('prev-carbs', recipe.carbs);
        setVal('prev-fats', recipe.fat);
      }
    };
  }

  if (viewModal) {
    viewModal.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  }
}

// =============================================================
// 6. ВИДАЛЕННЯ
// =============================================================

function openDeleteConfirm(recipeId) {
  recipeIdToDelete = recipeId;
  if (confirmModal) confirmModal.classList.add('is-active');
}

const closeConfirmModal = () => {
  if (confirmModal) confirmModal.classList.remove('is-active');
  recipeIdToDelete = null;
};

if (confirmYesBtn) {
  confirmYesBtn.addEventListener('click', async () => {
    if (recipeIdToDelete !== null) {
      const { error } = await supabase.from('recipes').delete().eq('id', recipeIdToDelete);

      if (error) {
        console.error('Помилка видалення:', error);
        showToast('Помилка видалення', 'error');
      } else {
        showToast('Рецепт видалено', 'info');
        if (viewModal) {
          viewModal.classList.remove('is-active');
          document.body.style.overflow = '';
        }
        loadAndDisplayRecipes();
      }
    }
    closeConfirmModal();
  });
}

if (confirmNoBtn) {
  confirmNoBtn.addEventListener('click', closeConfirmModal);
}

// =============================================================
// 7. МОДАЛЬНЕ ВІКНО — ВІДКРИТТЯ/ЗАКРИТТЯ
// =============================================================

const closeModal = () => {
  if (modal) {
    modal.classList.remove('is-active');
    editingRecipeId = null;
    window.tempAiImage = null;

    if (previewFormElement) previewFormElement.reset();

    const fileNameDisplay = document.getElementById('file-name');
    if (fileNameDisplay) fileNameDisplay.textContent = 'Файл не вибрано';

    document.body.style.overflow = '';
    setTimeout(() => {
      if (previewForm) previewForm.style.display = 'none';
      if (optionsView) {
        optionsView.style.display = 'block';
        optionsView.style.opacity = '1';
        optionsView.style.pointerEvents = 'all';
      }
    }, 300);
  }
};

const closeViewModal = () => {
  if (viewModal) {
    viewModal.classList.remove('is-active');
    document.body.style.overflow = '';
    currentViewingId = null;
  }
};

// =============================================================
// 8. ФОРМА ПОПЕРЕДНЬОГО ПЕРЕГЛЯДУ
// =============================================================

const autoResizer = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

const showForm = (data = null) => {
  if (!optionsView || !previewForm) return;

  optionsView.style.display = 'none';

  const apiSearchView =
    document.querySelector('.api-search-container') ||
    document.getElementById('api-search-results')?.parentElement;
  if (apiSearchView) {
    apiSearchView.style.display = 'none';
  }

  previewForm.style.display = 'block';

  if (data) {
    if (data.image) {
      window.tempAiImage = data.image;
    }

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('prev-name', data.name);

    const kcalVal = data.kcal || data.calories || '';
    const kcalInput = document.getElementById('prev-calories');
    if (kcalInput) kcalInput.value = kcalVal;

    setVal('prev-ingredients', data.ingredients);
    setVal('prev-steps', data.steps);
    setVal('prev-category', data.category || 'breakfast');
    setVal('prev-proteins', data.proteins || data.protein);
    setVal('prev-carbs', data.carbs);
    setVal('prev-fats', data.fats || data.fat);

    setTimeout(() => {
      autoResizer(document.getElementById('prev-ingredients'));
      autoResizer(document.getElementById('prev-steps'));
    }, 50);
  } else if (previewFormElement) {
    previewFormElement.reset();
    window.tempAiImage = null;
    const ingField = document.getElementById('prev-ingredients');
    const stepField = document.getElementById('prev-steps');
    if (ingField) ingField.style.height = 'auto';
    if (stepField) stepField.style.height = 'auto';
  }
};

// =============================================================
// 9. НОРМАЛІЗАЦІЯ ІНГРЕДІЄНТІВ
// =============================================================

function normalizeIngredients(text) {
  const rawLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const lines = rawLines.map((l) =>
    l.replace(/^•\s*/, '').replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim(),
  );

  const result = [];
  const isNumber = (s) => /^\d+([.,]\d+)?$/.test(s);
  const isUnit = (s) => /^(г|гр|мл|л|шт|ст\.?\s?л|ч\.?\s?л|кг)$/i.test(s);

  for (let i = 0; i < lines.length; i++) {
    const name = lines[i];
    const next = lines[i + 1] || '';
    const next2 = lines[i + 2] || '';

    if (isNumber(next) && isUnit(next2)) {
      result.push(`${name} ${next} ${next2}`);
      i += 2;
      continue;
    }

    if (/^\d+/.test(next)) {
      result.push(`${name} ${next}`);
      i += 1;
      continue;
    }

    result.push(name);
  }

  return result.join('\n');
}

// =============================================================
// 10. ЗБЕРЕЖЕННЯ РЕЦЕПТУ В SUPABASE
// =============================================================

async function saveRecipe(recipeData) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    name_ua: recipeData.name,
    image: recipeData.image,
    kcal: recipeData.calories || 0,
    category: recipeData.category,
    ingredients: recipeData.ingredients,
    steps: recipeData.steps,
    protein: recipeData.proteins || 0,
    carbs: recipeData.carbs || 0,
    fat: recipeData.fats || 0,
    rating: recipeData.rating || 0,
    notes: recipeData.notes || '',
    user_id: user ? user.id : null,
    status: 'draft', // Власні рецепти користувача — чернетка
  };

  if (editingRecipeId !== null) {
    const { error } = await supabase.from('recipes').update(payload).eq('id', editingRecipeId);
    if (error) {
      console.error('Помилка оновлення:', error);
      showToast('Помилка збереження', 'error');
      return false;
    }
    showToast('Рецепт оновлено!');
  } else {
    const { error } = await supabase.from('recipes').insert([payload]);
    if (error) {
      console.error('Помилка додавання:', error);
      showToast('Помилка збереження', 'error');
      return false;
    }
    showToast('Рецепт збережено!');
  }

  return true;
}

// =============================================================
// 11. ШІ ТА ФОТО (ІМПОРТ)
// =============================================================

function initAiUpload() {
  const aiInput = document.getElementById('ai-upload');
  if (!aiInput) return;

  aiInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showToast('Зображення отримано! Аналізуємо...', 'info');

    try {
      const aiImageBase64 = await toBase64(file);

      const optionCard = aiInput.closest('.option-card');
      const originalContent = optionCard ? optionCard.innerHTML : '';

      if (optionsView) {
        optionsView.style.opacity = '0.5';
        optionsView.style.pointerEvents = 'none';
      }

      if (optionCard) optionCard.innerHTML = `<h3>⏳ Аналізую...</h3>`;

      setTimeout(() => {
        if (optionCard) {
          optionCard.innerHTML = originalContent;
          initAiUpload();
        }

        if (optionsView) {
          optionsView.style.opacity = '1';
          optionsView.style.pointerEvents = 'all';
        }

        showForm({
          name: 'Рецепт (AI скан)',
          image: aiImageBase64,
          calories: 0,
          proteins: 0,
          carbs: 0,
          fats: 0,
          category: 'breakfast',
          ingredients: '',
          steps: '',
        });
      }, 1500);
    } catch (err) {
      console.error('Помилка обробки фото:', err);
      showToast('Не вдалося обробити фото', 'error');
    }
  });
}

// =============================================================
// 12. ПОШУК РЕЦЕПТІВ ЧЕРЕЗ API
// =============================================================

async function searchRecipesFromApi() {
  const queryInput = document.getElementById('api-search');
  const btn = document.getElementById('btn-api-search');
  const btnText = btn ? btn.querySelector('span') : null;
  const resultsContainer = document.getElementById('api-search-results');

  if (!queryInput || !btn || !resultsContainer) return;

  const query = queryInput.value.trim();
  if (!query) {
    queryInput.focus();
    return;
  }

  const originalText = btnText ? btnText.innerText : 'Пошук';
  if (btnText) btnText.innerText = '...';
  btn.disabled = true;
  resultsContainer.innerHTML = '';

  const SPOON_KEY = 'YOUR_SPOON_KEY';

  async function fetchSpoon() {
    try {
      const resp = await fetch(
        `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(query)}&number=10&addRecipeInformation=true&apiKey=${SPOON_KEY}`,
      );
      const data = await resp.json();
      return data.results || [];
    } catch {
      return [];
    }
  }

  async function fetchMealDB() {
    try {
      const resp = await fetch(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`,
      );
      const data = await resp.json();
      return data.meals || [];
    } catch {
      return [];
    }
  }

  const [spoon, mealdb] = await Promise.all([fetchSpoon(), fetchMealDB()]);

  let results = [];

  if (spoon.length > 0) {
    results = spoon.map((r) => ({
      title: r.title,
      image: r.image,
      ingredients: (r.extendedIngredients || []).map((i) => i.original).join('\n'),
      steps: (r.analyzedInstructions?.[0]?.steps || [])
        .map((s, i) => `${i + 1}. ${s.step}`)
        .join('\n'),
    }));
  } else if (mealdb.length > 0) {
    results = mealdb.map((m) => ({
      title: m.strMeal,
      image: m.strMealThumb,
      ingredients: Object.keys(m)
        .filter((k) => k.startsWith('strIngredient') && m[k])
        .map((k, i) => `${m[k]} ${m[`strMeasure${i + 1}`] || ''}`)
        .join('\n'),
      steps: m.strInstructions || '',
    }));
  }

  if (results.length === 0) {
    resultsContainer.innerHTML = `<p style="padding:20px; text-align:center;">Нічого не знайдено.</p>`;
    btn.disabled = false;
    if (btnText) btnText.innerText = originalText;
    return;
  }

  results.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'api-result-card';
    card.innerHTML = `
      <div class="api-result-card__image-box">
        <img src="${r.image || ''}" alt="${r.title || ''}" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
      </div>
      <div class="api-result-card__content">
        <h4>${r.title || 'Без назви'}</h4>
        <button type="button" class="recipe-card__btn api-add-btn">Додати цей рецепт</button>
      </div>
    `;

    card.querySelector('.api-add-btn').addEventListener('click', () => {
      showForm({
        name: r.title,
        image: r.image,
        ingredients: r.ingredients,
        steps: r.steps,
        category: 'lunch',
      });
    });
    resultsContainer.appendChild(card);
  });

  if (btnText) btnText.innerText = originalText;
  btn.disabled = false;
}

// =============================================================
// 13. АВТО-РОЗРАХУНОК КАЛОРІЙ
// =============================================================

const calculateKcal = () => {
  const p = parseFloat(document.getElementById('prev-proteins')?.value) || 0;
  const c = parseFloat(document.getElementById('prev-carbs')?.value) || 0;
  const f = parseFloat(document.getElementById('prev-fats')?.value) || 0;

  const totalKcal = Math.round(p * 4 + c * 4 + f * 9);

  const kcalInput = document.getElementById('prev-calories');
  if (kcalInput) {
    kcalInput.value = totalKcal > 0 ? totalKcal : '';
  }
};

// =============================================================
// 14. ПОШУК ТА ФІЛЬТРАЦІЯ
// =============================================================

const searchInput = document.getElementById('recipe-search-input');
const searchModeBtn = document.getElementById('search-mode-btn');
const clearSearchBtn = document.getElementById('clear-search-btn');

const iconSearch = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
const iconGlobal = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20"></path></svg>`;

if (searchModeBtn) searchModeBtn.innerHTML = iconSearch;

async function filterRecipes(query) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dbQuery = supabase
    .from('recipes')
    .select('*')
    .or(
      `name_ua.ilike.%${query}%,name_en.ilike.%${query}%,name_pl.ilike.%${query}%,ingredients.ilike.%${query}%`,
    );

  if (user) {
    dbQuery = dbQuery.or(`status.eq.published,user_id.eq.${user.id}`);
  }
  // Без авторизації — показуємо всі

  const { data, error } = await dbQuery;

  if (error) {
    console.error('Помилка пошуку:', error);
    return;
  }

  displayRecipes(data || []);
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (clearSearchBtn) clearSearchBtn.style.display = query.length > 0 ? 'flex' : 'none';

    if (query.length > 0) {
      if (searchModeBtn) {
        searchModeBtn.innerHTML = iconGlobal;
        searchModeBtn.classList.add('is-active');
      }
      filterRecipes(query);
    } else {
      if (searchModeBtn) {
        searchModeBtn.innerHTML = iconSearch;
        searchModeBtn.classList.remove('is-active');
      }
      loadAndDisplayRecipes();
    }
  });
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    if (searchModeBtn) {
      searchModeBtn.innerHTML = iconSearch;
      searchModeBtn.classList.remove('is-active');
    }
    loadAndDisplayRecipes();
    searchInput.focus();
  });
}

// Фільтрація по категорії
document.querySelectorAll('.recipe-filters__item').forEach((btn) => {
  btn.addEventListener('click', async () => {
    document
      .querySelectorAll('.recipe-filters__item')
      .forEach((b) => b.classList.remove('recipe-filters__item--active'));
    btn.classList.add('recipe-filters__item--active');

    const category = btn.dataset.category;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase.from('recipes').select('*');

    if (category !== 'all') {
      query = query.eq('category', category);
    }

    if (user) {
      query = query.or(`status.eq.published,user_id.eq.${user.id}`);
    } else {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query;
    if (!error) displayRecipes(data || []);
  });
});

// =============================================================
// 15. СЛУХАЧІ ПОДІЙ ТА ІНІЦІАЛІЗАЦІЯ
// =============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  loadAndDisplayRecipes();
  initAiUpload();

  ['prev-proteins', 'prev-carbs', 'prev-fats'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calculateKcal);
  });

  // Рейтинг
  const ratingContainer = document.querySelector('.recipe-rating');
  if (ratingContainer) {
    ratingContainer.addEventListener('click', async (e) => {
      if (e.target.classList.contains('star')) {
        const newRating = Number(e.target.dataset.value);

        if (currentViewingId !== null) {
          const { error } = await supabase
            .from('recipes')
            .update({ rating: newRating })
            .eq('id', currentViewingId);

          if (!error) {
            updateStarsUI(newRating);
            loadAndDisplayRecipes();
            showToast('Оцінку збережено!');
          }
        }
      }
    });
  }
});

if (addBtn) {
  addBtn.addEventListener('click', () => {
    modal.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  });
}

if (closeBtn) closeBtn.addEventListener('click', closeModal);
if (closeViewModalBtn) closeViewModalBtn.addEventListener('click', closeViewModal);
if (closeViewBtn) closeViewBtn.addEventListener('click', closeViewModal);

if (saveNotesBtn) {
  saveNotesBtn.addEventListener('click', async () => {
    const notesValue = document.getElementById('view-notes')?.value;
    if (currentViewingId !== null) {
      const { error } = await supabase
        .from('recipes')
        .update({ notes: notesValue })
        .eq('id', currentViewingId);

      if (!error) showToast('Нотатку збережено!');
    }
  });
}

if (document.getElementById('btn-api-search')) {
  document.getElementById('btn-api-search').addEventListener('click', searchRecipesFromApi);
}

window.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
  if (e.target === confirmModal) closeConfirmModal();
  if (e.target === viewModal) closeViewModal();
});

if (cancelPreview) {
  cancelPreview.addEventListener('click', () => {
    if (previewForm) previewForm.style.display = 'none';
    if (optionsView) optionsView.style.display = 'block';
  });
}

if (manualBtn) manualBtn.addEventListener('click', () => showForm());

if (previewFormElement) {
  previewFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById('recipe-image');
    const urlInput = document.getElementById('recipe-image-url');
    let finalImageUrl = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?q=80&w=500';

    if (fileInput?.files?.[0]) {
      finalImageUrl = await toBase64(fileInput.files[0]);
    } else if (urlInput?.value.trim()) {
      finalImageUrl = urlInput.value.trim();
    } else if (window.tempAiImage) {
      finalImageUrl = window.tempAiImage;
    }

    const recipeData = {
      name: document.getElementById('prev-name').value,
      image: finalImageUrl,
      calories: document.getElementById('prev-calories')?.value || 0,
      category: document.getElementById('prev-category').value,
      ingredients: normalizeIngredients(document.getElementById('prev-ingredients').value),
      steps: document.getElementById('prev-steps').value,
      proteins: document.getElementById('prev-proteins')?.value || 0,
      carbs: document.getElementById('prev-carbs')?.value || 0,
      fats: document.getElementById('prev-fats')?.value || 0,
    };

    const success = await saveRecipe(recipeData);

    if (success) {
      editingRecipeId = null;
      window.tempAiImage = null;
      loadAndDisplayRecipes();
      closeModal();
    }
  });
}

// Авто-ресайз textarea
document.querySelectorAll('textarea').forEach((txt) => {
  txt.style.overflow = 'hidden';
  txt.addEventListener('input', () => autoResizer(txt));
});
