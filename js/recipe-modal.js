// =============================================================
// recipe-modal.js — спільний модуль створення рецепту
// Використовується на recipes.html і week-menu.html
// =============================================================

import { supabase } from './supabaseClient.js';
import {
  initIngredientBuilder,
  getIngredients,
  getIngredientsText,
  getTotals,
  clearIngredients,
  setLanguage,
} from './recipe-ingredients.js';
import { showToast, toBase64, setInputVal } from './utils.js';
import { getLang } from './storage.js';
import { lockScroll, unlockScroll } from './scroll-lock.js';
import { iconCamera, iconLock, iconGlobe, iconBookOpen } from './icons.js';
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

        <div id="recipe-modal-preview-form" class="modal-form-wrapper">
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
                  <option value="fast" data-i18n="filterFast">Швидкі рецепти</option>
                  <option value="no_power" data-i18n="filterNoPower">Без світла</option>
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
                    ${iconCamera} Завантажити фото
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
                    <span class="visibility-toggle__icon">${iconLock}</span>
                    <span class="visibility-toggle__label" data-i18n="visibilityPrivate">Тільки я</span>
                  </button>
                  <button type="button" class="visibility-toggle__option" data-visibility="public">
                    <span class="visibility-toggle__icon">${iconGlobe}</span>
                    <span class="visibility-toggle__label" data-i18n="visibilityPublic">Всі користувачі</span>
                  </button>
                </div>
              </div>

              <!-- ВИБІР КНИГИ -->
              <div class="recipe-books-section">
                <div class="recipe-books-section__header">
                  <h4><span>${iconBookOpen}</span> <span data-i18n="saveToBooks">Зберегти в книгу</span></h4>
                </div>
                <div id="rm-book-selector"></div>
              </div>
            </div>

            <div class="preview-form__footer">
              <button type="button" id="rm-cancel" class="btn-secondary" data-i18n="cancelBtn">Скасувати</button>
              <button type="submit" class="btn-save" data-i18n="saveRecipe">Зберегти рецепт</button>
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
  const cancelBtn = document.getElementById('rm-cancel');
  const form = document.getElementById('recipe-modal-form');

  // Закриття
  closeBtn?.addEventListener('click', closeRecipeModal);
  recipeModalInstance?.addEventListener('click', (e) => {
    if (e.target === recipeModalInstance) closeRecipeModal();
  });

  // Скасувати у формі
  cancelBtn?.addEventListener('click', closeRecipeModal);

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
  const lang = getLang();
  setLanguage(lang);
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

  resetRecipeForm();

  if (recipeModalInstance) {
    recipeModalInstance.classList.add('is-active');
    lockScroll('recipe-create-modal');
  }

  await showRecipeForm();
}

export function closeRecipeModal() {
  if (recipeModalInstance) {
    recipeModalInstance.classList.remove('is-active');
    unlockScroll('recipe-create-modal');
  }
  onRecipeSavedCallback = null;
  resetRecipeForm();
}

function resetRecipeForm() {
  const form = document.getElementById('recipe-modal-form');
  if (form) form.reset();

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

  // Реініціалізуємо конструктор інгредієнтів при показі форми
  const lang = getLang();
  setLanguage(lang);
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
    setInputVal('rm-name', data.name || data.title);
    setInputVal('rm-calories', data.kcal || data.calories);
    setInputVal('rm-proteins', data.proteins || data.protein);
    setInputVal('rm-fats', data.fats || data.fat);
    setInputVal('rm-carbs', data.carbs);
    setInputVal('rm-steps', data.steps);
    setInputVal('rm-category', data.category || 'lunch');
    setInputVal('rm-image-url', data.image);
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
  // Shadow banned юзери — ЗАВЖДИ pending, навіть якщо обрали "для себе"
  const { data: profile } = await supabase
    .from('profiles').select('is_shadow_banned').eq('id', user.id).single();
  const isShadowBanned = profile?.is_shadow_banned === true;
  const isPublicSubmission = recipeVisibility === 'public';
  const status = isShadowBanned ? 'pending' : (isPublicSubmission ? 'pending' : 'draft');

  const nameVal = document.getElementById('rm-name')?.value.trim() ?? '';
  const stepsVal = document.getElementById('rm-steps')?.value.trim() ?? '';

  // Валідація тільки для публічних рецептів
  if (isPublicSubmission) {
    if (!nameVal) {
      showToast('Для публікації потрібна назва рецепту', 'error');
      return;
    }
    const hasIngredients = getIngredients().length > 0;
    if (!hasIngredients && !stepsVal) {
      showToast('Додайте інгредієнти або кроки приготування', 'error');
      return;
    }
  }

  const payload = {
    name_ua: nameVal,
    kcal: totals.kcal || 0,
    protein: parseFloat(totals.protein.toFixed(1)) || 0,
    fat: parseFloat(totals.fat.toFixed(1)) || 0,
    carbs: parseFloat(totals.carbs.toFixed(1)) || 0,
    fiber: parseFloat((totals.fiber || 0).toFixed(1)),
    category: document.getElementById('rm-category')?.value,
    ingredients: getIngredientsText(),
    steps: stepsVal,
    image: finalImage,
    user_id: user.id,
    status: status,
    is_public: isPublicSubmission,
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

  const visibilityText = status === 'pending' ? 'Рецепт надіслано на модерацію!' : 'Рецепт збережено!';
  showToast(visibilityText);

  closeRecipeModal();

  // Викликаємо callback щоб сторінка що відкрила модалку могла оновитись
  if (onRecipeSavedCallback) {
    onRecipeSavedCallback(data);
  }
}

