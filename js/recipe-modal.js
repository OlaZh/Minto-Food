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
            <h2>Варіанти створення рецепта ✨</h2>
            <p>Оцифруйте скриншот або запишіть власну ідею</p>
          </div>

          <div class="modal-card__options">
            <label class="option-card option-card--ai" for="recipe-modal-ai-upload">
              <input type="file" id="recipe-modal-ai-upload" accept="image/*" hidden />
              <div class="option-card__icon">📸</div>
              <div class="option-card__info">
                <h3>Завантажити скриншот</h3>
                <p>ШІ сам розпізнає текст та інгредієнти</p>
              </div>
            </label>

            <button class="option-card" id="recipe-modal-manual-btn" type="button">
              <div class="option-card__icon">✍️</div>
              <div class="option-card__info">
                <h3>Ввести вручну</h3>
                <p>Створіть рецепт з нуля самостійно</p>
              </div>
            </button>
          </div>

          <div class="recipe-add__smart-import">
            <label class="smart-import__label">
              <span>🥗</span> Знайти рецепт у базі
            </label>
            <div class="smart-import__wrapper">
              <input
                type="text"
                id="recipe-modal-api-search"
                class="smart-import__input"
                placeholder="Введіть назву страви..." />
              <button type="button" id="recipe-modal-api-btn" class="recipe-card__btn smart-import__btn">
                <span>Пошук</span>
              </button>
            </div>
            <div id="recipe-modal-api-results" class="api-results"></div>
          </div>
        </div>

        <div id="recipe-modal-preview-form" class="modal-form-wrapper" style="display: none">
          <div class="modal-card__header">
            <h2>Додати рецепт</h2>
            <p>Перевір дані перед збереженням</p>
          </div>

          <form class="preview-form" id="recipe-modal-form">
            <div class="preview-form__content">
              <div class="form-group">
                <label>Назва страви</label>
                <input type="text" id="rm-name" required placeholder="Назва страви, напр. «Млинці з медом»" />
              </div>

              <div class="recipe-macros-grid">
                <div class="form-group">
                  <label>Ккал</label>
                  <input type="number" id="rm-calories" placeholder="0" readonly />
                </div>
                <div class="form-group">
                  <label>Б</label>
                  <input type="number" id="rm-proteins" placeholder="0" readonly />
                </div>
                <div class="form-group">
                  <label>Ж</label>
                  <input type="number" id="rm-fats" placeholder="0" readonly />
                </div>
                <div class="form-group">
                  <label>В</label>
                  <input type="number" id="rm-carbs" placeholder="0" readonly />
                </div>
              </div>

              <div class="form-group">
                <label>Категорія</label>
                <select id="rm-category">
                  <option value="breakfast">Сніданок</option>
                  <option value="lunch">Обід</option>
                  <option value="dinner">Вечеря</option>
                  <option value="snack">Перекус</option>
                  <option value="dessert">Десерт</option>
                  <option value="drinks">Напої</option>
                  <option value="bakery">Випічка</option>
                  <option value="fast">Швидкі рецепти⏳</option>
                  <option value="no_power">Без світла⚡</option>
                </select>
              </div>

              <div class="form-group">
                <label>Інгредієнти</label>
                <div id="rm-ingredients-builder"></div>
              </div>

              <div class="form-group">
                <label>Спосіб приготування</label>
                <textarea id="rm-steps" placeholder="1. Закип'ятити воду..."></textarea>
              </div>

              <div class="form-media-box">
                <label>Фото страви</label>
                <div class="form-media-inner">
                  <input type="file" id="rm-image-file" accept="image/*" hidden />
                  <button
                    type="button"
                    class="btn-upload"
                    onclick="document.getElementById('rm-image-file').click()">
                    Завантажити фото 📸
                  </button>
                  <div class="form-separator"><span>— або —</span></div>
                  <div class="form-group">
                    <input type="text" id="rm-image-url" placeholder="Вставте URL фото..." />
                  </div>
                </div>
              </div>
            </div>

            <div class="preview-form__footer">
              <button type="button" id="rm-cancel" class="btn-secondary">Скасувати</button>
              <button type="submit" class="btn-save">Зберегти рецепт 🥗</button>
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

export function initRecipeModal() {
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
    if (e.key === 'Enter') searchRecipesApi();
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
// ВІДКРИТТЯ / ЗАКРИТТЯ
// =============================================================

export function openRecipeModal(onSaved = null) {
  onRecipeSavedCallback = onSaved;

  const optionsView = document.getElementById('recipe-modal-options-view');
  const previewForm = document.getElementById('recipe-modal-preview-form');

  if (optionsView) optionsView.style.display = 'block';
  if (previewForm) previewForm.style.display = 'none';

  resetRecipeForm();

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
}

// =============================================================
// ФОРМА — ПОКАЗАТИ З ДАНИМИ (АБО ПУСТУ)
// =============================================================

function showRecipeForm(data = null) {
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

  const payload = {
    name_ua: document.getElementById('rm-name')?.value.trim(),
    kcal: totals.kcal || 0,
    protein: parseFloat(totals.protein.toFixed(1)) || 0,
    fat: parseFloat(totals.fat.toFixed(1)) || 0,
    carbs: parseFloat(totals.carbs.toFixed(1)) || 0,
    category: document.getElementById('rm-category')?.value,
    steps: document.getElementById('rm-steps')?.value || '',
    image: finalImage,
    user_id: user ? user.id : null,
    status: 'draft',
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

  showToast('Рецепт збережено! ✓');
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

// =============================================================
// ХЕЛПЕРИ
// =============================================================

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  const icon = type === 'error' ? '❌' : '✅';
  toast.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-text">${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}
