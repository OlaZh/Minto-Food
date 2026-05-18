// js/cookbook.js
// Логіка сторінки "Книга рецептів"
import { initAuth, openAuthModal } from './auth.js';
import { supabase } from './supabaseClient.js';
import { showToast, escapeHTML } from './utils.js';
import { showConfirmModal } from './ui-components.js';
import { lockScroll, unlockScroll } from './scroll-lock.js';

// =====================================
// ІКОНКИ КНИГ (SVG)
// =====================================

const BOOK_ICONS = {
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  utensils: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`,
  leaf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  coffee: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  cake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2 1 2 1"/><path d="M2 21h20"/><path d="M7 8v2"/><path d="M12 8v2"/><path d="M17 8v2"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>`,
  pizza: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16"/><path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4"/></svg>`,
  soup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9z"/><path d="M7 21h10"/><path d="M19.5 12 22 6"/><path d="M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62"/><path d="M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62"/><path d="M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62"/></svg>`,
  apple: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4 4 0 0 0 18 6h-2a2 2 0 0 0-2-2 2 2 0 0 0-2 2H8A4 4 0 0 0 6 9.78C6 14 9 22 12 22z"/><path d="M10 2c0 1.5.5 2 2 2"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
};

function getBookIcon(key) {
  return BOOK_ICONS[key] ?? `<span style="font-size:2em;line-height:1">${key}</span>`;
}

const LIGHT_COVERS = 16;
const DARK_COVERS = 14;

function getCoverSrc(filename) {
  return `img/covers/${filename}.avif`;
}

function renderIconPickerHTML(activeIcon = 'book') {
  return Object.entries(BOOK_ICONS)
    .map(
      ([key, svg]) =>
        `<button type="button" class="cookbook-form__icon${key === activeIcon ? ' cookbook-form__icon--active' : ''}" data-icon="${key}" aria-label="${key}">${svg}</button>`,
    )
    .join('');
}

function renderCoverGridHTML(activeCover) {
  const checkSvg = `<span class="cookbook-cover-option__check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg></span>`;
  const opt = (filename, label) =>
    `<button type="button" class="cookbook-cover-option ${activeCover === filename ? 'cookbook-cover-option--active' : ''}" data-cover="${filename}"><img src="img/covers/${filename}.avif" alt="${label}" loading="lazy">${checkSvg}</button>`;
  let html = `<button type="button" class="cookbook-cover-option cookbook-cover-option--none ${!activeCover ? 'cookbook-cover-option--active' : ''}" data-cover=""><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="26" height="26"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>Без фото</span>${checkSvg}</button><div class="cookbook-cover-grid__label">Світла серія</div>`;
  for (let i = 1; i <= LIGHT_COVERS; i++) html += opt(`Light theme ${i}`, `Світла ${i}`);
  html += `<div class="cookbook-cover-grid__label">Темна серія</div>`;
  for (let i = 1; i <= DARK_COVERS; i++) html += opt(`Dark theme ${i}`, `Темна ${i}`);
  return html;
}

// =====================================
// СТАН
// =====================================

let currentUser = null;
let currentBookId = null;
let selectedIcon = 'book';
let editSelectedCover = null;

// =====================================
// DOM ЕЛЕМЕНТИ
// =====================================

const booksGrid = document.getElementById('booksGrid');
const addBookBtn = document.getElementById('addBookBtn');

// Модалка книги
const bookModal = document.getElementById('bookModal');
const closeBookModal = document.getElementById('closeBookModal');
const bookModalTitle = document.getElementById('bookModalTitle');
const bookRecipes = document.getElementById('bookRecipes');

// Модалка нової книги
const newBookModal = document.getElementById('newBookModal');
const closeNewBookModal = document.getElementById('closeNewBookModal');
const newBookForm = document.getElementById('newBookForm');
const newBookName = document.getElementById('newBookName');
const iconPicker = document.getElementById('iconPicker');

// =====================================
// ІНІЦІАЛІЗАЦІЯ
// =====================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const user = await initAuth((event, u) => {
    if (event === 'SIGNED_IN' && u) {
      currentUser = u;
      loadBooks();
    }
    if (event === 'SIGNED_OUT') {
      currentUser = null;
    }
  });

  if (!user) {
    openAuthModal('login');
    return;
  }

  currentUser = user;

  createEditBookModal();
  createCoverPickerModal();

  await loadBooks();
  loadRecentRecipes();
  setupEventListeners();
  initIconPicker();
}

function initIconPicker() {
  const picker = document.getElementById('iconPicker');
  if (picker) picker.innerHTML = renderIconPickerHTML('book');
}

function setupEventListeners() {
  // Додати книгу — делегація, бо кнопка в empty state додається динамічно
  document.addEventListener('click', (e) => {
    if (e.target.closest('.js-add-book-btn')) openModal(newBookModal);
  });

  // Закрити модалки
  closeBookModal?.addEventListener('click', () => closeModal(bookModal));
  closeNewBookModal?.addEventListener('click', () => closeModal(newBookModal));

  // Закрити по кліку на overlay
  bookModal?.addEventListener('click', (e) => {
    if (e.target === bookModal) closeModal(bookModal);
  });
  newBookModal?.addEventListener('click', (e) => {
    if (e.target === newBookModal) closeModal(newBookModal);
  });

  // Вибір іконки
  iconPicker?.addEventListener('click', (e) => {
    const iconBtn = e.target.closest('.cookbook-form__icon');
    if (!iconBtn) return;

    document.querySelectorAll('.cookbook-form__icon').forEach((btn) => {
      btn.classList.remove('cookbook-form__icon--active');
    });
    iconBtn.classList.add('cookbook-form__icon--active');
    selectedIcon = iconBtn.dataset.icon;
  });

  // Форма нової книги
  newBookForm?.addEventListener('submit', handleCreateBook);
}

// =====================================
// МОДАЛКИ
// =====================================

function openModal(modal) {
  modal?.classList.add('is-active'); // ✅
  lockScroll(`cookbook:${modal?.id || 'modal'}`);
}
function closeModal(modal) {
  modal?.classList.remove('is-active'); // ✅
  unlockScroll(`cookbook:${modal?.id || 'modal'}`);
}

// =====================================
// КНИГИ
// =====================================

function showBookSkeletons(count = 4) {
  if (!booksGrid) return;
  const existing = booksGrid.querySelectorAll('.cookbook-book, .skeleton-book');
  existing.forEach((el) => el.remove());
  Array.from({ length: count }, () => {
    const el = document.createElement('div');
    el.className = 'skeleton-book';
    el.innerHTML = `
      <div class="skeleton-book__cover"></div>
      <div class="skeleton-book__title"></div>
      <div class="skeleton-book__sub"></div>
    `;
    booksGrid.appendChild(el);
  });
}

async function loadBooks() {
  showBookSkeletons();
  try {
    const { data: books, error } = await supabase
      .from('cookbooks')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    await renderBooks(books || []);
  } catch (err) {
    console.error('Error loading books:', err);
    const existing = booksGrid?.querySelectorAll('.skeleton-book');
    existing?.forEach((el) => el.remove());
  }
}

async function renderBooks(books) {
  const existingBooks = booksGrid.querySelectorAll('.cookbook-book, .skeleton-book, .cookbook-empty');
  existingBooks.forEach((el) => el.remove());

  if (books.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cookbook-empty';
    empty.innerHTML = `
      <p class="cookbook-empty__text">У вас поки немає жодної книги</p>
      <button class="cookbook-empty__cta js-add-book-btn">Створити першу книгу</button>
    `;
    booksGrid.appendChild(empty);
    return;
  }

  for (const book of books) {
    const bookEl = await createBookElement(book);
    booksGrid.appendChild(bookEl);
  }
}

// Замінити функцію createBookElement в cookbook.js

async function createBookElement(book) {
  const { count } = await supabase
    .from('cookbook_recipes')
    .select('*', { count: 'exact', head: true })
    .eq('cookbook_id', book.id);

  const recipeCount = count || 0;
  const isDefault = book.is_default;

  // Правильне відмінювання
  function recipesLabel(n) {
    if (n % 10 === 1 && n % 100 !== 11) return `${n} рецепт`;
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return `${n} рецепти`;
    return `${n} рецептів`;
  }

  const article = document.createElement('article');
  article.className = `cookbook-book${isDefault ? ' cookbook-book--main' : ''}`;
  article.dataset.bookId = book.id;
  article.dataset.bookIcon = book.icon || 'book';

  const coverHTML = book.cover_image
    ? `<img class="cookbook-book__cover-img" src="${getCoverSrc(book.cover_image)}" alt="" loading="lazy">`
    : `<div class="cookbook-book__cover-icon">${getBookIcon(book.icon || 'book')}</div>`;

  article.innerHTML = `
    <div class="cookbook-book__cover-area">
      ${coverHTML}

      <div class="cookbook-book__cover-controls">
        <button class="cookbook-book__action-btn cookbook-book__edit-btn" aria-label="Редагувати книгу" title="Редагувати">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>
        ${
          !isDefault
            ? `
        <button class="cookbook-book__action-btn cookbook-book__delete-btn cookbook-book__action-btn--danger" aria-label="Видалити книгу" title="Видалити">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        `
            : ''
        }
      </div>

    </div>

    <div class="cookbook-book__body">
      <h3 class="cookbook-book__name">
        <span>${escapeHTML(book.name)}</span>
        ${isDefault ? '<span class="cookbook-book__default-badge">Головна</span>' : ''}
      </h3>
      <div class="cookbook-book__meta">
        <span class="cookbook-book__count">${recipesLabel(recipeCount)}</span>
        <div class="cookbook-book__arrow">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </div>
    </div>
  `;

  // Редагувати
  article.querySelector('.cookbook-book__edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditBookModal(book);
  });

  // Видалити (тільки для не-головних)
  const deleteBtn = article.querySelector('.cookbook-book__delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBook(book.id);
    });
  }

  // Клік по картці — відкрити книгу
  article.addEventListener('click', () => openBook(book));

  return article;
}

async function handleCreateBook(e) {
  e.preventDefault();

  const name = newBookName.value.trim();
  if (!name) return;

  try {
    const { data, error } = await supabase
      .from('cookbooks')
      .insert([
        {
          name,
          icon: selectedIcon,
          user_id: currentUser.id,
          is_default: false,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Додаємо в DOM
    const bookEl = await createBookElement(data);
    booksGrid.appendChild(bookEl);

    // Закриваємо і очищаємо
    closeModal(newBookModal);
    newBookForm.reset();
    selectedIcon = 'book';
    document.querySelectorAll('.cookbook-form__icon').forEach((btn, i) => {
      btn.classList.toggle('cookbook-form__icon--active', i === 0);
    });

    showToast('Книгу створено!');
  } catch (err) {
    console.error('Error creating book:', err);
    showToast('Помилка створення книги', 'error');
  }
}

async function deleteBook(bookId) {
  // Перевіряємо чи це не головна книга
  const { data: book } = await supabase
    .from('cookbooks')
    .select('is_default')
    .eq('id', bookId)
    .single();

  if (book?.is_default) {
    showToast('Головну книгу не можна видалити', 'error');
    return;
  }

  showConfirmModal({
    title: 'Видалити книгу?',
    message: 'Рецепти залишаться в загальному списку.',
    confirmText: 'Так, видалити',
    cancelText: 'Скасувати',
    onConfirm: async () => {
      try {
        const { error } = await supabase.from('cookbooks').delete().eq('id', bookId);
        if (error) throw error;

        const bookEl = booksGrid.querySelector(`[data-book-id="${bookId}"]`);
        bookEl?.remove();
        showToast('Книгу видалено');
      } catch (err) {
        console.error('Error deleting book:', err);
        showToast('Помилка видалення книги', 'error');
      }
    },
  });
}

// =====================================
// РЕДАГУВАННЯ КНИГИ
// =====================================

function createEditBookModal() {
  if (document.getElementById('editBookModal')) return;

  const modal = document.createElement('div');
  modal.id = 'editBookModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="cookbook-modal cookbook-modal--small">
      <button class="modal__close" id="closeEditBookModal" aria-label="Закрити">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <h2 class="cookbook-modal__title">Редагувати книгу</h2>

      <form class="cookbook-form" id="editBookForm">
        <div class="cookbook-form__field">
          <label for="editBookName">Назва книги</label>
          <input type="text" id="editBookName" required maxlength="50" />
        </div>

        <div class="cookbook-form__field">
          <label>Обкладинка</label>
          <div class="cookbook-cover-grid" id="editCoverGrid"></div>
        </div>

        <div class="cookbook-form__field" id="setDefaultGroup" hidden>
          <label class="cookbook-form__checkbox">
            <input type="checkbox" id="editBookDefault" />
            <span>Зробити головною книгою</span>
          </label>
        </div>

        <div class="cookbook-form__actions">
          <button type="button" class="cookbook-form__btn-cancel" id="cancelEditBook">Скасувати</button>
          <button type="submit" class="cookbook-form__submit">Зберегти</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Закриття
  document.getElementById('closeEditBookModal').addEventListener('click', () => closeModal(modal));
  document.getElementById('cancelEditBook').addEventListener('click', () => closeModal(modal));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });

  // Вибір обкладинки
  document.getElementById('editCoverGrid').addEventListener('click', (e) => {
    const coverBtn = e.target.closest('.cookbook-cover-option');
    if (!coverBtn) return;
    document
      .querySelectorAll('#editCoverGrid .cookbook-cover-option')
      .forEach((b) => b.classList.remove('cookbook-cover-option--active'));
    coverBtn.classList.add('cookbook-cover-option--active');
    editSelectedCover = coverBtn.dataset.cover || null;
  });

  // Збереження
  document.getElementById('editBookForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const bookId = modal.dataset.bookId;
    const name = document.getElementById('editBookName').value.trim();
    const makeDefault = document.getElementById('editBookDefault').checked;

    if (!name) return;

    try {
      // Якщо робимо головною — скидаємо is_default у інших
      if (makeDefault) {
        await supabase
          .from('cookbooks')
          .update({ is_default: false })
          .eq('user_id', currentUser.id);
      }

      const updateData = {
        name,
        icon: modal.dataset.bookIcon,
        cover_image: editSelectedCover || null,
      };

      if (makeDefault) {
        updateData.is_default = true;
      }

      const { error } = await supabase.from('cookbooks').update(updateData).eq('id', bookId);

      if (error) throw error;

      closeModal(modal);
      await loadBooks(); // Перезавантажуємо список
      showToast('Книгу оновлено!');
    } catch (err) {
      console.error('Error updating book:', err);
      showToast('Помилка оновлення', 'error');
    }
  });
}

function openEditBookModal(book) {
  const modal = document.getElementById('editBookModal');
  if (!modal) return;

  modal.dataset.bookId = book.id;
  modal.dataset.bookIcon = book.icon || 'book';

  // Заповнюємо поля
  document.getElementById('editBookName').value = book.name;

  // Обкладинка
  editSelectedCover = book.cover_image || null;
  document.getElementById('editCoverGrid').innerHTML = renderCoverGridHTML(book.cover_image);

  // Показуємо чекбокс "Зробити головною" тільки якщо це не головна книга
  const defaultGroup = document.getElementById('setDefaultGroup');
  const defaultCheckbox = document.getElementById('editBookDefault');
  defaultGroup.hidden = book.is_default;
  defaultCheckbox.checked = false;

  openModal(modal);
}

// =====================================
// ВІДКРИТА КНИГА
// =====================================

async function openBook(book) {
  currentBookId = book.id;
  bookModalTitle.textContent = book.name;

  await loadBookRecipes();

  openModal(bookModal);
}

async function loadBookRecipes() {
  try {
    const { data, error } = await supabase
      .from('cookbook_recipes')
      .select(
        `
        recipe_id,
        recipes (
          id,
          name_ua,
          image,
          kcal,
          notes
        )
      `,
      )
      .eq('cookbook_id', currentBookId);

    if (error) throw error;

    renderBookRecipes(data || []);
  } catch (err) {
    console.error('Error loading recipes:', err);
  }
}

function renderBookRecipes(recipes) {
  if (!recipes.length) {
    bookRecipes.innerHTML = `
      <div class="cookbook-recipes__empty">
        <p>Тут поки немає рецептів.<br>Додай їх зі сторінки "Рецепти"!</p>
      </div>
    `;
    return;
  }

  bookRecipes.innerHTML = recipes
    .map((item) => {
      const recipe = item.recipes;
      if (!recipe) return '';

      const kcalBadge = recipe.kcal
        ? `<span class="cookbook-recipe-card__kcal">${Math.round(recipe.kcal)} ккал</span>`
        : '';

      const imageHtml = recipe.image
        ? `<img src="${recipe.image}" alt="${escapeHTML(recipe.name_ua)}" loading="lazy">`
        : `<div class="cookbook-recipe-card__placeholder">🍽️</div>`;

      const stickyNote = recipe.notes?.trim()
        ? `<div class="recipe-sticky-note" role="note" aria-label="Моя нотатка">
            <div class="recipe-sticky-note__pin"></div>
            <div class="recipe-sticky-note__body">
              <p class="recipe-sticky-note__text">${escapeHTML(recipe.notes.trim())}</p>
            </div>
          </div>`
        : '';

      return `
        <article class="cookbook-recipe-card" data-recipe-id="${recipe.id}">
          ${stickyNote}
          <div class="cookbook-recipe-card__image">
            ${imageHtml}
            ${kcalBadge}
            <button class="cookbook-recipe-card__remove" data-recipe-id="${recipe.id}" aria-label="Видалити з книги" title="Видалити з книги">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="cookbook-recipe-card__body">
            <h3 class="cookbook-recipe-card__title">${escapeHTML(recipe.name_ua)}</h3>
          </div>
        </article>
      `;
    })
    .join('');

  bookRecipes.querySelectorAll('.recipe-sticky-note').forEach((note) => {
    note.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = note.classList.toggle('is-expanded');
      if (isExpanded) {
        document.querySelectorAll('.recipe-sticky-note.is-expanded').forEach((other) => {
          if (other !== note) other.classList.remove('is-expanded');
        });
      }
    });
  });

  bookRecipes.querySelectorAll('.cookbook-recipe-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.cookbook-recipe-card__remove')) return;
      if (e.target.closest('.recipe-sticky-note')) return;
      const id = card.dataset.recipeId;
      window.location.href = `recipes.html?recipe=${id}&from=cookbook`;
    });
  });

  bookRecipes.querySelectorAll('.cookbook-recipe-card__remove').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const recipeId = btn.dataset.recipeId;
      await removeRecipeFromBook(recipeId);
    });
  });
}

async function removeRecipeFromBook(recipeId) {
  if (!currentBookId) return;
  try {
    const { error } = await supabase
      .from('cookbook_recipes')
      .delete()
      .eq('cookbook_id', currentBookId)
      .eq('recipe_id', recipeId);

    if (error) throw error;

    showToast('Рецепт видалено з книги', 'success');
    await loadBookRecipes();
  } catch (err) {
    console.error('Error removing recipe:', err);
    showToast('Помилка видалення', 'error');
  }
}

// =====================================
// НЕЩОДАВНО ПЕРЕГЛЯНУТІ
// =====================================

async function loadRecentRecipes() {
  const container = document.getElementById('recentRecipes');
  if (!container) return;

  try {
    const { data: books } = await supabase
      .from('cookbooks')
      .select('id')
      .eq('user_id', currentUser.id);

    if (!books?.length) return;

    const bookIds = books.map((b) => b.id);

    const { data, error } = await supabase
      .from('cookbook_recipes')
      .select('created_at, recipes ( id, name_ua, image, kcal )')
      .in('cookbook_id', bookIds)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const seen = new Set();
    const unique = (data || [])
      .filter((item) => {
        if (!item.recipes || seen.has(item.recipes.id)) return false;
        seen.add(item.recipes.id);
        return true;
      })
      .slice(0, 8);

    if (!unique.length) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = unique
      .map((item) => {
        const r = item.recipes;
        const imgHtml = r.image
          ? `<img src="${escapeHTML(r.image)}" alt="${escapeHTML(r.name_ua)}" loading="lazy">`
          : `<div class="cookbook-recent-item__placeholder">🍽️</div>`;
        return `
        <a class="cookbook-recent-item" href="recipes.html?recipe=${r.id}&from=cookbook">
          <div class="cookbook-recent-item__img">${imgHtml}</div>
          <div class="cookbook-recent-item__info">
            <span class="cookbook-recent-item__name">${escapeHTML(r.name_ua)}</span>
            ${r.kcal ? `<span class="cookbook-recent-item__kcal">${Math.round(r.kcal)} ккал</span>` : ''}
          </div>
        </a>
      `;
      })
      .join('');
  } catch (err) {
    console.error('Error loading recent recipes:', err);
  }
}

// =====================================
// ПІКЕР ОБКЛАДИНОК
// =====================================

function createCoverPickerModal() {
  if (document.getElementById('coverPickerModal')) return;

  const modal = document.createElement('div');
  modal.id = 'coverPickerModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="cookbook-cover-picker-modal">
      <button class="modal__close" id="closeCoverPickerModal" aria-label="Закрити">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="cookbook-cover-picker-modal__header">
        <h3>Оберіть обкладинку</h3>
      </div>
      <div class="cookbook-cover-picker-modal__body">
        <div class="cookbook-cover-grid" id="coverPickerGrid"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document
    .getElementById('closeCoverPickerModal')
    .addEventListener('click', () => closeModal(modal));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
}

function openCoverPicker(book, cardEl) {
  const modal = document.getElementById('coverPickerModal');
  const grid = document.getElementById('coverPickerGrid');

  const checkSvg = `<span class="cookbook-cover-option__check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg></span>`;

  const optionBtn = (filename, label) => `
    <button type="button" class="cookbook-cover-option ${book.cover_image === filename ? 'cookbook-cover-option--active' : ''}" data-cover="${filename}">
      <img src="img/covers/${filename}.avif" alt="${label}" loading="lazy">
      ${checkSvg}
    </button>
  `;

  let html = `
    <button type="button" class="cookbook-cover-option cookbook-cover-option--none ${!book.cover_image ? 'cookbook-cover-option--active' : ''}" data-cover="">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="26" height="26"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      <span>Без фото</span>
      ${checkSvg}
    </button>
    <div class="cookbook-cover-grid__label">Світла серія</div>
  `;
  for (let i = 1; i <= LIGHT_COVERS; i++) html += optionBtn(`Light theme ${i}`, `Світла ${i}`);

  html += `<div class="cookbook-cover-grid__label">Темна серія</div>`;
  for (let i = 1; i <= DARK_COVERS; i++) html += optionBtn(`Dark theme ${i}`, `Темна ${i}`);

  grid.innerHTML = html;

  grid.querySelectorAll('.cookbook-cover-option').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const filename = btn.dataset.cover || null;
      await selectCover(book, filename, cardEl);
      grid
        .querySelectorAll('.cookbook-cover-option')
        .forEach((b) => b.classList.remove('cookbook-cover-option--active'));
      btn.classList.add('cookbook-cover-option--active');
      closeModal(modal);
    });
  });

  openModal(modal);
}

async function selectCover(book, filename, cardEl) {
  try {
    const { error } = await supabase
      .from('cookbooks')
      .update({ cover_image: filename })
      .eq('id', book.id);
    if (error) throw error;

    book.cover_image = filename;

    const coverArea = cardEl.querySelector('.cookbook-book__cover-area');
    let img = coverArea.querySelector('.cookbook-book__cover-img');
    let icon = coverArea.querySelector('.cookbook-book__cover-icon');

    if (filename) {
      if (icon) icon.remove();
      if (img) {
        img.src = getCoverSrc(filename);
      } else {
        img = document.createElement('img');
        img.className = 'cookbook-book__cover-img';
        img.src = getCoverSrc(filename);
        img.alt = '';
        img.loading = 'lazy';
        coverArea.insertBefore(img, coverArea.firstChild);
      }
    } else {
      if (img) img.remove();
      if (!icon) {
        icon = document.createElement('div');
        icon.className = 'cookbook-book__cover-icon';
        icon.innerHTML = getBookIcon(cardEl.dataset.bookIcon || 'book');
        coverArea.insertBefore(icon, coverArea.firstChild);
      }
    }

    showToast('Обкладинку оновлено!');
  } catch (err) {
    console.error(err);
    showToast('Помилка оновлення обкладинки', 'error');
  }
}
