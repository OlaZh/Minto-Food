import { supabase } from './supabaseClient.js';
import {
  initIngredientBuilder,
  getIngredients,
  getIngredientsText,
  getTotals,
  clearIngredients,
  setIngredientsFromText,
  setLanguage,
} from './recipe-ingredients.js';
import { showToast, toBase64, setInputVal } from './utils.js';
import { getLang } from './storage.js';
import { lockScroll, unlockScroll } from './scroll-lock.js';
import { iconCamera, iconLock, iconGlobe, iconBookOpen } from './icons.js';
import {
  initBookSelector,
  createInlineBookSelector,
  getRecipeBooks,
  getSelectedBooksFromContainer,
  saveRecipeToBooks,
  refreshBooks,
} from './book-selector.js';

let recipeVisibility = 'private';
let recipeModalInstance = null;
let onRecipeSavedCallback = null;
let editingRecipeId = null;
let editingRecipeOriginal = null;

function parsePositiveNumber(value) {
  const normalized = String(value ?? '').replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatMacroValue(value, decimals = 1) {
  const num = Number(value) || 0;
  if (decimals === 0) return String(Math.round(num));
  return num.toFixed(decimals).replace('.', ',');
}

function getDisplayedNutrition(totals, totalWeight) {
  if (!totalWeight) {
    return {
      kcal: totals.kcal || 0,
      protein: totals.protein || 0,
      fat: totals.fat || 0,
      carbs: totals.carbs || 0,
      fiber: totals.fiber || 0,
      mode: 'raw',
    };
  }

  const factor = 100 / totalWeight;
  return {
    kcal: (totals.kcal || 0) * factor,
    protein: (totals.protein || 0) * factor,
    fat: (totals.fat || 0) * factor,
    carbs: (totals.carbs || 0) * factor,
    fiber: (totals.fiber || 0) * factor,
    mode: 'cooked',
  };
}

function updateRecipeNutritionPreview(totals = getTotals()) {
  const totalWeight = parsePositiveNumber(document.getElementById('rm-total-weight')?.value);
  const displayed = getDisplayedNutrition(totals, totalWeight);

  const kcalEl = document.getElementById('rm-calories');
  const proteinEl = document.getElementById('rm-proteins');
  const fatEl = document.getElementById('rm-fats');
  const carbsEl = document.getElementById('rm-carbs');
  const noteEl = document.getElementById('rm-macros-note');

  if (kcalEl) kcalEl.value = formatMacroValue(displayed.kcal, 0);
  if (proteinEl) proteinEl.value = formatMacroValue(displayed.protein, 1);
  if (fatEl) fatEl.value = formatMacroValue(displayed.fat, 1);
  if (carbsEl) carbsEl.value = formatMacroValue(displayed.carbs, 1);

  if (noteEl) {
    noteEl.textContent = displayed.mode === 'cooked'
      ? `Готова страва: приблизно ${formatMacroValue(displayed.kcal, 0)} ккал на 100 г`
      : 'Сума сирих інгредієнтів. Вкажіть вагу готової страви, щоб побачити КБЖУ на 100 г.';
  }
}

// Оновлює лише підпис під КБЖ, не чіпаючи самі поля. Потрібно при редагуванні,
// де поля КБЖ показують збережені значення, але підпис має відповідати вазі.
function updateNutritionNoteOnly(kcalForNote) {
  const noteEl = document.getElementById('rm-macros-note');
  if (!noteEl) return;

  const totalWeight = parsePositiveNumber(document.getElementById('rm-total-weight')?.value);
  noteEl.textContent = totalWeight
    ? `Готова страва: приблизно ${formatMacroValue(kcalForNote, 0)} ккал на 100 г`
    : 'Сума сирих інгредієнтів. Вкажіть вагу готової страви, щоб побачити КБЖУ на 100 г.';
}

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
                <input
                  type="text"
                  id="rm-name"
                  required
                  placeholder="Назва страви, напр. «Млинці з медом»"
                  data-i18n-placeholder="dishNamePlaceholder"
                />
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

              <p class="recipe-macros-note" id="rm-macros-note">
                Сума сирих інгредієнтів. Вкажіть вагу готової страви, щоб побачити КБЖУ на 100 г.
              </p>

              <div class="form-group">
                <label for="rm-total-weight">Вага готової страви (г)</label>
                <input type="number" id="rm-total-weight" min="1" step="1" placeholder="Наприклад, 850" />
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

function initVisibilityToggle() {
  const toggle = document.getElementById('visibility-toggle');
  if (!toggle) return;

  const options = toggle.querySelectorAll('.visibility-toggle__option');
  options.forEach((option) => {
    option.addEventListener('click', () => {
      options.forEach((item) => item.classList.remove('visibility-toggle__option--active'));
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
    option.classList.toggle('visibility-toggle__option--active', option.dataset.visibility === 'private');
  });
}

function setVisibilityToggle(value = 'private') {
  recipeVisibility = value === 'public' ? 'public' : 'private';
  const toggle = document.getElementById('visibility-toggle');
  if (!toggle) return;

  const options = toggle.querySelectorAll('.visibility-toggle__option');
  options.forEach((option) => {
    option.classList.toggle('visibility-toggle__option--active', option.dataset.visibility === recipeVisibility);
  });
}

function bindIngredientBuilder() {
  const lang = getLang();
  setLanguage(lang);
  initIngredientBuilder(
    '#rm-ingredients-builder',
    (_ingredients, totals) => {
      updateRecipeNutritionPreview(totals);
    },
    lang,
  );
  updateRecipeNutritionPreview();
}

export async function initRecipeModal() {
  await initBookSelector();

  if (!document.getElementById('recipe-create-modal')) {
    document.body.appendChild(createRecipeModalHTML());
  }

  recipeModalInstance = document.getElementById('recipe-create-modal');

  const closeBtn = document.getElementById('recipe-modal-close');
  const cancelBtn = document.getElementById('rm-cancel');
  const form = document.getElementById('recipe-modal-form');
  const totalWeightInput = document.getElementById('rm-total-weight');

  closeBtn?.addEventListener('click', closeRecipeModal);
  cancelBtn?.addEventListener('click', closeRecipeModal);

  recipeModalInstance?.querySelectorAll('textarea').forEach((textarea) => {
    textarea.style.overflow = 'hidden';
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveRecipe();
  });

  totalWeightInput?.addEventListener('input', () => {
    updateRecipeNutritionPreview();
  });

  initVisibilityToggle();
  bindIngredientBuilder();
}

export async function openRecipeModal(onSaved = null) {
  onRecipeSavedCallback = onSaved;
  editingRecipeId = null;
  editingRecipeOriginal = null;
  resetRecipeForm();

  if (recipeModalInstance) {
    recipeModalInstance.classList.add('is-active');
    lockScroll('recipe-create-modal');
  }

  await showRecipeForm();
}

export async function openRecipeModalForEdit(recipe, onSaved = null) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !recipe || recipe.user_id !== user.id) {
    showToast('Редагувати можна лише власні рецепти', 'error');
    return;
  }

  onRecipeSavedCallback = onSaved;
  editingRecipeId = recipe.id ?? null;
  editingRecipeOriginal = recipe || null;
  resetRecipeForm();

  if (recipeModalInstance) {
    recipeModalInstance.classList.add('is-active');
    lockScroll('recipe-create-modal');
  }

  await showRecipeForm(recipe);
}

export function closeRecipeModal() {
  if (recipeModalInstance) {
    recipeModalInstance.classList.remove('is-active');
    unlockScroll('recipe-create-modal');
  }

  onRecipeSavedCallback = null;
  editingRecipeId = null;
  editingRecipeOriginal = null;
  resetRecipeForm();
}

function resetRecipeForm() {
  const form = document.getElementById('recipe-modal-form');
  if (form) form.reset();

  clearIngredients();
  resetVisibilityToggle();

  const booksSection = document.querySelector('.recipe-books-section');
  if (booksSection) booksSection.hidden = false;

  const bookSelector = document.getElementById('rm-book-selector');
  if (bookSelector) bookSelector.innerHTML = '';

  updateRecipeNutritionPreview();
}

async function showRecipeForm(data = null) {
  bindIngredientBuilder();

  await refreshBooks();
  const booksSection = document.querySelector('.recipe-books-section');
  if (booksSection) booksSection.hidden = !!data;

  const preselectedBookIds = data?.id ? await getRecipeBooks(data.id) : [];
  createInlineBookSelector('rm-book-selector', preselectedBookIds);

  if (data) {
    setInputVal('rm-name', data.name_ua || data.name || data.title);
    setInputVal('rm-steps', data.steps);
    setInputVal('rm-total-weight', data.total_weight);
    setInputVal('rm-category', data.category || 'lunch');
    setInputVal('rm-image-url', data.image);
    setVisibilityToggle(data.is_public ? 'public' : 'private');

    // Парсинг інгредієнтів тригерить перерахунок КБЖ (через notifyChange).
    // Робимо це ДО відновлення збережених значень, щоб вони не затирались.
    await setIngredientsFromText(data.ingredients || '');

    // При редагуванні показуємо вже збережені КБЖ, а не перерахунок з нуля:
    // повторний парсинг може не розпізнати частину інгредієнтів і дати 0.
    // Реальний перерахунок відбудеться, лише якщо людина змінить інгредієнти.
    const savedKcal = data.kcal || data.calories || 0;
    setInputVal('rm-calories', savedKcal);
    setInputVal('rm-proteins', data.proteins || data.protein);
    setInputVal('rm-fats', data.fats || data.fat);
    setInputVal('rm-carbs', data.carbs);
    updateNutritionNoteOnly(savedKcal);
  } else {
    updateRecipeNutritionPreview();
  }
}

async function saveRecipe() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    showToast('Увійдіть, щоб зберігати рецепти', 'error');
    return;
  }

  if (editingRecipeId !== null && editingRecipeOriginal?.user_id !== user.id) {
    showToast('Редагувати можна лише власні рецепти', 'error');
    return;
  }

  const fileInput = document.getElementById('rm-image-file');
  const urlInput = document.getElementById('rm-image-url');
  let finalImage = '';

  if (fileInput?.files?.[0]) {
    finalImage = await toBase64(fileInput.files[0]);
  } else if (urlInput?.value.trim()) {
    finalImage = urlInput.value.trim();
  } else if (editingRecipeOriginal?.image) {
    finalImage = editingRecipeOriginal.image;
  }

  const totals = getTotals();
  const totalWeightVal = parsePositiveNumber(document.getElementById('rm-total-weight')?.value);
  const displayedNutrition = getDisplayedNutrition(totals, totalWeightVal);

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_shadow_banned')
    .eq('id', user.id)
    .single();

  const isShadowBanned = profile?.is_shadow_banned === true;
  const isPublicSubmission = recipeVisibility === 'public';
  const status = isShadowBanned ? 'pending' : (isPublicSubmission ? 'pending' : 'draft');

  const nameVal = document.getElementById('rm-name')?.value.trim() ?? '';
  const stepsVal = document.getElementById('rm-steps')?.value.trim() ?? '';

  if (isPublicSubmission) {
    if (!nameVal) {
      showToast('Для публікації потрібна назва рецепту', 'error');
      return;
    }

    const hasIngredients = !!getIngredientsText().trim();
    if (!hasIngredients && !stepsVal) {
      showToast('Додайте інгредієнти або кроки приготування', 'error');
      return;
    }
  }

  const payload = {
    name_ua: nameVal,
    kcal: parseFloat(displayedNutrition.kcal.toFixed(1)) || 0,
    protein: parseFloat(displayedNutrition.protein.toFixed(1)) || 0,
    fat: parseFloat(displayedNutrition.fat.toFixed(1)) || 0,
    carbs: parseFloat(displayedNutrition.carbs.toFixed(1)) || 0,
    fiber: parseFloat(displayedNutrition.fiber.toFixed(1)) || 0,
    total_weight: totalWeightVal,
    category: document.getElementById('rm-category')?.value,
    ingredients: getIngredientsText(),
    steps: stepsVal,
    image: finalImage,
    user_id: user.id,
    status,
    is_public: isPublicSubmission,
  };

  let data = null;
  let error = null;

  if (editingRecipeId !== null) {
    if (editingRecipeOriginal?.status === 'published') {
      const moderatedFields = ['image', 'steps', 'name_ua'];
      const pendingChanges = {};
      const directPayload = { ...payload };

      moderatedFields.forEach((field) => {
        const newValue = payload[field];
        const oldValue = editingRecipeOriginal?.[field];
        const changed = newValue !== oldValue && !(newValue == null && oldValue == null);

        if (changed) {
          pendingChanges[field] = newValue;
          delete directPayload[field];
        }
      });

      if (Object.keys(directPayload).length > 0) {
        const directResult = await supabase
          .from('recipes')
          .update(directPayload)
          .eq('id', editingRecipeId)
          .eq('user_id', user.id);
        error = directResult.error || null;
      }

      if (!error && Object.keys(pendingChanges).length > 0) {
        const pendingResult = await supabase.from('recipe_pending_updates').insert({
          recipe_id: editingRecipeId,
          user_id: user.id,
          changes: pendingChanges,
        });
        error = pendingResult.error || null;

        if (!error) {
          const pendingFlagResult = await supabase
            .from('recipes')
            .update({ has_pending_update: true })
            .eq('id', editingRecipeId)
            .eq('user_id', user.id);
          error = pendingFlagResult.error || null;
        }
      }

      if (!error) {
        const fetchResult = await supabase
          .from('recipes')
          .select('*')
          .eq('id', editingRecipeId)
          .eq('user_id', user.id)
          .single();
        data = fetchResult.data || null;
        error = fetchResult.error || null;
      }
    } else {
      const updateResult = await supabase
        .from('recipes')
        .update(payload)
        .eq('id', editingRecipeId)
        .eq('user_id', user.id)
        .select()
        .single();
      data = updateResult.data || null;
      error = updateResult.error || null;
    }
  } else {
    const insertResult = await supabase.from('recipes').insert([payload]).select().single();
    data = insertResult.data || null;
    error = insertResult.error || null;
  }

  if (error) {
    console.error('Помилка збереження рецепту:', error);
    showToast('Помилка збереження', 'error');
    return;
  }

  const ingredients = getIngredients();
  if (editingRecipeId !== null && data?.id) {
    const { error: deleteIngredientsError } = await supabase
      .from('product_recipe')
      .delete()
      .eq('recipe_id', data.id);

    if (deleteIngredientsError) {
      console.error('Error replacing recipe ingredients:', deleteIngredientsError);
    }
  }

  if (ingredients.length > 0 && data?.id) {
    const ingredientRows = ingredients
      .filter((ingredient) => ingredient.id)
      .map((ingredient) => ({
        recipe_id: data.id,
        ingredient_id: ingredient.id,
        amount: ingredient.weight,
        unit: ingredient.unit || 'g',
      }));

    if (ingredientRows.length > 0) {
      const { error: ingredientError } = await supabase.from('product_recipe').insert(ingredientRows);
      if (ingredientError) {
        console.error('Помилка збереження інгредієнтів:', ingredientError);
      }
    }
  }

  const selectedBookIds = getSelectedBooksFromContainer('rm-book-selector');
  if (editingRecipeId === null && selectedBookIds.length > 0 && data?.id) {
    await saveRecipeToBooks(data.id, selectedBookIds);
  }

  if (editingRecipeId !== null) {
    const hasModeratedChanges = editingRecipeOriginal?.status === 'published' && (
      payload.name_ua !== editingRecipeOriginal?.name_ua ||
      payload.steps !== editingRecipeOriginal?.steps ||
      payload.image !== editingRecipeOriginal?.image
    );

    showToast(hasModeratedChanges ? 'Зміни надіслані на перевірку' : 'Рецепт оновлено!');
  } else if (selectedBookIds.length === 0) {
    showToast(status === 'pending' ? 'Рецепт надіслано на модерацію!' : 'Рецепт збережено!');
  }

  closeRecipeModal();

  if (onRecipeSavedCallback) {
    onRecipeSavedCallback(data);
  }
}
