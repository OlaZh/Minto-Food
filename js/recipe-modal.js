// =============================================================
// recipe-modal.js — спільний модуль створення рецепту
// Використовується на recipes.html і week-menu.html
// =============================================================

import { supabase } from './supabaseClient.js';
import {
  initIngredientBuilder,
  getIngredients,
  getTotals,
  clearIngredients,
  setLanguage,
} from './recipe-ingredients.js';
import { showToast, toBase64 } from './utils.js';
import {
  initBookSelector,
  getBooks,
  getDefaultBook,
  createInlineBookSelector,
  getSelectedBooksFromContainer,
  saveRecipeToBooks,
  refreshBooks,
} from './book-selector.js';

// =============================================================
// СТАН
// =============================================================

let recipeVisibility = 'private'; // 'private' або 'public'

// =============================================================
// СТВОРЕННЯ HTML МОДАЛКИ ДИНАМІЧНО
// =============================================================

function createRecipeModalHTML() {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="modal-overlay" id="recipe-create-modal">
      <div class="modal-card">
        <button class="modal-card__close" id="recipe-modal-close">&times;</button>

        <div id="recipe-modal-options-view">
          <div class="modal-card__header">
            <h2 data-i18n="createMagic">Варіанти створення рецепта ✨</h2>
            <p data-i18n="createMagicSubtitle">Оцифруйте скриншот або запишіть власну ідею</p>
          </div>

          <div class="modal-card__options">
            <label class="option-card option-card--ai" for="recipe-modal-ai-upload">
              <input type="file" id="recipe-modal-ai-upload" accept="image/*" hidden />
              <div class="option-card__icon">📸</div>
              <div class="option-card__info">
                <h3 data-i18n="uploadScreenshot">Завантажити скриншот</h3>
                <p data-i18n="aiRecognize">ШІ сам розпізнає текст та інгредієнти</p>
              </div>
            </label>

            <button class="option-card" id="recipe-modal-manual-btn" type="button">
              <div class="option-card__icon">✍️</div>
              <div class="option-card__info">
                <h3 data-i18n="manualEntry">Ввести вручну</h3>
                <p data-i18n="manualEntrySubtitle">Створіть рецепт з нуля самостійно</p>
              </div>
            </button>
          </div>

          <div class="recipe-add__smart-import">
            <label class="smart-import__label">
              <span>🥗</span> <span data-i18n="apiImportLabel">Знайти рецепт у базі</span>
            </label>
            <div class="smart-import__wrapper">
              <input
                type="text"
                id="recipe-modal-api-search"
                class="smart-import__input"
                placeholder="Введіть назву страви..."
                data-i18n-placeholder="apiImportPlaceholder" />
              <button type="button" id="recipe-modal-api-btn" class="recipe-card__btn smart-import__btn">
                <span data-i18n="apiImportBtn">Пошук</span>
              </button>
            </div>
            <div id="recipe-modal-api-results" class="api-results"></div>
          </div>
        </div>

        <div id="recipe-modal-preview-form" class="modal-form-wrapper" style="display: none">
          <div class="modal-card__header">
            <h2 data-i18n="addRecipe">Додати рецепт</h2>
            <p data-i18n="checkBeforeSave">Перевір дані перед збереженням</p>
          </div>

          <form class="preview-form" id="recipe-modal-form">
            <div class="preview-form__content">
              <div class="form-group">
                <label data-i18n="dishName">Назва страви</label>
                <input type="text" id="rm-name" required placeholder="Назва страви, напр. «Млинці з медом»" data-i18n-placeholder="dishNamePlaceholder" />
              </div>

              <div class="recipe-macros-grid">
                <div class="form-group">
                  <label data-i18n="calories">Ккал</label>
                  <input type="number" id="rm-calories" placeholder="0" readonly />
                </div>
                <div class="form-group">
                  <label data-i18n="proteins">Б</label>
                  <input type="number" id="rm-proteins" placeholder="0" readonly />
                </div>
                <div class="form-group">
                  <label data-i18n="fats">Ж</label>
                  <input type="number" id="rm-fats" placeholder="0" readonly />
                </div>
                <div class="form-group">
                  <label data-i18n="carbs">В</label>
                  <input type="number" id="rm-carbs" placeholder="0" readonly />
                </div>
              </div>

              <div class="form-group">
                <label data-i18n="category">Категорія</label>
                <select id="rm-category">
                  <option value="breakfast" data-i18n="filterBreakfast">Сніданок</option>
                  <option value="lunch" data-i18n="filterLunch">Обід</option>
                  <option value="dinner" data-i18n="filterDinner">Вечеря</option>
                  <option value="snack" data-i18n="filterSnack">Перекус</option>
                  <option value="dessert" data-i18n="filterDessert">Десерт</option>
                  <option value="drinks" data-i18n="filterDrinks">Напої</option>
                  <option value="bakery" data-i18n="filterBakery">Випічка</option>
                  <option value="fast" data-i18n="filterFast">Швидкі рецепти⏳</option>
                  <option value="no_power" data-i18n="filterNoPower">Без світла⚡</option>
                </select>
              </div>

              <div class="form-group">
                <label data-i18n="ingredientsHint">Інгредієнти</label>
                <div id="rm-ingredients-builder"></div>
              </div>

              <div class="form-group">
                <label data-i18n="stepsHint">Спосіб приготування</label>
                <textarea id="rm-steps" placeholder="1. Закип'ятити воду..." data-i18n-placeholder="stepsPlaceholder"></textarea>
              </div>

              <div class="form-media-box">
                <label data-i18n="dishPhoto">Фото страви</label>
                <div class="form-media-inner">
                  <input type="file" id="rm-image-file" accept="image/*" hidden />
                  <button
                    type="button"
                    class="btn-upload"
                    onclick="document.getElementById('rm-image-file').click()"
                    data-i18n="uploadPhoto">
                    Завантажити фото 📸
                  </button>
                  <div class="form-separator"><span data-i18n="orSeparator">— або —</span></div>
                  <div class="form-group">
                    <input type="text" id="rm-image-url" placeholder="Вставте URL фото..." />
                  </div>
                </div>
              </div>

              <!-- TOGGLE ПРИВАТНИЙ/ПУБЛІЧНИЙ -->
              <div class="visibility-section">
                <label data-i18n="visibilityLabel">Хто бачить рецепт</label>
                <div class="visibility-toggle" id="visibility-toggle">
                  <button type="button" class="visibility-toggle__option visibility-toggle__option--active" data-visibility="private">
                    <span class="visibility-toggle__icon">🔒</span>
                    <span class="visibility-toggle__label" data-i18n="visibilityPrivate">Тільки я</span>
                  </button>
                  <button type="button" class="visibility-toggle__option" data-visibility="public">
                    <span class="visibility-toggle__icon">🌍</span>
                    <span class="visibility-toggle__label" data-i18n="visibilityPublic">Всі користувачі</span>
                  </button>
                </div>
              </div>

              <!-- ВИБІР КНИГИ -->
              <div class="recipe-books-section">
                <div class="recipe-books-section__header">
                  <h4><span>📚</span> <span data-i18n="saveToBooks">Зберегти в книгу</span></h4>
                </div>
                <div id="rm-book-selector"></div>
              </div>
            </div>

            <div class="preview-form__footer">
              <button type="button" id="rm-cancel" class="btn-secondary" data-i18n="cancelBtn">Скасувати</button>
              <button type="submit" class="btn-save" data-i18n="saveRecipe">Зберегти рецепт 🥗</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  return div.firstElementChild;
}

// =============================================================
// ІНІЦІАЛІЗАЦІЯ МОДАЛКИ
// =============================================================

let recipeModalInstance = null;
let onRecipeSavedCallback = null;

export async function initRecipeModal() {
  // Ініціалізуємо book-selector
  await initBookSelector();

  // Додаємо модалку в DOM якщо ще немає
  if (!document.getElementById('recipe-create-modal')) {
    document.body.appendChild(createRecipeModalHTML());
  }

  recipeModalInstance = document.getElementById('recipe-create-modal');

  const closeBtn = document.getElementById('recipe-modal-close');
  const manualBtn = document.getElementById('recipe-modal-manual-btn');
  const cancelBtn = document.getElementById('rm-cancel');
  const optionsView = document.getElementById('recipe-modal-options-view');
  const previewForm = document.getElementById('recipe-modal-preview-form');
  const form = document.getElementById('recipe-modal-form');
  const apiBtn = document.getElementById('recipe-modal-api-btn');

  // Закриття
  closeBtn?.addEventListener('click', closeRecipeModal);
  recipeModalInstance?.addEventListener('click', (e) => {
    if (e.target === recipeModalInstance) closeRecipeModal();
  });

  // Вручну
  manualBtn?.addEventListener('click', () => showRecipeForm());

  // Скасувати у формі
  cancelBtn?.addEventListener('click', () => {
    previewForm.style.display = 'none';
    optionsView.style.display = 'block';
  });

  // API пошук
  apiBtn?.addEventListener('click', searchRecipesApi);
  document.getElementById('recipe-modal-api-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchRecipesApi();
    }
  });

  // Авто-ресайз textarea
  recipeModalInstance?.querySelectorAll('textarea').forEach((txt) => {
    txt.style.overflow = 'hidden';
    txt.addEventListener('input', () => {
      txt.style.height = 'auto';
      txt.style.height = txt.scrollHeight + 'px';
    });
  });

  // Збереження форми
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveRecipe();
  });

  // Ініціалізація toggle видимості
  initVisibilityToggle();

  // Ініціалізація конструктора інгредієнтів
  const lang = localStorage.getItem('lang') || 'ua';
  initIngredientBuilder(
    '#rm-ingredients-builder',
    (ingredients, totals) => {
      // Автозаповнення КБЖУ при зміні інгредієнтів
      const kcalEl = document.getElementById('rm-calories');
      const proteinEl = document.getElementById('rm-proteins');
      const fatEl = document.getElementById('rm-fats');
      const carbsEl = document.getElementById('rm-carbs');

      if (kcalEl) kcalEl.value = totals.kcal || '';
      if (proteinEl) proteinEl.value = totals.protein.toFixed(1) || '';
      if (fatEl) fatEl.value = totals.fat.toFixed(1) || '';
      if (carbsEl) carbsEl.value = totals.carbs.toFixed(1) || '';
    },
    lang,
  );
}

// =============================================================
// TOGGLE ВИДИМОСТІ (ПРИВАТНИЙ/ПУБЛІЧНИЙ)
// =============================================================

function initVisibilityToggle() {
  const toggle = document.getElementById('visibility-toggle');
  if (!toggle) return;

  const options = toggle.querySelectorAll('.visibility-toggle__option');

  options.forEach((option) => {
    option.addEventListener('click', () => {
      options.forEach((o) => o.classList.remove('visibility-toggle__option--active'));
      option.classList.add('visibility-toggle__option--active');
      recipeVisibility = option.dataset.visibility;
    });
  });
}

function resetVisibilityToggle() {
  recipeVisibility = 'private';
  const toggle = document.getElementById('visibility-toggle');
  if (!toggle) return;

  const options = toggle.querySelectorAll('.visibility-toggle__option');
  options.forEach((option) => {
    const isPrivate = option.dataset.visibility === 'private';
    option.classList.toggle('visibility-toggle__option--active', isPrivate);
  });
}

// =============================================================
// ВІДКРИТТЯ / ЗАКРИТТЯ
// =============================================================

export async function openRecipeModal(onSaved = null) {
  onRecipeSavedCallback = onSaved;

  const optionsView = document.getElementById('recipe-modal-options-view');
  const previewForm = document.getElementById('recipe-modal-preview-form');

  if (optionsView) optionsView.style.display = 'block';
  if (previewForm) previewForm.style.display = 'none';

  resetRecipeForm();

  // Оновлюємо список книг
  await refreshBooks();

  if (recipeModalInstance) {
    recipeModalInstance.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  }
}

export function closeRecipeModal() {
  if (recipeModalInstance) {
    recipeModalInstance.classList.remove('is-active');
    document.body.style.overflow = '';
  }
  onRecipeSavedCallback = null;
  resetRecipeForm();
}

function resetRecipeForm() {
  const form = document.getElementById('recipe-modal-form');
  if (form) form.reset();

  const apiResults = document.getElementById('recipe-modal-api-results');
  if (apiResults) apiResults.innerHTML = '';

  const apiSearch = document.getElementById('recipe-modal-api-search');
  if (apiSearch) apiSearch.value = '';

  // Очищаємо конструктор інгредієнтів
  clearIngredients();

  // Скидаємо toggle видимості
  resetVisibilityToggle();

  // Очищаємо селектор книг
  const bookSelector = document.getElementById('rm-book-selector');
  if (bookSelector) bookSelector.innerHTML = '';
}

// =============================================================
// ФОРМА — ПОКАЗАТИ З ДАНИМИ (АБО ПУСТУ)
// =============================================================

async function showRecipeForm(data = null) {
  const optionsView = document.getElementById('recipe-modal-options-view');
  const previewForm = document.getElementById('recipe-modal-preview-form');

  if (optionsView) optionsView.style.display = 'none';
  if (previewForm) previewForm.style.display = 'block';

  // Реініціалізуємо конструктор інгредієнтів при показі форми
  const lang = localStorage.getItem('lang') || 'ua';
  initIngredientBuilder(
    '#rm-ingredients-builder',
    (ingredients, totals) => {
      const kcalEl = document.getElementById('rm-calories');
      const proteinEl = document.getElementById('rm-proteins');
      const fatEl = document.getElementById('rm-fats');
      const carbsEl = document.getElementById('rm-carbs');

      if (kcalEl) kcalEl.value = totals.kcal || '';
      if (proteinEl) proteinEl.value = totals.protein.toFixed(1) || '';
      if (fatEl) fatEl.value = totals.fat.toFixed(1) || '';
      if (carbsEl) carbsEl.value = totals.carbs.toFixed(1) || '';
    },
    lang,
  );

  // Ініціалізуємо селектор книг
  await refreshBooks();
  createInlineBookSelector('rm-book-selector');

  if (data) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };
    setVal('rm-name', data.name || data.title);
    setVal('rm-calories', data.kcal || data.calories);
    setVal('rm-proteins', data.proteins || data.protein);
    setVal('rm-fats', data.fats || data.fat);
    setVal('rm-carbs', data.carbs);
    setVal('rm-steps', data.steps);
    setVal('rm-category', data.category || 'lunch');
    setVal('rm-image-url', data.image);
  }
}

// =============================================================
// ЗБЕРЕЖЕННЯ РЕЦЕПТУ
// =============================================================

async function saveRecipe() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    showToast('Увійдіть, щоб зберігати рецепти', 'error');
    return;
  }

  const fileInput = document.getElementById('rm-image-file');
  const urlInput = document.getElementById('rm-image-url');
  let finalImage = '';

  if (fileInput?.files?.[0]) {
    finalImage = await toBase64(fileInput.files[0]);
  } else if (urlInput?.value.trim()) {
    finalImage = urlInput.value.trim();
  }

  // Отримуємо КБЖУ з конструктора інгредієнтів
  const totals = getTotals();

  // Визначаємо статус на основі toggle
  const status = recipeVisibility === 'public' ? 'published' : 'draft';

  const payload = {
    name_ua: document.getElementById('rm-name')?.value.trim(),
    kcal: totals.kcal || 0,
    protein: parseFloat(totals.protein.toFixed(1)) || 0,
    fat: parseFloat(totals.fat.toFixed(1)) || 0,
    carbs: parseFloat(totals.carbs.toFixed(1)) || 0,
    category: document.getElementById('rm-category')?.value,
    steps: document.getElementById('rm-steps')?.value || '',
    image: finalImage,
    user_id: user.id,
    status: status,
  };

  const { data, error } = await supabase.from('recipes').insert([payload]).select().single();

  if (error) {
    console.error('Помилка збереження рецепту:', error);
    showToast('Помилка збереження', 'error');
    return;
  }

  // Зберігаємо інгредієнти в product_recipe
  const ingredients = getIngredients();
  if (ingredients.length > 0 && data?.id) {
    const ingredientRows = ingredients
      .filter((ing) => ing.id) // тільки ті, що є в базі products
      .map((ing) => ({
        recipe_id: data.id,
        ingredient_id: ing.id,
        amount: ing.weight,
        unit: ing.unit || 'g',
      }));

    if (ingredientRows.length > 0) {
      const { error: ingError } = await supabase.from('product_recipe').insert(ingredientRows);

      if (ingError) {
        console.error('Помилка збереження інгредієнтів:', ingError);
      }
    }
  }

  // Зберігаємо в обрані книги
  const selectedBookIds = getSelectedBooksFromContainer('rm-book-selector');
  if (selectedBookIds.length > 0 && data?.id) {
    await saveRecipeToBooks(data.id, selectedBookIds);
  }

  const visibilityText = status === 'published' ? 'Рецепт опубліковано!' : 'Рецепт збережено!';
  showToast(`${visibilityText} ✓`);

  closeRecipeModal();

  // Викликаємо callback щоб сторінка що відкрила модалку могла оновитись
  if (onRecipeSavedCallback) {
    onRecipeSavedCallback(data);
  }
}

// =============================================================
// API ПОШУК РЕЦЕПТІВ
// =============================================================

async function searchRecipesApi() {
  const input = document.getElementById('recipe-modal-api-search');
  const resultsEl = document.getElementById('recipe-modal-api-results');
  if (!input || !resultsEl) return;

  const query = input.value.trim();
  if (!query) {
    input.focus();
    return;
  }

  resultsEl.innerHTML = '<p style="padding:12px;text-align:center;color:#888;">Шукаємо...</p>';

  try {
    const resp = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`,
    );
    const data = await resp.json();
    const meals = data.meals || [];

    if (meals.length === 0) {
      resultsEl.innerHTML =
        '<p style="padding:12px;text-align:center;color:#888;">Нічого не знайдено</p>';
      return;
    }

    resultsEl.innerHTML = '';

    meals.slice(0, 8).forEach((m) => {
      const card = document.createElement('div');
      card.className = 'api-result-card';
      card.innerHTML = `
        <div class="api-result-card__image-box">
          <img src="${m.strMealThumb || ''}" alt="${m.strMeal}" onerror="this.src=''">
        </div>
        <div class="api-result-card__content">
          <h4>${m.strMeal}</h4>
          <button type="button" class="recipe-card__btn api-add-btn">Додати цей рецепт</button>
        </div>
      `;

      card.querySelector('.api-add-btn').addEventListener('click', () => {
        showRecipeForm({
          name: m.strMeal,
          image: m.strMealThumb,
          steps: m.strInstructions || '',
          category: 'lunch',
        });
      });

      resultsEl.appendChild(card);
    });
  } catch {
    resultsEl.innerHTML =
      '<p style="padding:12px;text-align:center;color:#c0392b;">Помилка зв\'язку</p>';
  }
}
