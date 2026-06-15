// =============================================================
// book-selector.js — модуль вибору книг для збереження рецептів
// =============================================================

import { supabase } from './supabaseClient.js';
import { showToast, escapeHTML } from './utils.js';
import { lockScroll, unlockScroll } from './scroll-lock.js';
import { BOOK_ICONS, iconFlag } from './icons.js';

// =============================================================
// СТАН
// =============================================================

let currentUserId = null;
let cachedBooks = [];
let selectorModal = null;
let onSelectCallback = null;
let previouslySavedBookIds = [];

// =============================================================
// ІНІЦІАЛІЗАЦІЯ
// =============================================================

export async function initBookSelector() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    currentUserId = user.id;
    await loadBooks();
  }

  createSelectorModal();
}

async function loadBooks() {
  if (!currentUserId) return;

  const { data, error } = await supabase
    .from('cookbooks')
    .select('*')
    .eq('user_id', currentUserId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (!error) {
    cachedBooks = data || [];
  }
}

// =============================================================
// ОТРИМАННЯ КНИГ
// =============================================================

export function getDefaultBook() {
  return cachedBooks.find((b) => b.is_default) || cachedBooks[0] || null;
}

export async function refreshBooks() {
  await loadBooks();
  return cachedBooks;
}

// =============================================================
// ШВИДКЕ ЗБЕРЕЖЕННЯ (СЕРДЕЧКО)
// =============================================================

export async function quickSaveToDefault(recipeId) {
  if (!currentUserId) {
    showToast('Увійдіть, щоб зберігати рецепти', 'error');
    return false;
  }

  const defaultBook = getDefaultBook();

  if (!defaultBook) {
    // Створюємо головну книгу якщо немає
    const { data, error } = await supabase
      .from('cookbooks')
      .insert([
        {
          user_id: currentUserId,
          name: 'Мої рецепти',
          icon: 'book',
          is_default: true,
        },
      ])
      .select()
      .maybeSingle();

    if (error) {
      showToast('Помилка створення книги', 'error');
      return false;
    }

    cachedBooks = [data];
    return await saveRecipeToBook(recipeId, data.id, data.name);
  }

  return await saveRecipeToBook(recipeId, defaultBook.id, defaultBook.name);
}

// =============================================================
// ЗБЕРЕЖЕННЯ В КОНКРЕТНУ КНИГУ
// =============================================================

export async function saveRecipeToBook(recipeId, bookId, bookName = null) {
  // Перевіряємо чи вже збережено
  const { data: existing } = await supabase
    .from('cookbook_recipes')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('cookbook_id', bookId)
    .maybeSingle();

  if (existing) {
    showToast(`Вже є в "${bookName || 'книзі'}"`, 'info');
    return true;
  }

  const { error } = await supabase.from('cookbook_recipes').insert([
    {
      recipe_id: recipeId,
      cookbook_id: bookId,
    },
  ]);

  if (error) {
    console.error('Error saving to book:', error);
    showToast('Помилка збереження', 'error');
    return false;
  }

  showToast(`Збережено в "${bookName || 'книгу'}"`);
  return true;
}

// =============================================================
// ЗБЕРЕЖЕННЯ В КІЛЬКА КНИГ
// =============================================================

export async function saveRecipeToBooks(recipeId, bookIds) {
  if (!bookIds.length) return false;

  const results = await Promise.all(
    bookIds.map(async (bookId) => {
      const book = cachedBooks.find((b) => b.id === bookId);
      return await saveRecipeToBook(recipeId, bookId, book?.name);
    }),
  );

  return results.every((r) => r);
}

// =============================================================
// ВИДАЛЕННЯ З КНИГИ
// =============================================================

export async function removeRecipeFromBook(recipeId, bookId) {
  const { error } = await supabase
    .from('cookbook_recipes')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('cookbook_id', bookId);

  if (error) {
    console.error('Error removing from book:', error);
    showToast('Помилка видалення', 'error');
    return false;
  }

  showToast('Видалено з книги');
  return true;
}

// =============================================================
// ПЕРЕВІРКА ЧИ РЕЦЕПТ ЗБЕРЕЖЕНО
// =============================================================

export async function isRecipeSaved(recipeId) {
  if (!currentUserId) return false;

  const { data } = await supabase
    .from('cookbook_recipes')
    .select('cookbook_id')
    .eq('recipe_id', recipeId)
    .limit(1);

  return data && data.length > 0;
}

export async function getRecipeBooks(recipeId) {
  if (!currentUserId) return [];

  const { data } = await supabase
    .from('cookbook_recipes')
    .select('cookbook_id')
    .eq('recipe_id', recipeId);

  return data ? data.map((d) => d.cookbook_id) : [];
}

// =============================================================
// МОДАЛКА ВИБОРУ КНИГ
// =============================================================

function createSelectorModal() {
  if (document.getElementById('book-selector-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'book-selector-modal';
  modal.className = 'modal-overlay book-selector-modal';
  modal.innerHTML = `
    <div class="modal-card book-selector">
      <button class="modal-card__close" id="book-selector-close">&times;</button>
      
      <div class="book-selector__header">
        <h3>Зберегти в книгу</h3>
        <p>Оберіть одну або кілька книг</p>
      </div>
      
      <div class="book-selector__list" id="book-selector-list">
        <!-- Книги будуть тут -->
      </div>
      
      <div class="book-selector__actions">
        <button type="button" class="btn-secondary" id="book-selector-all">
          Усі книги...
        </button>
        <button type="button" class="btn-save" id="book-selector-save">
          Зберегти
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  selectorModal = modal;

  // Закриття
  modal.querySelector('#book-selector-close').addEventListener('click', closeBookSelector);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeBookSelector();
  });

  // Зберегти
  modal.querySelector('#book-selector-save').addEventListener('click', handleSaveSelection);

  // Усі книги
  modal.querySelector('#book-selector-all').addEventListener('click', showAllBooks);
}

function renderBooksList(showAll = false, preCheckedIds = null) {
  const list = document.getElementById('book-selector-list');
  if (!list) return;

  const checkedIds = preCheckedIds !== null ? preCheckedIds : previouslySavedBookIds;
  const booksToShow = showAll ? cachedBooks : cachedBooks.slice(0, 4);

  list.innerHTML = booksToShow
    .map(
      (book) => `
    <label class="book-selector__item ${book.is_default ? 'book-selector__item--default' : ''}">
      <input type="checkbox" value="${book.id}" ${checkedIds.includes(book.id) ? 'checked' : ''}>
      <span class="book-selector__icon">${BOOK_ICONS[book.icon] || book.icon || BOOK_ICONS['book']}</span>
      <span class="book-selector__name">${escapeHTML(book.name)}</span>
      ${book.is_default ? '<span class="book-selector__badge">Головна</span>' : ''}
    </label>
  `,
    )
    .join('');

  const allBtn = document.getElementById('book-selector-all');
  if (allBtn) {
    allBtn.style.display = cachedBooks.length > 4 && !showAll ? 'block' : 'none';
  }
}

function showAllBooks() {
  renderBooksList(true);
}

export async function openBookSelector(recipeId, onSelect = null) {
  if (!selectorModal) createSelectorModal();

  selectorModal.dataset.recipeId = recipeId;
  onSelectCallback = onSelect;

  // Завантажуємо в яких книгах вже збережено
  previouslySavedBookIds = await getRecipeBooks(recipeId);

  const isEditing = previouslySavedBookIds.length > 0;
  const header = selectorModal.querySelector('.book-selector__header');
  if (header) {
    header.querySelector('h3').textContent = isEditing ? 'Керувати книгами' : 'Зберегти в книгу';
    header.querySelector('p').textContent = isEditing
      ? 'Зніміть галочку, щоб видалити з книги'
      : 'Оберіть одну або кілька книг';
  }

  renderBooksList(false);

  selectorModal.classList.add('is-active');
  lockScroll('book-selector-modal');
}

function closeBookSelector() {
  if (selectorModal) {
    selectorModal.classList.remove('is-active');
    unlockScroll('book-selector-modal');
    onSelectCallback = null;
  }
}

async function handleSaveSelection() {
  const recipeId = parseInt(selectorModal.dataset.recipeId);
  const allCheckboxes = selectorModal.querySelectorAll('input[type="checkbox"]');
  const newBookIds = Array.from(allCheckboxes)
    .filter((cb) => cb.checked)
    .map((cb) => parseInt(cb.value));

  const toAdd = newBookIds.filter((id) => !previouslySavedBookIds.includes(id));
  const toRemove = previouslySavedBookIds.filter((id) => !newBookIds.includes(id));

  await Promise.all([
    ...toAdd.map((id) => {
      const book = cachedBooks.find((b) => b.id === id);
      return saveRecipeToBook(recipeId, id, book?.name);
    }),
    ...toRemove.map((id) => removeRecipeFromBook(recipeId, id)),
  ]);

  if (newBookIds.length === 0 && previouslySavedBookIds.length > 0) {
    showToast('Видалено зі збережених');
  }

  closeBookSelector();

  if (onSelectCallback) {
    onSelectCallback(newBookIds);
  }
}

// =============================================================
// ІНЛАЙН СЕЛЕКТОР (ДЛЯ ФОРМИ СТВОРЕННЯ)
// =============================================================

export function createInlineBookSelector(containerId, preselectedBookIds = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const defaultBook = getDefaultBook();
  const defaultSelected =
    preselectedBookIds.length > 0 ? preselectedBookIds : defaultBook ? [defaultBook.id] : [];

  const booksToShow = cachedBooks.slice(0, 3);
  const hasMore = cachedBooks.length > 3;

  container.innerHTML = `
    <div class="inline-book-selector">
      <div class="inline-book-selector__list">
        ${booksToShow
          .map(
            (book) => `
          <label class="inline-book-selector__item">
            <input type="checkbox" name="recipe_books" value="${book.id}" 
              ${defaultSelected.includes(book.id) ? 'checked' : ''}>
            <span class="inline-book-selector__icon">${BOOK_ICONS[book.icon] || book.icon || BOOK_ICONS['book']}</span>
            <span class="inline-book-selector__name">${escapeHTML(book.name)}</span>
          </label>
        `,
          )
          .join('')}
      </div>
      ${
        hasMore
          ? `
        <button type="button" class="inline-book-selector__more" id="${containerId}-more">
          Вибрати ще...
        </button>
      `
          : ''
      }
    </div>
  `;

  // Вибрати ще
  const moreBtn = document.getElementById(`${containerId}-more`);
  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      showFullBookSelector(containerId, defaultSelected);
    });
  }
}

function showFullBookSelector(containerId, currentSelection) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="inline-book-selector inline-book-selector--expanded">
      <div class="inline-book-selector__list">
        ${cachedBooks
          .map(
            (book) => `
          <label class="inline-book-selector__item">
            <input type="checkbox" name="recipe_books" value="${book.id}"
              ${currentSelection.includes(book.id) ? 'checked' : ''}>
            <span class="inline-book-selector__icon">${BOOK_ICONS[book.icon] || book.icon || BOOK_ICONS['book']}</span>
            <span class="inline-book-selector__name">${escapeHTML(book.name)}</span>
            ${book.is_default ? '<span class="inline-book-selector__badge">·</span>' : ''}
          </label>
        `,
          )
          .join('')}
      </div>
      <button type="button" class="inline-book-selector__collapse" id="${containerId}-collapse">
        Згорнути
      </button>
    </div>
  `;

  document.getElementById(`${containerId}-collapse`)?.addEventListener('click', () => {
    const selected = getSelectedBooksFromContainer(containerId);
    createInlineBookSelector(containerId, selected);
  });
}

export function getSelectedBooksFromContainer(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];

  const checkboxes = container.querySelectorAll('input[name="recipe_books"]:checked');
  return Array.from(checkboxes).map((cb) => parseInt(cb.value));
}

// =============================================================
// СКАРГИ НА РЕЦЕПТИ
// =============================================================

export async function reportRecipe(recipeId, reason) {
  if (!currentUserId) {
    showToast('Увійдіть, щоб залишити скаргу', 'error');
    return false;
  }

  const { error } = await supabase.from('recipe_reports').insert([
    {
      recipe_id: recipeId,
      reporter_id: currentUserId,
      reason: reason,
    },
  ]);

  if (error) {
    if (error.code === '23505') {
      showToast('Ви вже скаржились на цей рецепт', 'info');
    } else {
      console.error('Error reporting recipe:', error);
      showToast('Помилка надсилання скарги', 'error');
    }
    return false;
  }

  showToast('Скаргу надіслано. Дякуємо!');
  return true;
}

// Модалка скарги
export function openReportModal(recipeId, recipeName = '') {
  let modal = document.getElementById('report-recipe-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'report-recipe-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card report-modal">
        <button class="modal-card__close" id="report-modal-close">&times;</button>
        
        <div class="report-modal__header">
          <h3>${iconFlag} Поскаржитись на рецепт</h3>
          <p class="report-modal__recipe-name"></p>
        </div>
        
        <form id="report-form">
          <div class="form-group">
            <label>Причина скарги</label>
            <select id="report-reason-select" class="form-select" required>
              <option value="">Оберіть причину...</option>
              <option value="inappropriate">Неприйнятний вміст</option>
              <option value="nsfw">NSFW</option>
              <option value="copyright">Порушення авторських прав</option>
              <option value="spam">Спам або реклама</option>
              <option value="hate_speech">Мова ненависті</option>
              <option value="scam">Шахрайство</option>
              <option value="misinformation">Небезпечна дезінформація</option>
              <option value="suspicious_links">Підозрілі посилання</option>
              <option value="bot_activity">Активність бота</option>
              <option value="incorrect">Некоректна інформація</option>
              <option value="other">Інше</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Додатковий коментар (необов'язково)</label>
            <textarea id="report-comment" rows="3" placeholder="Опишіть проблему детальніше..."></textarea>
          </div>
          
          <div class="report-modal__actions">
            <button type="button" class="btn-secondary" id="report-cancel">Скасувати</button>
            <button type="submit" class="btn-danger">Надіслати скаргу</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    // Закриття
    modal.querySelector('#report-modal-close').addEventListener('click', () => closeReportModal());
    modal.querySelector('#report-cancel').addEventListener('click', () => closeReportModal());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeReportModal();
    });
  }

  modal.dataset.recipeId = recipeId;
  modal.querySelector('.report-modal__recipe-name').textContent = recipeName;
  modal.querySelector('#report-reason-select').value = '';
  modal.querySelector('#report-comment').value = '';

  // Обробник форми
  const form = modal.querySelector('#report-form');
  form.onsubmit = async (e) => {
    e.preventDefault();

    const reasonSelect = modal.querySelector('#report-reason-select').value;
    const comment = modal.querySelector('#report-comment').value.trim();
    const fullReason = comment ? `${reasonSelect}: ${comment}` : reasonSelect;

    const success = await reportRecipe(parseInt(modal.dataset.recipeId), fullReason);
    if (success) {
      closeReportModal();
    }
  };

  modal.classList.add('is-active');
  lockScroll('report-modal');
}

function closeReportModal() {
  const modal = document.getElementById('report-recipe-modal');
  if (modal) {
    modal.classList.remove('is-active');
    unlockScroll('report-modal');
  }
}
