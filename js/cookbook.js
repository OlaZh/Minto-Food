// js/cookbook.js
// Логіка сторінки "Книга рецептів"

import { supabase } from './supabaseClient.js';

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
    window.location.href = 'login.html';
    return;
  }

  currentUser = user;

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
  modal?.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal?.classList.remove('is-open');
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

async function createBookElement(book) {
  // Підраховуємо кількість рецептів в книзі
  const { count } = await supabase
    .from('cookbook_recipes')
    .select('*', { count: 'exact', head: true })
    .eq('cookbook_id', book.id);

  const recipeCount = count || 0;

  const article = document.createElement('article');
  article.className = 'cookbook-book';
  article.dataset.bookId = book.id;

  article.innerHTML = `
    <div class="cookbook-book__cover">
      <span class="cookbook-book__icon">${book.icon || '📖'}</span>
    </div>
    <div class="cookbook-book__info">
      <h3 class="cookbook-book__name">${escapeHtml(book.name)}</h3>
      <p class="cookbook-book__count">${recipeCount} рецептів</p>
    </div>
    <div class="cookbook-book__actions">
      <button class="cookbook-book__open-btn" aria-label="Відкрити книгу">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
      <button class="cookbook-book__delete-btn" aria-label="Видалити книгу">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `;

  // Відкрити книгу
  article.querySelector('.cookbook-book__open-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openBook(book);
  });

  // Видалити книгу
  article.querySelector('.cookbook-book__delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteBook(book.id);
  });

  // Клік по всій картці теж відкриває
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
  } catch (err) {
    console.error('Error creating book:', err);
    alert('Помилка створення книги');
  }
}

async function deleteBook(bookId) {
  if (!confirm('Видалити цю книгу? Рецепти залишаться в загальному списку.')) return;

  try {
    const { error } = await supabase.from('cookbooks').delete().eq('id', bookId);

    if (error) throw error;

    // Видаляємо з DOM
    const bookEl = booksGrid.querySelector(`[data-book-id="${bookId}"]`);
    bookEl?.remove();
  } catch (err) {
    console.error('Error deleting book:', err);
    alert('Помилка видалення книги');
  }
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
      <p class="cookbook-recipes__empty">
        Тут поки немає рецептів. Додай їх зі сторінки "Рецепти"!
      </p>
    `;
    return;
  }

  bookRecipes.innerHTML = recipes
    .map((item) => {
      const recipe = item.recipes;
      if (!recipe) return '';

      return `
      <article class="cookbook-recipe" data-recipe-id="${recipe.id}">
        <div class="cookbook-recipe__image">
          ${
            recipe.image
              ? `<img src="${recipe.image}" alt="${escapeHtml(recipe.name_ua)}" />`
              : '<span class="cookbook-recipe__placeholder">🍽️</span>'
          }
        </div>
        <div class="cookbook-recipe__info">
          <h4 class="cookbook-recipe__title">${escapeHtml(recipe.name_ua)}</h4>
          <p class="cookbook-recipe__kcal">${recipe.kcal || '—'} ккал</p>
        </div>
        <button class="cookbook-recipe__remove" aria-label="Видалити з книги">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </article>
    `;
    })
    .join('');

  // Видалення рецепту з книги
  bookRecipes.querySelectorAll('.cookbook-recipe__remove').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const recipeId = e.target.closest('.cookbook-recipe').dataset.recipeId;
      await removeRecipeFromBook(recipeId);
    });
  });
}

async function removeRecipeFromBook(recipeId) {
  try {
    const { error } = await supabase
      .from('cookbook_recipes')
      .delete()
      .eq('cookbook_id', currentBookId)
      .eq('recipe_id', recipeId);

    if (error) throw error;

    // Оновлюємо список
    await loadBookRecipes();
  } catch (err) {
    console.error('Error removing recipe:', err);
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
      .single();

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
    alert('Помилка створення блокнота');
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
  } catch (err) {
    console.error('Error creating note:', err);
    alert('Помилка створення нотатки');
  }
}

function editNote(note) {
  noteTitle.value = note.title;
  noteContent.value = note.content || '';

  // Змінюємо форму на редагування
  const submitBtn = newNoteForm.querySelector('.cookbook-form__submit');
  submitBtn.textContent = 'Зберегти зміни';

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
    submitBtn.textContent = 'Зберегти';
    newNoteForm.onsubmit = handleCreateNote;

    await loadNotes();
  } catch (err) {
    console.error('Error updating note:', err);
    alert('Помилка оновлення нотатки');
  }
}

async function deleteNote(noteId) {
  if (!confirm('Видалити цю нотатку?')) return;

  try {
    const { error } = await supabase.from('cookbook_notes').delete().eq('id', noteId);

    if (error) throw error;

    await loadNotes();
  } catch (err) {
    console.error('Error deleting note:', err);
    alert('Помилка видалення нотатки');
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
