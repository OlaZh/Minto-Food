// =============================================================
// 1. ОГОЛОШЕННЯ ЕЛЕМЕНТІВ (DOM)
// =============================================================

// Головна сторінка та додавання
const addBtn = document.getElementById('open-add-modal');
const modal = document.getElementById('add-recipe-modal');
const closeBtn = document.getElementById('close-modal');
const aiUploadInput = document.getElementById('ai-upload');
const manualBtn = document.getElementById('manual-entry-btn');

const optionsView = document.getElementById('initial-options-view');
const previewForm = document.getElementById('recipe-preview-form');

// ✅ Повертаємо простий селектор
const previewFormElement = document.querySelector('.preview-form');

const cancelPreview = document.getElementById('cancel-preview');

// Елементи модального вікна видалення
const confirmModal = document.getElementById('confirm-modal');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');

// Елементи модального вікна перегляду
const viewModal = document.getElementById('view-recipe-modal');
const closeViewModalBtn = document.getElementById('close-view-modal');
const closeViewBtn = document.getElementById('close-view-btn');
const saveNotesBtn = document.getElementById('save-notes-btn');

// =============================================================
// 2. ДАНІ ТА СТАН
// =============================================================

let globalShoppingList = JSON.parse(localStorage.getItem('minto_shopping_list')) || [];
let globalRecipes = JSON.parse(localStorage.getItem('minto_recipes')) || [];
let recipeIndexToDelete = null;
let currentViewingIndex = null;
let editingRecipeIndex = null;

// Твоя важлива логіка ваг
const unitGrades = {
  гр: 1,
  г: 1,
  кг: 1000,
  мл: 1,
  л: 1000,
  шт: 1,
  'ч.л': 1,
  'ст.л': 1,
};
// =============================================================
// 3. ДОПОМІЖНІ ФУНКЦІЇ
// =============================================================

const showToast = (message, type = 'success') => {
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  const icon = type === 'info' ? '⏳' : '✅';
  toast.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-text">${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
};

function parseAmount(amountStr) {
  if (typeof amountStr === 'number') return amountStr;
  if (!amountStr) return 0;
  if (amountStr.includes('/')) {
    const [num, den] = amountStr.split('/').map(Number);
    return num / den;
  }
  return parseFloat(amountStr.toString().replace(',', '.')) || 0;
}

// Функція для візуального оновлення зірок (ФІКС БАГУ №2)
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
      star.textContent = '★'; // Міняємо символ на зафарбований
    } else {
      star.classList.remove('filled');
      star.textContent = '☆'; // Міняємо символ на порожній
    }
  });

  if (valDisplay) valDisplay.textContent = numericRating > 0 ? numericRating.toFixed(1) : '0.0';
};
// =============================================================
// 4. ЛОГІКА ВІДОБРАЖЕННЯ КАРТОК (З РЕЙТИНГОМ)
// =============================================================

const displayRecipes = () => {
  const recipeGrid = document.querySelector('.recipe-grid');
  if (!recipeGrid) return;

  // Словник для перекладу
  const categoryTranslations = {
    all: 'Всі',
    breakfast: 'Сніданок',
    lunch: 'Обід',
    dinner: 'Вечеря',
    dessert: 'Десерти',
    snack: 'Перекуси',
    drinks: 'Напої',
    bakery: 'Випічка',
    fast: 'Швидкі рецепти ⚡',
  };

  recipeGrid.innerHTML = '';

  globalRecipes.forEach((recipe, index) => {
    const rating = recipe.rating || 0;
    const cardImage =
      recipe.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?q=80&w=500';

    // Перекладаємо категорію перед виводом
    const displayCategory = categoryTranslations[recipe.category] || recipe.category;

    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.innerHTML = `
      <div class="recipe-card__image-box">
        <img src="${cardImage}" alt="${recipe.name}" class="recipe-card__img">
        <div class="recipe-card__rating-badge" style="position:absolute;top:12px;left:48px;background:rgba(255,255,255,0.95);padding:3px 8px;border-radius:6px;font-weight:800;color:#333;font-size:11px;display:flex;align-items:center;gap:4px;box-shadow:0 2px 5px rgba(0,0,0,0.15);z-index:2;">
          <span style="color:#f1c40f;">★</span>
          <span>${rating > 0 ? rating.toFixed(1) : '0'}</span>
        </div>
        <div class="recipe-card__stats">${recipe.calories || 0} ккал</div>
        <button class="btn-delete-recipe" onclick="deleteRecipe(event, ${index})">✕</button>
      </div>
      <div class="recipe-card__content">
        <h3 class="recipe-card__name">${recipe.name}</h3>
        <p class="recipe-card__macros">Категорія: ${displayCategory}</p>
        <button class="recipe-card__btn" onclick="openRecipeView(${index})">Переглянути</button>
      </div>
    `;
    recipeGrid.appendChild(card);
  });
};
// =============================================================
// 5. ЛОГІКА ПЕРЕГЛЯДУ ТА РЕДАГУВАННЯ (РЕАНІМАЦІЯ)
// =============================================================

window.openRecipeView = function (index) {
  const recipe = globalRecipes[index];
  if (!recipe) {
    console.error('Рецепт не знайдено за індексом:', index);
    return;
  }

  currentViewingIndex = index;

  // Спрощена функція для заповнення тексту
  const setT = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '0';
  };

  setT('view-title', recipe.name);
  setT('view-calories', recipe.kcal || recipe.calories);
  setT('view-category', recipe.category);
  setT('view-proteins', recipe.proteins);
  setT('view-carbs', recipe.carbs);
  setT('view-fats', recipe.fats);

  // Оновлення рейтингу
  if (typeof updateStarsUI === 'function') {
    updateStarsUI(recipe.rating || 0);
  }

  // --- ІНГРЕДІЄНТИ ---
  const list = document.getElementById('view-ingredients-list');
  if (list) {
    list.innerHTML = '';
    const ingLines = (recipe.ingredients || '').split('\n').filter((l) => l.trim().length > 0);

    ingLines.forEach((line) => {
      const li = document.createElement('li');
      li.className = 'ingredient-item-row';

      // Логіка розділення назви та кількості
      const match = line
        .trim()
        .match(/^(.*?)\s+(\d+[\s.,x]*([г|мл|шт|ст\.?\s?л|ч\.?\s?л|кг|гр]+)?)$/i);
      if (match) {
        li.innerHTML = `<span>• ${match[1].trim()}</span> <span class="ing-count">${match[2].trim()}</span>`;
      } else {
        li.innerHTML = `<span>• ${line.trim()}</span>`;
      }
      list.appendChild(li);
    });
  }

  // --- СПОСІБ ПРИГОТУВАННЯ (ФІКС ЦИФР І ПУСТОТИ) ---
  const stepsContainer = document.getElementById('view-steps');
  if (stepsContainer) {
    stepsContainer.innerHTML = '';

    // Фільтруємо: тільки рядки, де є хоча б одна буква/цифра
    const stepLines = (recipe.steps || '')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => /[a-zA-Zа-яА-ЯіїєґІЇЄҐ0-9]/.test(s));

    stepLines.forEach((text, i) => {
      // Прибираємо старі цифри на початку
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
      editingRecipeIndex = index;
      if (viewModal) viewModal.classList.remove('is-active');

      if (modal) {
        modal.classList.add('is-active');
        // Показуємо форму редагування
        const options = document.getElementById('initial-options-view');
        const form = document.getElementById('recipe-preview-form');
        if (options) options.style.display = 'none';
        if (form) form.style.display = 'block';

        // Заповнюємо поля (пробуємо різні ID для надійності)
        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.value = val || '';
        };
        setVal('prev-name', recipe.name);
        setVal('prev-kcal', recipe.kcal || recipe.calories);
        setVal('prev-calories', recipe.kcal || recipe.calories);
        setVal('prev-ingredients', recipe.ingredients);
        setVal('prev-steps', recipe.steps);
        setVal('prev-category', recipe.category);
        setVal('prev-proteins', recipe.proteins);
        setVal('prev-carbs', recipe.carbs);
        setVal('prev-fats', recipe.fats);
      }
    };
  }

  // Відкриваємо модалку
  if (viewModal) {
    viewModal.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  }
};
// =============================================================
// 6. ЛОГІКА ВИДАЛЕННЯ
// =============================================================

window.deleteRecipe = (event, index) => {
  event.stopPropagation();
  recipeIndexToDelete = index;
  if (confirmModal) confirmModal.classList.add('is-active');
};

const closeConfirmModal = () => {
  if (confirmModal) confirmModal.classList.remove('is-active');
  recipeIndexToDelete = null;
};

if (confirmYesBtn) {
  confirmYesBtn.addEventListener('click', () => {
    if (recipeIndexToDelete !== null) {
      globalRecipes.splice(recipeIndexToDelete, 1);
      localStorage.setItem('minto_recipes', JSON.stringify(globalRecipes));
      displayRecipes();
      showToast('Рецепт видалено', 'info');
    }
    closeConfirmModal();
  });
}

if (confirmNoBtn) confirmNoBtn.addEventListener('click', closeConfirmModal);

// =============================================================
// 7. ДОДАВАННЯ ТА ФОРМИ
// =============================================================

// === НОРМАЛІЗАЦІЯ ІНГРЕДІЄНТІВ ===
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
  const isUnit = (s) => /^(г|гр|мл|л|шт|ст\.?\s?л|ч\.?\s?л)$/i.test(s);

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

const autoResizer = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

const closeModal = () => {
  if (modal) {
    modal.classList.remove('is-active');
    editingRecipeIndex = null;

    // Очищаємо тимчасову картинку від ШІ при закритті
    window.tempAiImage = null;

    if (previewFormElement) previewFormElement.reset();

    // Очищаємо підпис файлу в інпуті
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

const showForm = (data = null) => {
  if (!optionsView || !previewForm) return;

  // 1. Ховаємо кнопки вибору
  optionsView.style.display = 'none';

  // 2. ЗНАХОДИМО І ХОВАЄМО ПОШУК (той самий фікс)
  const apiSearchView =
    document.querySelector('.api-search-container') ||
    document.getElementById('api-search-results')?.parentElement;
  if (apiSearchView) {
    apiSearchView.style.display = 'none';
  }

  // 3. Показуємо форму
  previewForm.style.display = 'block';

  if (data) {
    // Якщо ШІ передав картинку — запам'ятовуємо її
    if (data.image) {
      window.tempAiImage = data.image;
    }

    document.getElementById('prev-name').value = data.name || '';

    const kcalInput =
      document.getElementById('prev-kcal') || document.getElementById('prev-calories');
    if (kcalInput) kcalInput.value = data.kcal || data.calories || '';

    document.getElementById('prev-ingredients').value = data.ingredients || '';
    document.getElementById('prev-steps').value = data.steps || '';
    document.getElementById('prev-category').value = data.category || 'breakfast';

    // БЖУ (якщо прийшли від ШІ)
    if (document.getElementById('prev-proteins'))
      document.getElementById('prev-proteins').value = data.proteins || '';
    if (document.getElementById('prev-carbs'))
      document.getElementById('prev-carbs').value = data.carbs || '';
    if (document.getElementById('prev-fats'))
      document.getElementById('prev-fats').value = data.fats || '';

    setTimeout(() => {
      const ingField = document.getElementById('prev-ingredients');
      const stepField = document.getElementById('prev-steps');
      autoResizer(ingField);
      autoResizer(stepField);
    }, 50);
  } else if (previewFormElement) {
    previewFormElement.reset();
    window.tempAiImage = null; // Скидаємо для ручного вводу
    const ingField = document.getElementById('prev-ingredients');
    const stepField = document.getElementById('prev-steps');
    if (ingField) ingField.style.height = 'auto';
    if (stepField) stepField.style.height = 'auto';
  }
};

function addIngredientsToCart(ingredientsString) {
  const lines = (ingredientsString || '').split('\n');
  lines.forEach((line) => {
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      const newItem = {
        name: parts[0],
        amount: parseAmount(parts[1]),
        unit: parts[2] || 'шт',
      };
      const existingItem = globalShoppingList.find(
        (i) => i.name.toLowerCase() === newItem.name.toLowerCase() && i.unit === newItem.unit,
      );
      if (existingItem) {
        existingItem.amount += newItem.amount;
      } else {
        globalShoppingList.push(newItem);
      }
    }
  });
  localStorage.setItem('minto_shopping_list', JSON.stringify(globalShoppingList));
}
// =============================================================
// 8. ШІ ТА ФОТО
// =============================================================

function initAiUpload() {
  const aiInput = document.getElementById('ai-upload');
  if (!aiInput) return;

  aiInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showToast('Зображення отримано! Аналізуємо...', 'info');

    // Перетворюємо фото в рядок відразу, щоб воно не загубилося
    const aiImageBase64 = await toBase64(file);

    const optionCard = aiInput.closest('.option-card');
    const originalContent = optionCard.innerHTML;
    optionsView.style.opacity = '0.5';
    optionsView.style.pointerEvents = 'none';
    optionCard.innerHTML = `<h3>⏳ Аналізую...</h3>`;

    setTimeout(() => {
      optionCard.innerHTML = originalContent;
      optionsView.style.opacity = '1';
      optionsView.style.pointerEvents = 'all';

      // Перезапускаємо слухач, бо ми переписали innerHTML
      initAiUpload();

      showForm({
        name: 'Вівсянка (AI скан)',
        image: aiImageBase64, // <--- ПЕРЕДАЄМО ФОТО СЮДИ
        calories: 320,
        proteins: 12,
        carbs: 45,
        fats: 6,
        category: 'breakfast',
        ingredients: 'Вівсянка, 50, г\nМолоко, 100, мл',
        steps: '1. Залити молоком.',
      });
    }, 1500);
  });
}

// --- ФУНКЦІЯ РОЗУМНОГО ІМПОРТУ (Minto Food) ---
// --- ПОШУК РЕЦЕПТІВ ЧЕРЕЗ API (Spoonacular + TheMealDB + Edamam) ---
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

  // 🔑 ТУТ ВСТАВИШ СВОЇ КЛЮЧІ
  const SPOON_KEY = 'YOUR_SPOON_KEY';
  const EDAMAM_ID = 'YOUR_EDAMAM_ID';
  const EDAMAM_KEY = 'YOUR_EDAMAM_KEY';

  // --- 1) Spoonacular ---
  async function fetchSpoon() {
    try {
      const resp = await fetch(
        `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(
          query,
        )}&number=10&addRecipeInformation=true&apiKey=${SPOON_KEY}`,
      );
      const data = await resp.json();
      return data.results || [];
    } catch {
      return [];
    }
  }

  // --- 2) TheMealDB ---
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

  // --- 3) Edamam (fallback) ---
  async function fetchEdamam() {
    try {
      const resp = await fetch(
        `https://api.edamam.com/search?q=${encodeURIComponent(
          query,
        )}&app_id=${EDAMAM_ID}&app_key=${EDAMAM_KEY}&to=10`,
      );
      const data = await resp.json();
      return data.hits || [];
    } catch {
      return [];
    }
  }

  // --- Паралельний пошук Spoonacular + MealDB ---
  const [spoon, mealdb] = await Promise.all([fetchSpoon(), fetchMealDB()]);

  let results = [];

  if (spoon.length > 0) {
    results = spoon.map((r) => ({
      title: r.title,
      image: r.image,
      ingredients: (r.extendedIngredients || []).map((i) => i.original).join('\n'),
      steps:
        (r.analyzedInstructions?.[0]?.steps || [])
          .map((s, i) => `${i + 1}. ${s.step}`)
          .join('\n') || '',
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
  } else {
    // --- Якщо нічого не знайдено — Edamam ---
    const edamam = await fetchEdamam();
    results = edamam.map((e) => ({
      title: e.recipe.label,
      image: e.recipe.image,
      ingredients: e.recipe.ingredientLines.join('\n'),
      steps: '',
    }));
  }

  if (results.length === 0) {
    resultsContainer.innerHTML = `<p>Нічого не знайдено. Спробуйте інший запит.</p>`;
    btn.disabled = false;
    if (btnText) btnText.innerText = originalText;
    return;
  }

  // --- Відображення результатів ---
  results.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'api-result-card';
    card.innerHTML = `
      <div class="api-result-card__image-box">
        <img src="${r.image || ''}" alt="${r.title || ''}">
      </div>
      <div class="api-result-card__content">
        <h4>${r.title || 'Без назви'}</h4>
        <button type="button" class="recipe-card__btn api-add-btn">
          Додати цей рецепт
        </button>
      </div>
    `;

    const addBtn = card.querySelector('.api-add-btn');
    addBtn.addEventListener('click', () => {
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
// 9. СЛУХАЧІ ПОДІЙ ТА ІНІЦІАЛІЗАЦІЯ
// =============================================================

// Допоміжна функція для вічного зберігання фото (Base64)
const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

// --- Функція авто-розрахунку калорій ---
const calculateKcal = () => {
  const p = parseFloat(document.getElementById('prev-proteins')?.value) || 0;
  const c = parseFloat(document.getElementById('prev-carbs')?.value) || 0;
  const f = parseFloat(document.getElementById('prev-fats')?.value) || 0;

  const totalKcal = Math.round(p * 4 + c * 4 + f * 9);

  const kcalInput =
    document.getElementById('prev-kcal') || document.getElementById('prev-calories');
  if (kcalInput) {
    kcalInput.value = totalKcal > 0 ? totalKcal : '';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  displayRecipes();
  initAiUpload();

  // Ініціалізація авто-розрахунку БЖУ
  ['prev-proteins', 'prev-carbs', 'prev-fats'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calculateKcal);
  });

  // Логіка кліку по зірках
  const ratingContainer = document.querySelector('.recipe-rating');
  if (ratingContainer) {
    ratingContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('star')) {
        const newRating = Number(e.target.dataset.value);

        if (currentViewingIndex !== null) {
          globalRecipes[currentViewingIndex].rating = newRating;
          localStorage.setItem('minto_recipes', JSON.stringify(globalRecipes));

          updateStarsUI(newRating);
          displayRecipes(); // Оновлюємо бейдж на головній
          showToast('Оцінку збережено!');
        }
      }
    });
  }
});

// Інші слухачі
if (addBtn)
  addBtn.addEventListener('click', () => {
    modal.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  });

const closeViewModal = () => {
  if (viewModal) {
    viewModal.classList.remove('is-active');
    document.body.style.overflow = '';
    currentViewingIndex = null;
  }
};

if (closeBtn) closeBtn.addEventListener('click', closeModal);
if (closeViewModalBtn) closeViewModalBtn.addEventListener('click', closeViewModal);
if (closeViewBtn) closeViewBtn.addEventListener('click', closeViewModal);

if (saveNotesBtn) {
  saveNotesBtn.addEventListener('click', () => {
    const notesValue = document.getElementById('view-notes')?.value;
    if (currentViewingIndex !== null) {
      globalRecipes[currentViewingIndex].notes = notesValue;
      localStorage.setItem('minto_recipes', JSON.stringify(globalRecipes));
      showToast('Нотатку збережено!');
    }
  });
}

const apiSearchBtn = document.getElementById('btn-api-search');
if (apiSearchBtn) {
  apiSearchBtn.addEventListener('click', searchRecipesFromApi);
}

window.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
  if (e.target === confirmModal) closeConfirmModal();
  if (e.target === viewModal) closeViewModal();
});

if (cancelPreview)
  cancelPreview.addEventListener('click', () => {
    previewForm.style.display = 'none';
    optionsView.style.display = 'block';
  });

if (manualBtn) manualBtn.addEventListener('click', () => showForm());

if (previewFormElement) {
  previewFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();

    // --- ЛОГІКА ФОТО ---
    const fileInput = document.getElementById('recipe-image');
    const urlInput = document.getElementById('recipe-image-url');
    let finalImageUrl = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?q=80&w=500';

    if (fileInput && fileInput.files && fileInput.files[0]) {
      finalImageUrl = await toBase64(fileInput.files[0]);
    } else if (urlInput && urlInput.value.trim() !== '') {
      finalImageUrl = urlInput.value.trim();
    } else if (window.tempAiImage) {
      finalImageUrl = window.tempAiImage;
    } else if (editingRecipeIndex !== null) {
      finalImageUrl = globalRecipes[editingRecipeIndex].image || finalImageUrl;
    }

    // Збираємо дані з форми
    const recipeData = {
      name: document.getElementById('prev-name').value,
      image: finalImageUrl,
      calories:
        document.getElementById('prev-kcal')?.value ||
        document.getElementById('prev-calories')?.value ||
        0,
      category: document.getElementById('prev-category').value,
      ingredients: normalizeIngredients(document.getElementById('prev-ingredients').value),
      steps: document.getElementById('prev-steps').value,
      proteins: document.getElementById('prev-proteins')?.value || 0,
      carbs: document.getElementById('prev-carbs')?.value || 0,
      fats: document.getElementById('prev-fats')?.value || 0,
      rating: editingRecipeIndex !== null ? globalRecipes[editingRecipeIndex].rating : 0,
      notes: editingRecipeIndex !== null ? globalRecipes[editingRecipeIndex].notes : '',
    };

    if (editingRecipeIndex !== null) {
      globalRecipes[editingRecipeIndex] = recipeData;
      showToast('Рецепт оновлено!');
    } else {
      globalRecipes.push(recipeData);
      showToast('Рецепт збережено!');
      addIngredientsToCart(recipeData.ingredients);
    }

    localStorage.setItem('minto_recipes', JSON.stringify(globalRecipes));

    editingRecipeIndex = null;
    window.tempAiImage = null;

    displayRecipes();
    closeModal();
  });
}

// Застосовуємо до інгредієнтів та кроків
document.querySelectorAll('textarea').forEach((txt) => {
  txt.style.overflow = 'hidden';
  txt.addEventListener('input', () => autoResizer(txt));
});

// =============================================================
// 10. ПОШУК ТА ФІЛЬТРАЦІЯ (SMART SEARCH - IN PLACE)
// =============================================================

const searchInput = document.getElementById('recipe-search-input');
const searchModeBtn = document.getElementById('search-mode-btn');
// Додаємо хрестик
const clearSearchBtn = document.getElementById('clear-search-btn'); 

const iconSearch = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
const iconGlobal = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20"></path></svg>`;

if (searchModeBtn) searchModeBtn.innerHTML = iconSearch;

// 1. ФУНКЦІЯ ФІЛЬТРАЦІЇ ВЛАСНИХ РЕЦЕПТІВ
function filterRecipes(query) {
  const filtered = globalRecipes.filter((recipe) => {
    const nameMatch = recipe.name.toLowerCase().includes(query);
    const ingMatch = (recipe.ingredients || '').toLowerCase().includes(query);
    return nameMatch || ingMatch;
  });
  renderFilteredRecipes(filtered, query, false);
}

// 2. УНІВЕРСАЛЬНИЙ РЕНДЕР (ДЛЯ СВОЇХ І ДЛЯ ГЛОБАЛЬНИХ)
function renderFilteredRecipes(recipes, query = '', isGlobal = false) {
  const recipeGrid = document.querySelector('.recipe-grid');
  if (!recipeGrid) return;

  recipeGrid.innerHTML = '';

  if (recipes.length === 0 && !isGlobal) {
    recipeGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #888;">
        <p>У власній базі немає "<strong>${query}</strong>". Натисніть на планету 🌐 для пошуку ідей.</p>
      </div>`;
    return;
  }

  const categoryTranslations = {
    all: 'Всі', breakfast: 'Сніданок', lunch: 'Обід', dinner: 'Вечеря',
    dessert: 'Десерти', snack: 'Перекуси', drinks: 'Напої', bakery: 'Випічка', fast: 'Швидкі ⚡'
  };

  recipes.forEach((recipe, index) => {
    const rating = recipe.rating || 0;
    const title = isGlobal ? (recipe.title || recipe.name) : recipe.name;
    const cardImage = recipe.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?q=80&w=500';

    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.innerHTML = `
      <div class="recipe-card__image-box">
        <img src="${cardImage}" alt="${title}" class="recipe-card__img">
        ${!isGlobal ? `
          <div class="recipe-card__rating-badge" style="position:absolute;top:12px;left:48px;background:rgba(255,255,255,0.95);padding:3px 8px;border-radius:6px;font-weight:800;color:#333;font-size:11px;display:flex;align-items:center;gap:4px;z-index:2;">
            <span style="color:#f1c40f;">★</span><span>${rating > 0 ? rating.toFixed(1) : '0'}</span>
          </div>
          <button class="btn-delete-recipe" onclick="deleteRecipe(event, ${index})">✕</button>
        ` : `<div class="recipe-card__stats" style="background:var(--color-accent); color:#fff;">Світ</div>`}
      </div>
      <div class="recipe-card__content">
        <h3 class="recipe-card__name">${title}</h3>
        <p class="recipe-card__macros">${isGlobal ? 'Знайдено в мережі' : 'Категорія: ' + (categoryTranslations[recipe.category] || recipe.category)}</p>
        <button class="recipe-card__btn">${isGlobal ? 'Додати собі' : 'Переглянути'}</button>
      </div>
    `;

    const btn = card.querySelector('.recipe-card__btn');
    btn.addEventListener('click', () => {
      if (isGlobal) {
        showForm({
          name: title,
          image: recipe.image,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          category: 'lunch'
        });
        modal.classList.add('is-active');
      } else {
        openRecipeView(index);
      }
    });

    recipeGrid.appendChild(card);
  });
}

// 3. СЛУХАЧ ІНПУТУ (ЗМІНА ІКОНКИ, ХРЕСТИК ТА ФІЛЬТРАЦІЯ)
if (searchInput) {
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    
    // Керуємо видимістю хрестика
    if (clearSearchBtn) {
      clearSearchBtn.style.display = query.length > 0 ? 'flex' : 'none';
    }

    if (query.length > 0) {
      searchModeBtn.innerHTML = iconGlobal;
      searchModeBtn.classList.add('is-active');
      filterRecipes(query);
    } else {
      searchModeBtn.innerHTML = iconSearch;
      searchModeBtn.classList.remove('is-active');
      displayRecipes();
    }
  });
}

// 🔑 НОВА ЧАСТИНА: КЛІК НА ХРЕСТИК (ОЧИЩЕННЯ)
if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    searchModeBtn.innerHTML = iconSearch;
    searchModeBtn.classList.remove('is-active');
    displayRecipes(); // Скидаємо фільтр
    searchInput.focus();
  });
}

// 4. КЛІК НА ПЛАНЕТУ: ЗАМІНА ТВОЇХ РЕЦЕПТІВ НА ГЛОБАЛЬНІ ПРЯМО В GRID
if (searchModeBtn) {
  searchModeBtn.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (!query) {
      searchInput.focus();
      return;
    }

    const recipeGrid = document.querySelector('.recipe-grid');
    recipeGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 50px;">
      <p>🌎 Шукаємо нові ідеї для "<strong>${query}</strong>"...</p>
    </div>`;

    const SPOON_KEY = 'YOUR_SPOON_KEY'; 
    try {
      const resp = await fetch(`https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(query)}&number=12&addRecipeInformation=true&apiKey=${SPOON_KEY}`);
      const data = await resp.json();
      
      const results = (data.results || []).map(r => ({
        title: r.title,
        image: r.image,
        ingredients: (r.extendedIngredients || []).map(i => i.original).join('\n'),
        steps: (r.analyzedInstructions?.[0]?.steps || []).map((s, i) => `${i + 1}. ${s.step}`).join('\n')
      }));

      renderFilteredRecipes(results, query, true);

    } catch (err) {
      recipeGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center;">Не вдалося підключитися до глобальної бази.</p>`;
    }
  });
}