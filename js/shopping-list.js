/* ============================================================
   shopping-list.js — Список покупок
   ============================================================ */

import { supabase } from './supabaseClient.js';
import { initAuth } from './auth.js';
import { showToast } from './utils.js';

/* ============================================================
   СТАН
   ============================================================ */

let currentUser = null;
let activeItems = [];
let savedItems = [];
let editingItemId = null;

/* ============================================================
   DOM
   ============================================================ */

const activeListEl   = document.getElementById('shop-active-list');
const savedListEl    = document.getElementById('shop-saved-list');
const savedEmptyEl   = document.getElementById('shop-saved-empty');
const emptyStateEl   = document.getElementById('shop-empty');
const progressEl     = document.getElementById('shop-progress');
const progressFillEl = document.getElementById('shop-progress-fill');
const progressLabelEl= document.getElementById('shop-progress-label');
const importBannerEl = document.getElementById('shop-import-banner');

/* ============================================================
   ІНІЦІАЛІЗАЦІЯ
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await initAuth();

  if (currentUser) {
    await Promise.all([loadActiveList(), loadSavedItems()]);
    checkWeekMenuImport();
  }

  bindEvents();
});

/* ============================================================
   ЗАВАНТАЖЕННЯ ДАНИХ
   ============================================================ */

async function loadActiveList() {
  const { data, error } = await supabase
    .from('shopping_list')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  if (error) { console.error(error); return; }

  activeItems = data || [];
  renderActiveList();
  renderProgress();
}

async function loadSavedItems() {
  const { data, error } = await supabase
    .from('shopping_saved_items')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('sort_order', { ascending: true });

  if (error) { console.error(error); return; }

  savedItems = data || [];
  renderSavedList();
}

/* ============================================================
   РЕНДЕР — АКТИВНИЙ СПИСОК
   ============================================================ */

function renderActiveList() {
  activeListEl.innerHTML = '';

  if (activeItems.length === 0) {
    emptyStateEl.hidden = false;
    progressEl.hidden = true;
    return;
  }

  emptyStateEl.hidden = true;
  progressEl.hidden = false;

  // Групуємо по категоріях
  const groups = {};
  activeItems.forEach((item) => {
    const cat = item.category || 'Інше';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  Object.entries(groups).forEach(([category, items]) => {
    const section = document.createElement('div');
    section.className = 'shop-category';

    section.innerHTML = `
      <h3 class="shop-category__title">${category}</h3>
      <ul class="shop-category__list" data-category="${category}"></ul>
    `;

    const list = section.querySelector('.shop-category__list');

    items.forEach((item) => {
      list.appendChild(buildActiveItem(item));
    });

    activeListEl.appendChild(section);
  });
}

function buildActiveItem(item) {
  const li = document.createElement('li');
  li.className = `shop-item${item.is_checked ? ' shop-item--checked' : ''}`;
  li.dataset.id = item.id;

  const amountText = item.amount
    ? `${item.amount}${item.unit ? ' ' + item.unit : ''}`
    : '';

  li.innerHTML = `
    <label class="shop-item__check-label">
      <input
        type="checkbox"
        class="shop-item__checkbox"
        ${item.is_checked ? 'checked' : ''}
        aria-label="Позначити як куплене">
      <span class="shop-item__custom-check"></span>
    </label>
    <span class="shop-item__name">${escapeHTML(item.name)}</span>
    ${amountText ? `<span class="shop-item__amount">${escapeHTML(amountText)}</span>` : ''}
    <div class="shop-item__actions">
      <button class="shop-item__btn shop-item__btn--edit" aria-label="Редагувати">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="shop-item__btn shop-item__btn--delete" aria-label="Видалити">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  `;

  li.querySelector('.shop-item__checkbox').addEventListener('change', (e) => {
    toggleActiveItem(item.id, e.target.checked);
  });

  li.querySelector('.shop-item__btn--edit').addEventListener('click', () => {
    openEditModal(item);
  });

  li.querySelector('.shop-item__btn--delete').addEventListener('click', () => {
    deleteActiveItem(item.id);
  });

  return li;
}

/* ============================================================
   РЕНДЕР — ЗБЕРЕЖЕНИЙ СПИСОК
   ============================================================ */

function renderSavedList() {
  savedListEl.innerHTML = '';
  savedEmptyEl.hidden = savedItems.length > 0;

  savedItems.forEach((item) => {
    savedListEl.appendChild(buildSavedItem(item));
  });
}

function buildSavedItem(item) {
  const li = document.createElement('li');
  li.className = 'shop-saved__item';
  li.dataset.id = item.id;

  const amountText = item.amount
    ? `${item.amount}${item.unit ? ' ' + item.unit : ''}`
    : '';

  li.innerHTML = `
    <button class="shop-saved__move-btn" aria-label="Додати до активного списку">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
      </svg>
    </button>
    <span class="shop-saved__item-name">${escapeHTML(item.name)}</span>
    ${amountText ? `<span class="shop-saved__item-amount">${escapeHTML(amountText)}</span>` : ''}
    <button class="shop-saved__delete-btn" aria-label="Видалити з постійного списку">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  li.querySelector('.shop-saved__move-btn').addEventListener('click', () => {
    moveToActive(item);
  });

  li.querySelector('.shop-saved__delete-btn').addEventListener('click', () => {
    deleteSavedItem(item.id);
  });

  return li;
}

/* ============================================================
   ПРОГРЕС
   ============================================================ */

function renderProgress() {
  const total = activeItems.length;
  const checked = activeItems.filter((i) => i.is_checked).length;

  progressLabelEl.textContent = `${checked} / ${total} куплено`;

  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  progressFillEl.style.width = `${pct}%`;
}

/* ============================================================
   ІМПОРТ З ТИЖНЕВОГО МЕНЮ
   ============================================================ */

function checkWeekMenuImport() {
  const raw = localStorage.getItem('week_shopping_list');
  if (!raw) return;

  try {
    const items = JSON.parse(raw);
    if (items && items.length > 0) {
      importBannerEl.hidden = false;
    }
  } catch {
    localStorage.removeItem('week_shopping_list');
  }
}

async function importFromWeekMenu() {
  const raw = localStorage.getItem('week_shopping_list');
  if (!raw) return;

  let items;
  try {
    items = JSON.parse(raw);
  } catch {
    return;
  }

  if (!items || items.length === 0) return;

  const rows = items.map((item) => ({
    user_id: currentUser.id,
    name: item.name,
    amount: item.amount || null,
    unit: item.unit || null,
    category: item.category || 'Інше',
    is_checked: false,
  }));

  const { error } = await supabase.from('shopping_list').insert(rows);

  if (error) {
    showToast('Помилка імпорту', 'error');
    return;
  }

  localStorage.removeItem('week_shopping_list');
  importBannerEl.hidden = true;
  showToast(`Імпортовано ${rows.length} продуктів ✓`);
  await loadActiveList();
}

/* ============================================================
   CRUD — АКТИВНИЙ СПИСОК
   ============================================================ */

async function addActiveItem(name, amount, unit) {
  if (!currentUser) { showToast('Увійдіть в акаунт', 'error'); return; }
  const { data, error } = await supabase
    .from('shopping_list')
    .insert([{
      user_id: currentUser.id,
      name,
      amount: amount || null,
      unit: unit || null,
      category: 'Інше',
      is_checked: false,
    }])
    .select()
    .single();

  if (error) { showToast('Помилка додавання', 'error'); return; }

  activeItems.push(data);
  renderActiveList();
  renderProgress();
}

async function toggleActiveItem(id, isChecked) {
  const { error } = await supabase
    .from('shopping_list')
    .update({ is_checked: isChecked })
    .eq('id', id)
    .eq('user_id', currentUser.id);

  if (error) { showToast('Помилка', 'error'); return; }

  const item = activeItems.find((i) => i.id === id);
  if (item) item.is_checked = isChecked;

  const li = activeListEl.querySelector(`[data-id="${id}"]`);
  if (li) li.classList.toggle('shop-item--checked', isChecked);

  renderProgress();
}

async function deleteActiveItem(id) {
  const { error } = await supabase
    .from('shopping_list')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUser.id);

  if (error) { showToast('Помилка видалення', 'error'); return; }

  activeItems = activeItems.filter((i) => i.id !== id);
  renderActiveList();
  renderProgress();
}

async function clearActiveList() {
  const { error } = await supabase
    .from('shopping_list')
    .delete()
    .eq('user_id', currentUser.id);

  if (error) { showToast('Помилка', 'error'); return; }

  activeItems = [];
  renderActiveList();
  renderProgress();
  showToast('Список очищено');
}

/* ============================================================
   CRUD — ЗБЕРЕЖЕНИЙ СПИСОК
   ============================================================ */

async function addSavedItem(name, amount, unit) {
  if (!currentUser) { showToast('Увійдіть в акаунт', 'error'); return; }
  const { data, error } = await supabase
    .from('shopping_saved_items')
    .insert([{
      user_id: currentUser.id,
      name,
      amount: amount || null,
      unit: unit || null,
      sort_order: savedItems.length,
    }])
    .select()
    .single();

  if (error) { showToast('Помилка', 'error'); return; }

  savedItems.push(data);
  renderSavedList();
}

async function deleteSavedItem(id) {
  const { error } = await supabase
    .from('shopping_saved_items')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUser.id);

  if (error) { showToast('Помилка', 'error'); return; }

  savedItems = savedItems.filter((i) => i.id !== id);
  renderSavedList();
}

async function moveToActive(savedItem) {
  const exists = activeItems.find(
    (i) => i.name.toLowerCase() === savedItem.name.toLowerCase()
  );

  if (exists) {
    showToast(`"${savedItem.name}" вже є в списку`, 'info');
    return;
  }

  const { data, error } = await supabase
    .from('shopping_list')
    .insert([{
      user_id: currentUser.id,
      name: savedItem.name,
      amount: savedItem.amount || null,
      unit: savedItem.unit || null,
      category: savedItem.category || 'Інше',
      is_checked: false,
    }])
    .select()
    .single();

  if (error) { showToast('Помилка', 'error'); return; }

  activeItems.push(data);
  renderActiveList();
  renderProgress();
  showToast(`"${savedItem.name}" додано до списку`);
}

/* ============================================================
   РЕДАГУВАННЯ (МОДАЛКА)
   ============================================================ */

const editModal  = document.getElementById('shop-edit-modal');
const editName   = document.getElementById('shop-edit-name');
const editQty    = document.getElementById('shop-edit-qty');
const editUnit   = document.getElementById('shop-edit-unit');

function openEditModal(item) {
  editingItemId = item.id;
  editName.value = item.name;
  editQty.value  = item.amount || '';
  editUnit.value = item.unit || '';
  editModal.classList.add('is-active');
  document.body.style.overflow = 'hidden';
  editName.focus();
}

function closeEditModal() {
  editModal.classList.remove('is-active');
  document.body.style.overflow = '';
  editingItemId = null;
}

async function saveEdit() {
  if (!editingItemId) return;

  const name   = editName.value.trim();
  const amount = parseFloat(editQty.value) || null;
  const unit   = editUnit.value.trim() || null;

  if (!name) { showToast('Введіть назву', 'error'); return; }

  const { error } = await supabase
    .from('shopping_list')
    .update({ name, amount, unit })
    .eq('id', editingItemId)
    .eq('user_id', currentUser.id);

  if (error) { showToast('Помилка збереження', 'error'); return; }

  const item = activeItems.find((i) => i.id === editingItemId);
  if (item) { item.name = name; item.amount = amount; item.unit = unit; }

  closeEditModal();
  renderActiveList();
}

/* ============================================================
   ДРУК
   ============================================================ */

function printList() {
  const unchecked = activeItems.filter((i) => !i.is_checked);
  const groups = {};
  unchecked.forEach((i) => {
    const cat = i.category || 'Інше';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(i);
  });

  let html = '<html><head><title>Список покупок</title></head><body>';
  html += '<h1>Список покупок</h1>';

  Object.entries(groups).forEach(([cat, items]) => {
    html += `<h2>${cat}</h2><ul>`;
    items.forEach((i) => {
      const amt = i.amount ? ` — ${i.amount}${i.unit ? ' ' + i.unit : ''}` : '';
      html += `<li>${i.name}${amt}</li>`;
    });
    html += '</ul>';
  });

  html += '</body></html>';

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.print();
}

/* ============================================================
   ПОДІЛИТИСЯ (Web Share API)
   ============================================================ */

async function shareList() {
  const unchecked = activeItems.filter((i) => !i.is_checked);

  if (unchecked.length === 0) {
    showToast('Список порожній', 'info');
    return;
  }

  const text = unchecked
    .map((i) => {
      const amt = i.amount ? ` ${i.amount}${i.unit ? ' ' + i.unit : ''}` : '';
      return `• ${i.name}${amt}`;
    })
    .join('\n');

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Список покупок', text });
    } catch { /* user cancelled */ }
  } else {
    await navigator.clipboard.writeText(text);
    showToast('Список скопійовано в буфер ✓');
  }
}

/* ============================================================
   ПОДІЇ
   ============================================================ */

function bindEvents() {
  // Форма швидкого додавання
  document.getElementById('shop-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name  = document.getElementById('shop-add-input').value.trim();
    const qty   = parseFloat(document.getElementById('shop-add-qty').value) || null;
    const unit  = document.getElementById('shop-add-unit').value.trim() || null;

    if (!name) return;

    await addActiveItem(name, qty, unit);

    document.getElementById('shop-add-input').value = '';
    document.getElementById('shop-add-qty').value   = '';
    document.getElementById('shop-add-unit').value  = '';
    document.getElementById('shop-add-input').focus();
  });

  // Додати до збереженого списку
  document.getElementById('shop-saved-add-btn').addEventListener('click', () => {
    const name = prompt('Назва продукту:');
    if (!name?.trim()) return;
    addSavedItem(name.trim(), null, null);
  });

  // Очистити список
  document.getElementById('shop-clear-btn').addEventListener('click', () => {
    if (!confirm('Очистити весь активний список?')) return;
    clearActiveList();
  });

  // Друк
  document.getElementById('shop-print-btn').addEventListener('click', printList);

  // Поділитися
  document.getElementById('shop-share-btn').addEventListener('click', shareList);

  // Імпорт із тижня
  document.getElementById('shop-import-confirm').addEventListener('click', importFromWeekMenu);
  document.getElementById('shop-import-dismiss').addEventListener('click', () => {
    importBannerEl.hidden = true;
    localStorage.removeItem('week_shopping_list');
  });

  // Редагування модалка
  document.getElementById('shop-edit-close').addEventListener('click', closeEditModal);
  document.getElementById('shop-edit-cancel').addEventListener('click', closeEditModal);
  document.getElementById('shop-edit-save').addEventListener('click', saveEdit);
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });
}

/* ============================================================
   УТИЛІТИ
   ============================================================ */

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
