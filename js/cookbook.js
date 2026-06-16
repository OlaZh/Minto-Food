// js/cookbook.js
// Логіка сторінки "Книга рецептів"
import { initAuth, openAuthModal } from './auth.js';
import { supabase } from './supabaseClient.js';
import { showToast, escapeHTML } from './utils.js';
import { BOOK_ICONS as _BOOK_ICONS, iconClose, iconCheck, iconEdit, iconChevronRight, iconPlate } from './icons.js';
import { showConfirmModal } from './ui-components.js';
import { lockScroll, unlockScroll } from './scroll-lock.js';

// =====================================
// ІКОНКИ КНИГ (з icons.js — єдине джерело)
// =====================================

const BOOK_ICONS = _BOOK_ICONS;

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
  const checkSvg = `<span class="cookbook-cover-option__check">${iconCheck.replace('<svg ', '<svg width="13" height="13" stroke-width="3" ')}</span>`;
  const opt = (filename, label) =>
    `<button type="button" class="cookbook-cover-option ${activeCover === filename ? 'cookbook-cover-option--active' : ''}" data-cover="${filename}"><img src="img/covers/${filename}.avif" alt="${label}" loading="lazy">${checkSvg}</button>`;
  let html = `<button type="button" class="cookbook-cover-option cookbook-cover-option--none ${!activeCover ? 'cookbook-cover-option--active' : ''}" data-cover="">${iconClose.replace('<svg ', '<svg width="26" height="26" ')}<span>Без фото</span>${checkSvg}</button><div class="cookbook-cover-grid__label">Світла серія</div>`;
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
let _setupDone = false;
let _loadVersion = 0;
let _initialLoadDone = false;

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
      _onUserReady();
    }
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      _initialLoadDone = false;
    }
  });

  if (!user) {
    openAuthModal('login');
    return;
  }

  currentUser = user;
  _onUserReady();
}

function _onUserReady() {
  createEditBookModal();

  if (!_initialLoadDone) {
    _initialLoadDone = true;
    loadBooks();
    loadRecentRecipes();
  }

  if (!_setupDone) {
    _setupDone = true;
    setupEventListeners();
    initIconPicker();
  }
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
  const version = ++_loadVersion;

  const skeletonTimer = setTimeout(() => {
    if (version === _loadVersion) showBookSkeletons();
  }, 200);

  try {
    const { data: books, error } = await supabase
      .from('cookbooks')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    clearTimeout(skeletonTimer);
    if (version !== _loadVersion) return;
    if (error) throw error;

    await renderBooks(books || [], version);
  } catch (err) {
    clearTimeout(skeletonTimer);
    if (version !== _loadVersion) return;
    console.error('Error loading books:', err);
    booksGrid?.querySelectorAll('.skeleton-book').forEach((el) => el.remove());
  }
}

async function renderBooks(books, version) {
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
    if (version !== _loadVersion) return;
    const bookEl = await createBookElement(book);
    if (version !== _loadVersion) return;
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
          ${iconEdit}
        </button>
        ${
          !isDefault
            ? `
        <button class="cookbook-book__action-btn cookbook-book__delete-btn cookbook-book__action-btn--danger" aria-label="Видалити книгу" title="Видалити">
          ${iconClose}
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
          ${iconChevronRight.replace('<svg ', '<svg width="14" height="14" ')}
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
        ${iconClose.replace('<svg ', '<svg width="24" height="24" ')}
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
        : `<div class="cookbook-recipe-card__placeholder">${iconPlate}</div>`;

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
              ${iconClose.replace('<svg ', '<svg width="16" height="16" ')}
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
      .select('recipe_id, recipes ( id, name_ua, image, kcal )')
      .in('cookbook_id', bookIds)
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
          : `<div class="cookbook-recent-item__placeholder">${iconPlate}</div>`;
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
