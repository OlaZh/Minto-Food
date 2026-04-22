// js/cookbook.js
// Логіка сторінки "Книга рецептів"
import { openRecipeView } from './add-recipe.js';
import { openAuthModal } from './auth.js';
import { supabase } from './supabaseClient.js';
import { showToast } from './utils.js';

// =====================================
// СТАН
// =====================================

let currentUser = null;
let currentBookId = null;
let currentNotebook = null;
let selectedIcon = '📖';

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
const bookNotebook = document.getElementById('bookNotebook');

// Вкладки
const tabs = document.querySelectorAll('.cookbook-modal__tab');
const tabContents = document.querySelectorAll('.cookbook-modal__content');

// Блокнот
const notebookEmpty = document.getElementById('notebookEmpty');
const notebookContent = document.getElementById('notebookContent');
const createNotebookBtn = document.getElementById('createNotebookBtn');
const addNoteBtn = document.getElementById('addNoteBtn');
const notesList = document.getElementById('notesList');

// Модалка нової книги
const newBookModal = document.getElementById('newBookModal');
const closeNewBookModal = document.getElementById('closeNewBookModal');
const newBookForm = document.getElementById('newBookForm');
const newBookName = document.getElementById('newBookName');
const iconPicker = document.getElementById('iconPicker');

// Модалка нової нотатки
const newNoteModal = document.getElementById('newNoteModal');
const closeNewNoteModal = document.getElementById('closeNewNoteModal');
const newNoteForm = document.getElementById('newNoteForm');
const noteTitle = document.getElementById('noteTitle');
const noteContent = document.getElementById('noteContent');

// =====================================
// ІНІЦІАЛІЗАЦІЯ
// =====================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Перевіряємо чи залогінений
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Відкриваємо модалку логіну (замість редіректу на неіснуючу сторінку)
    openAuthModal('login');

    // Слухаємо подію логіну — коли юзер увійде, ініціалізуємо сторінку наново
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        authListener.subscription.unsubscribe();
        init(); // повторно викликаємо init вже з юзером
      }
    });

    return;
  }

  currentUser = user;

  // Створюємо модалку редагування якщо її немає
  createEditBookModal();

  await loadBooks();
  setupEventListeners();
}

function setupEventListeners() {
  // Додати книгу
  addBookBtn?.addEventListener('click', () => openModal(newBookModal));

  // Закрити модалки
  closeBookModal?.addEventListener('click', () => closeModal(bookModal));
  closeNewBookModal?.addEventListener('click', () => closeModal(newBookModal));
  closeNewNoteModal?.addEventListener('click', () => closeModal(newNoteModal));

  // Закрити по кліку на overlay
  bookModal?.addEventListener('click', (e) => {
    if (e.target === bookModal) closeModal(bookModal);
  });
  newBookModal?.addEventListener('click', (e) => {
    if (e.target === newBookModal) closeModal(newBookModal);
  });
  newNoteModal?.addEventListener('click', (e) => {
    if (e.target === newNoteModal) closeModal(newNoteModal);
  });

  // Вкладки
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
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

  // Створити блокнот
  createNotebookBtn?.addEventListener('click', handleCreateNotebook);

  // Додати нотатку
  addNoteBtn?.addEventListener('click', () => openModal(newNoteModal));

  // Форма нової нотатки
  newNoteForm?.addEventListener('submit', handleCreateNote);
}

// =====================================
// МОДАЛКИ
// =====================================

function openModal(modal) {
  modal?.classList.add('is-active'); // ✅
  document.body.style.overflow = 'hidden';
}
function closeModal(modal) {
  modal?.classList.remove('is-active'); // ✅
  document.body.style.overflow = '';
}

function switchTab(tabName) {
  tabs.forEach((tab) => {
    tab.classList.toggle('cookbook-modal__tab--active', tab.dataset.tab === tabName);
  });

  tabContents.forEach((content) => {
    content.classList.toggle(
      'cookbook-modal__content--active',
      content.dataset.content === tabName,
    );
  });
}

// =====================================
// КНИГИ
// =====================================

async function loadBooks() {
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
  }
}

async function renderBooks(books) {
  // Видаляємо старі книги
  const existingBooks = booksGrid.querySelectorAll('.cookbook-book');
  existingBooks.forEach((el) => el.remove());

  // Додаємо книги
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

  article.innerHTML = `
    <div class="cookbook-book__cover-area">
      <span class="cookbook-book__cover-icon">${book.icon || '📖'}</span>

      <div class="cookbook-book__cover-controls">
        <button class="cookbook-book__action-btn cookbook-book__edit-btn" aria-label="Редагувати книгу" title="Редагувати">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        ${
          !isDefault
            ? `
        <button class="cookbook-book__action-btn cookbook-book__delete-btn cookbook-book__action-btn--danger" aria-label="Видалити книгу" title="Видалити">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        `
            : ''
        }
      </div>

      ${isDefault ? '<span class="cookbook-book__default-badge">Головна</span>' : ''}
    </div>

    <div class="cookbook-book__body">
      <h3 class="cookbook-book__name">${escapeHtml(book.name)}</h3>
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
    selectedIcon = '📖';
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

  if (!confirm('Видалити цю книгу? Рецепти залишаться в загальному списку.')) return;

  try {
    const { error } = await supabase.from('cookbooks').delete().eq('id', bookId);

    if (error) throw error;

    // Видаляємо з DOM
    const bookEl = booksGrid.querySelector(`[data-book-id="${bookId}"]`);
    bookEl?.remove();

    showToast('Книгу видалено');
  } catch (err) {
    console.error('Error deleting book:', err);
    showToast('Помилка видалення книги', 'error');
  }
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
    <div class="modal-card edit-book-modal">
      <button class="modal-card__close" id="closeEditBookModal">&times;</button>
      
      <div class="edit-book-modal__header">
        <h3>Редагувати книгу</h3>
      </div>
      
      <form id="editBookForm">
        <div class="form-group">
          <label>Назва книги</label>
          <input type="text" id="editBookName" required maxlength="50" />
        </div>
        
        <div class="form-group">
          <label>Іконка</label>
          <div class="cookbook-form__icons" id="editIconPicker">
            <button type="button" class="cookbook-form__icon" data-icon="📖">📖</button>
            <button type="button" class="cookbook-form__icon" data-icon="🍳">🍳</button>
            <button type="button" class="cookbook-form__icon" data-icon="🥗">🥗</button>
            <button type="button" class="cookbook-form__icon" data-icon="🍰">🍰</button>
            <button type="button" class="cookbook-form__icon" data-icon="🍕">🍕</button>
            <button type="button" class="cookbook-form__icon" data-icon="🥘">🥘</button>
            <button type="button" class="cookbook-form__icon" data-icon="🍜">🍜</button>
            <button type="button" class="cookbook-form__icon" data-icon="❤️">❤️</button>
            <button type="button" class="cookbook-form__icon" data-icon="⭐">⭐</button>
            <button type="button" class="cookbook-form__icon" data-icon="🎂">🎂</button>
          </div>
        </div>
        
        <div class="form-group" id="setDefaultGroup" style="display: none;">
          <label class="checkbox-label">
            <input type="checkbox" id="editBookDefault" />
            <span>Зробити головною книгою</span>
          </label>
        </div>
        
        <div class="edit-book-modal__actions">
          <button type="button" class="btn-secondary" id="cancelEditBook">Скасувати</button>
          <button type="submit" class="btn-save">Зберегти</button>
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

  // Вибір іконки
  let editSelectedIcon = '📖';
  document.getElementById('editIconPicker').addEventListener('click', (e) => {
    const iconBtn = e.target.closest('.cookbook-form__icon');
    if (!iconBtn) return;

    document.querySelectorAll('#editIconPicker .cookbook-form__icon').forEach((btn) => {
      btn.classList.remove('cookbook-form__icon--active');
    });
    iconBtn.classList.add('cookbook-form__icon--active');
    editSelectedIcon = iconBtn.dataset.icon;
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
        icon: editSelectedIcon,
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

  // Заповнюємо поля
  document.getElementById('editBookName').value = book.name;

  // Вибираємо іконку
  const icons = document.querySelectorAll('#editIconPicker .cookbook-form__icon');
  icons.forEach((btn) => {
    btn.classList.toggle('cookbook-form__icon--active', btn.dataset.icon === book.icon);
  });

  // Показуємо чекбокс "Зробити головною" тільки якщо це не головна книга
  const defaultGroup = document.getElementById('setDefaultGroup');
  const defaultCheckbox = document.getElementById('editBookDefault');
  if (book.is_default) {
    defaultGroup.style.display = 'none';
    defaultCheckbox.checked = false;
  } else {
    defaultGroup.style.display = 'block';
    defaultCheckbox.checked = false;
  }

  openModal(modal);
}

// =====================================
// ВІДКРИТА КНИГА
// =====================================

async function openBook(book) {
  currentBookId = book.id;
  bookModalTitle.textContent = book.name;

  // Скидаємо на вкладку рецептів
  switchTab('recipes');

  // Завантажуємо дані
  await Promise.all([loadBookRecipes(), loadNotebook()]);

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
          kcal
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
        ? `<img src="${recipe.image}" alt="${escapeHtml(recipe.name_ua)}" loading="lazy">`
        : `<div class="cookbook-recipe-card__placeholder">🍽️</div>`;

      return `
        <article class="cookbook-recipe-card" data-recipe-id="${recipe.id}">
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
            <h3 class="cookbook-recipe-card__title">${escapeHtml(recipe.name_ua)}</h3>
          </div>
        </article>
      `;
    })
    .join('');

  bookRecipes.querySelectorAll('.cookbook-recipe-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.cookbook-recipe-card__remove')) return;
      const id = card.dataset.recipeId;
      openRecipeView(id);
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
// БЛОКНОТ
// =====================================

async function loadNotebook() {
  try {
    const { data, error } = await supabase
      .from('cookbook_notebooks')
      .select('*')
      .eq('cookbook_id', currentBookId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

    currentNotebook = data;

    if (data) {
      notebookEmpty.style.display = 'none';
      notebookContent.style.display = 'block';
      await loadNotes();
    } else {
      notebookEmpty.style.display = 'flex';
      notebookContent.style.display = 'none';
    }
  } catch (err) {
    console.error('Error loading notebook:', err);
  }
}

async function handleCreateNotebook() {
  try {
    const { data, error } = await supabase
      .from('cookbook_notebooks')
      .insert([{ cookbook_id: currentBookId }])
      .select()
      .single();

    if (error) throw error;

    currentNotebook = data;
    notebookEmpty.style.display = 'none';
    notebookContent.style.display = 'block';
    notesList.innerHTML = '<p class="cookbook-notebook__empty-notes">Поки немає нотаток</p>';
  } catch (err) {
    console.error('Error creating notebook:', err);
    showToast('Помилка створення блокнота', 'error');
  }
}

async function loadNotes() {
  if (!currentNotebook) return;

  try {
    const { data, error } = await supabase
      .from('cookbook_notes')
      .select('*')
      .eq('notebook_id', currentNotebook.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    renderNotes(data || []);
  } catch (err) {
    console.error('Error loading notes:', err);
  }
}

function renderNotes(notes) {
  if (!notes.length) {
    notesList.innerHTML = '<p class="cookbook-notebook__empty-notes">Поки немає нотаток</p>';
    return;
  }

  notesList.innerHTML = notes
    .map(
      (note) => `
    <article class="cookbook-note" data-note-id="${note.id}">
      <div class="cookbook-note__header">
        <h4 class="cookbook-note__title">${escapeHtml(note.title)}</h4>
        <span class="cookbook-note__date">${formatDate(note.created_at)}</span>
      </div>
      <div class="cookbook-note__content">${escapeHtml(note.content || '').replace(/\n/g, '<br>')}</div>
      <div class="cookbook-note__actions">
        <button class="cookbook-note__edit" data-note-id="${note.id}" aria-label="Редагувати">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="cookbook-note__delete" data-note-id="${note.id}" aria-label="Видалити">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </article>
  `,
    )
    .join('');

  // Редагування — використовуємо делегування подій
  notesList.onclick = async (e) => {
    const editBtn = e.target.closest('.cookbook-note__edit');
    const deleteBtn = e.target.closest('.cookbook-note__delete');

    if (editBtn) {
      const noteId = editBtn.dataset.noteId;
      const note = notes.find((n) => n.id == noteId);
      if (note) editNote(note);
    }

    if (deleteBtn) {
      const noteId = deleteBtn.dataset.noteId;
      await deleteNote(noteId);
    }
  };
}

async function handleCreateNote(e) {
  e.preventDefault();

  const title = noteTitle.value.trim();
  const content = noteContent.value.trim();

  if (!title) return;

  try {
    const { error } = await supabase.from('cookbook_notes').insert([
      {
        notebook_id: currentNotebook.id,
        title,
        content,
      },
    ]);

    if (error) throw error;

    closeModal(newNoteModal);
    newNoteForm.reset();
    await loadNotes();
    showToast('Нотатку створено!');
  } catch (err) {
    console.error('Error creating note:', err);
    showToast('Помилка створення нотатки', 'error');
  }
}

function editNote(note) {
  noteTitle.value = note.title;
  noteContent.value = note.content || '';

  // Змінюємо форму на редагування
  const submitBtn = newNoteForm.querySelector('.cookbook-form__submit');
  if (submitBtn) submitBtn.textContent = 'Зберегти зміни';

  // Зберігаємо ID для оновлення
  newNoteForm.dataset.editId = note.id;

  openModal(newNoteModal);

  // Змінюємо обробник
  newNoteForm.onsubmit = async (e) => {
    e.preventDefault();
    await updateNote(note.id);
  };
}

async function updateNote(noteId) {
  const title = noteTitle.value.trim();
  const content = noteContent.value.trim();

  if (!title) return;

  try {
    const { error } = await supabase
      .from('cookbook_notes')
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq('id', noteId);

    if (error) throw error;

    closeModal(newNoteModal);
    newNoteForm.reset();
    delete newNoteForm.dataset.editId;

    // Повертаємо обробник на створення
    const submitBtn = newNoteForm.querySelector('.cookbook-form__submit');
    if (submitBtn) submitBtn.textContent = 'Зберегти';
    newNoteForm.onsubmit = handleCreateNote;

    await loadNotes();
    showToast('Нотатку оновлено!');
  } catch (err) {
    console.error('Error updating note:', err);
    showToast('Помилка оновлення нотатки', 'error');
  }
}

async function deleteNote(noteId) {
  if (!confirm('Видалити цю нотатку?')) return;

  try {
    const { error } = await supabase.from('cookbook_notes').delete().eq('id', noteId);

    if (error) throw error;

    await loadNotes();
    showToast('Нотатку видалено');
  } catch (err) {
    console.error('Error deleting note:', err);
    showToast('Помилка видалення нотатки', 'error');
  }
}

// =====================================
// УТИЛІТИ
// =====================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
