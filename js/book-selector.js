// =============================================================
// book-selector.js — модуль вибору книг для збереження рецептів
// =============================================================

import { supabase } from './supabaseClient.js';
import { showToast, escapeHTML } from './utils.js';
import { t, formatText } from './i18n-apply.js';
import { lockScroll, unlockScroll } from './scroll-lock.js';
import { BOOK_ICONS, iconFlag } from './icons.js';
import { initCustomSelect, initSelectsGlobalListener } from './ui-components.js';

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
    showToast(t('loginToSaveRecipes'), 'error');
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
          name: t('myRecipesBook'),
          icon: 'book',
          is_default: true,
        },
      ])
      .select()
      .maybeSingle();

    if (error) {
      showToast(t('createBookError'), 'error');
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
    showToast(formatText('alreadyInBook', { book: bookName || t('bookFallbackLocative') }), 'info');
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
    showToast(t('saveError'), 'error');
    return false;
  }

  showToast(formatText('savedToBook', { book: bookName || t('bookFallbackAccusative') }));
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
    showToast(t('deleteError'), 'error');
    return false;
  }

  showToast(t('removedFromBook'));
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
  modal.className = 'book-selector-overlay';
  modal.innerHTML = `
    <div class="book-selector">
      <button class="book-selector__close" id="book-selector-close">&times;</button>
      
      <div class="book-selector__header">
        <h3>${t('saveToBookTitle')}</h3>
        <p>${t('chooseBooksHint')}</p>
      </div>

      <div class="book-selector__list" id="book-selector-list">
        <!-- Книги будуть тут -->
      </div>

      <div class="book-selector__actions">
        <button type="button" class="btn-secondary" id="book-selector-all">
          ${t('allBooksAction')}
        </button>
        <button type="button" class="btn-save" id="book-selector-save">
          ${t('save')}
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
      ${book.is_default ? `<span class="book-selector__badge">${t('mainBook')}</span>` : ''}
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
    header.querySelector('h3').textContent = isEditing ? t('manageBooksTitle') : t('saveToBookTitle');
    header.querySelector('p').textContent = isEditing
      ? t('uncheckToRemoveHint')
      : t('chooseBooksHint');
  }

  renderBooksList(false);

  selectorModal.classList.add('is-open');
  lockScroll('book-selector-modal');
}

function closeBookSelector() {
  if (selectorModal) {
    selectorModal.classList.remove('is-open');
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
    showToast(t('removedFromSaved'));
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
          ${t('selectMore')}
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
        ${t('collapse')}
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
    showToast(t('loginToReport'), 'error');
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
      showToast(t('alreadyReported'), 'info');
    } else {
      console.error('Error reporting recipe:', error);
      showToast(t('reportSendError'), 'error');
    }
    return false;
  }

  showToast(t('reportSent'));
  return true;
}

// Скидає кастомний селект причини у початковий стан (плейсхолдер).
function resetReportReasonSelect(modal) {
  const input = modal.querySelector('#report-reason-input');
  if (input) input.value = '';
  const triggerText = modal.querySelector('#report-reason-select .custom-select__trigger span');
  if (triggerText) triggerText.textContent = t('reportReasonPlaceholder');
  modal
    .querySelectorAll('#report-reason-select .custom-select__option')
    .forEach((o) => o.classList.remove('selected'));
}

// Модалка скарги
export function openReportModal(recipeId, recipeName = '') {
  let modal = document.getElementById('report-recipe-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'report-recipe-modal';
    modal.className = 'report-overlay';
    modal.innerHTML = `
      <div class="report-modal">
        <button class="report-modal__close" id="report-modal-close">&times;</button>
        
        <div class="report-modal__header">
          <h3>${iconFlag} ${t('reportRecipeTitle')}</h3>
          <p class="report-modal__recipe-name"></p>
        </div>

        <form id="report-form">
          <div class="form-group">
            <label>${t('reportReasonLabel')}</label>
            <div class="custom-select" id="report-reason-select">
              <div class="custom-select__trigger">
                <span>${t('reportReasonPlaceholder')}</span>
                <div class="arrow"></div>
              </div>
              <div class="custom-select__options">
                <span class="custom-select__option" data-value="inappropriate">${t('reportReasonInappropriate')}</span>
                <span class="custom-select__option" data-value="nsfw">${t('reportReasonNsfw')}</span>
                <span class="custom-select__option" data-value="copyright">${t('reportReasonCopyright')}</span>
                <span class="custom-select__option" data-value="spam">${t('reportReasonSpam')}</span>
                <span class="custom-select__option" data-value="hate_speech">${t('reportReasonHateSpeech')}</span>
                <span class="custom-select__option" data-value="scam">${t('reportReasonScam')}</span>
                <span class="custom-select__option" data-value="misinformation">${t('reportReasonMisinformation')}</span>
                <span class="custom-select__option" data-value="suspicious_links">${t('reportReasonSuspiciousLinks')}</span>
                <span class="custom-select__option" data-value="bot_activity">${t('reportReasonBotActivity')}</span>
                <span class="custom-select__option" data-value="incorrect">${t('reportReasonIncorrect')}</span>
                <span class="custom-select__option" data-value="other">${t('reportReasonOther')}</span>
              </div>
            </div>
            <input type="hidden" id="report-reason-input" required />
          </div>

          <div class="form-group">
            <label>${t('reportCommentLabel')}</label>
            <textarea id="report-comment" rows="3" placeholder="${t('reportCommentPlaceholder')}"></textarea>
          </div>

          <div class="report-modal__actions">
            <button type="button" class="btn-secondary" id="report-cancel">${t('cancel')}</button>
            <button type="submit" class="btn-confirm">${t('reportSubmit')}</button>
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

    // Кастомний селект причини (єдиний раз при створенні модалки)
    initCustomSelect('report-reason-select', 'report-reason-input');
    initSelectsGlobalListener();
  }

  modal.dataset.recipeId = recipeId;
  modal.querySelector('.report-modal__recipe-name').textContent = recipeName;
  resetReportReasonSelect(modal);
  modal.querySelector('#report-comment').value = '';

  // Обробник форми
  const form = modal.querySelector('#report-form');
  form.onsubmit = async (e) => {
    e.preventDefault();

    const reasonSelect = modal.querySelector('#report-reason-input').value;
    if (!reasonSelect) {
      showToast(t('reportChooseReason'), 'error');
      return;
    }
    const comment = modal.querySelector('#report-comment').value.trim();
    const fullReason = comment ? `${reasonSelect}: ${comment}` : reasonSelect;

    const success = await reportRecipe(parseInt(modal.dataset.recipeId), fullReason);
    if (success) {
      closeReportModal();
    }
  };

  modal.classList.add('is-open');
  lockScroll('report-modal');
}

function closeReportModal() {
  const modal = document.getElementById('report-recipe-modal');
  if (modal) {
    modal.classList.remove('is-open');
    unlockScroll('report-modal');
  }
}
