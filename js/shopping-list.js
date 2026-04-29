/* ============================================================
   shopping-list.js — Список покупок (multi-list)
   ============================================================ */

import { supabase } from './supabaseClient.js';
import { initAuth } from './auth.js';
import { showToast } from './utils.js';

/* ============================================================
   СТАН
   ============================================================ */

let currentUser = null;
let allLists = [];          // всі списки користувача
let activeListId = null;    // ID поточного списку в центрі
let activeItems = [];       // позиції поточного списку
let wishlistId = null;      // ID вішліст-списку
let wishlistItems = [];     // позиції вішліста
let editingItemId = null;

/* ============================================================
   DOM
   ============================================================ */

const activeListEl   = document.getElementById('shop-active-list');
const emptyStateEl   = document.getElementById('shop-empty');
const progressFillEl = document.getElementById('shop-progress-fill');
const countLabelEl   = document.getElementById('shop-count-label');
const ringPathEl     = document.getElementById('shop-ring-path');
const ringValueEl    = document.getElementById('shop-ring-value');
const mainTitleEl    = document.getElementById('shop-main-title');
const listsUlEl      = document.getElementById('shop-lists-ul');
const wishlistUlEl   = document.getElementById('shop-wishlist-ul');
const importBannerEl = document.getElementById('shop-import-banner');

/* ============================================================
   ІНІЦІАЛІЗАЦІЯ
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await initAuth();

  if (currentUser) {
    await initLists();
    checkWeekMenuImport();
  }

  bindEvents();
});

async function initLists() {
  await loadAllLists();

  // Знаходимо або створюємо вішліст і постійний список
  wishlistId = await ensureSystemList('wishlist', 'Вішліст');
  const permanentId = await ensureSystemList('permanent', 'Постійний список');

  // Якщо є інші списки — активуємо перший; якщо ні — постійний
  const regularLists = allLists.filter(l => l.type === 'shopping' || l.type === 'event');
  activeListId = regularLists.length > 0
    ? regularLists[0].id
    : permanentId;

  renderLists();
  await Promise.all([loadActiveItems(), loadWishlistItems()]);
}

async function ensureSystemList(type, name) {
  const existing = allLists.find(l => l.type === type);
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('shopping_lists')
    .insert([{ user_id: currentUser.id, name, type }])
    .select()
    .single();

  if (error) { console.error('ensureSystemList:', error); return null; }

  allLists.push(data);
  return data.id;
}

/* ============================================================
   ЗАВАНТАЖЕННЯ СПИСКІВ
   ============================================================ */

async function loadAllLists() {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  if (error) { console.error(error); return; }
  allLists = data || [];
}

async function loadActiveItems() {
  if (!activeListId) return;

  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('list_id', activeListId)
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  if (error) { console.error(error); return; }

  activeItems = data || [];
  renderActiveList();
  renderProgress();
}

async function loadWishlistItems() {
  if (!wishlistId) return;

  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('list_id', wishlistId)
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  if (error) { console.error(error); return; }

  wishlistItems = data || [];
  renderWishlist();
}

/* ============================================================
   РЕНДЕР — СПИСКИ (права панель)
   ============================================================ */

function renderLists() {
  listsUlEl.innerHTML = '';

  const permanentList = allLists.find(l => l.type === 'permanent');
  const regularLists  = allLists.filter(l => l.type === 'shopping' || l.type === 'event');

  // Постійний список — завжди перший
  if (permanentList) {
    listsUlEl.appendChild(buildListItem(permanentList, true));
  }

  regularLists.forEach(list => {
    listsUlEl.appendChild(buildListItem(list, false));
  });
}

function buildListItem(list, isPermanent) {
  const li = document.createElement('li');
  li.className = `shop-list-item${list.id === activeListId ? ' shop-list-item--active' : ''}`;
  li.dataset.id = list.id;

  const itemCount = allLists.find(l => l.id === list.id)?._count || 0;

  const lockIcon = isPermanent
    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    : '';

  const meta = isPermanent
    ? 'відмітьте → перейдіть до активного'
    : formatListMeta(list);

  li.innerHTML = `
    <div class="shop-list-item__left">
      <p class="shop-list-item__name">${lockIcon}${escapeHTML(list.name)}</p>
      <p class="shop-list-item__meta">${meta}</p>
    </div>
    <svg class="shop-list-item__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
  `;

  li.addEventListener('click', () => selectList(list.id));
  return li;
}

function formatListMeta(list) {
  const parts = [];
  if (list.event_date) {
    parts.push(new Date(list.event_date).toLocaleDateString('uk', { day: 'numeric', month: 'short' }));
  }
  if (list.is_shared) parts.push('Спільний');
  return parts.length > 0 ? parts.join(' · ') : '';
}

async function selectList(id) {
  activeListId = id;

  // Оновлюємо заголовок центральної колонки
  const list = allLists.find(l => l.id === id);
  if (list && mainTitleEl) {
    mainTitleEl.textContent = list.type === 'permanent' ? 'Постійний список' : list.name;
  }

  // Оновлюємо активний стан у правій панелі
  listsUlEl.querySelectorAll('.shop-list-item').forEach(el => {
    el.classList.toggle('shop-list-item--active', Number(el.dataset.id) === id);
  });

  await loadActiveItems();
}

/* ============================================================
   РЕНДЕР — АКТИВНИЙ СПИСОК (центр)
   ============================================================ */

function renderActiveList() {
  activeListEl.innerHTML = '';

  if (activeItems.length === 0) {
    emptyStateEl.hidden = false;
    return;
  }

  emptyStateEl.hidden = true;

  const groups = {};
  activeItems.forEach(item => {
    const cat = item.category || 'Інше';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  Object.entries(groups).forEach(([category, items]) => {
    const section = document.createElement('div');
    section.className = 'shop-category';
    section.innerHTML = `
      <h3 class="shop-category__title">${escapeHTML(category)}</h3>
      <ul class="shop-category__list"></ul>
    `;
    const ul = section.querySelector('.shop-category__list');
    items.forEach(item => ul.appendChild(buildActiveItem(item)));
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
      <input type="checkbox" class="shop-item__checkbox" ${item.is_checked ? 'checked' : ''} aria-label="Куплено">
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
          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  `;

  li.querySelector('.shop-item__checkbox').addEventListener('change', e => {
    toggleItem(item.id, e.target.checked);
  });
  li.querySelector('.shop-item__btn--edit').addEventListener('click', () => openEditModal(item));
  li.querySelector('.shop-item__btn--delete').addEventListener('click', () => deleteItem(item.id));

  return li;
}

/* ============================================================
   РЕНДЕР — ВІШЛІСТ
   ============================================================ */

function renderWishlist() {
  wishlistUlEl.innerHTML = '';

  wishlistItems.forEach(item => {
    const li = document.createElement('li');
    li.className = 'shop-wishlist-item';
    li.dataset.id = item.id;

    const amountText = item.amount
      ? `${item.amount}${item.unit ? ' ' + item.unit : ''}`
      : '';

    li.innerHTML = `
      <div class="shop-wishlist-item__info">
        <p class="shop-wishlist-item__name">${escapeHTML(item.name)}</p>
        ${amountText ? `<p class="shop-wishlist-item__amount">${escapeHTML(amountText)}</p>` : ''}
        ${item.note ? `<p class="shop-wishlist-item__note">${escapeHTML(item.note)}</p>` : ''}
      </div>
      <button class="shop-wishlist-item__move-btn" aria-label="До списку">→ До списку</button>
      <button class="shop-wishlist-item__delete-btn" aria-label="Видалити">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    li.querySelector('.shop-wishlist-item__move-btn').addEventListener('click', () => moveWishlistItemToList(item));
    li.querySelector('.shop-wishlist-item__delete-btn').addEventListener('click', () => deleteWishlistItem(item.id));

    wishlistUlEl.appendChild(li);
  });
}

/* ============================================================
   ПРОГРЕС
   ============================================================ */

function renderProgress() {
  const total   = activeItems.length;
  const checked = activeItems.filter(i => i.is_checked).length;
  const pct     = total > 0 ? Math.round((checked / total) * 100) : 0;

  if (countLabelEl)   countLabelEl.textContent = total > 0 ? `${checked} з ${total} куплено` : '';
  if (progressFillEl) progressFillEl.style.width = `${pct}%`;
  if (ringValueEl)    ringValueEl.textContent = `${checked}/${total}`;
  if (ringPathEl)     ringPathEl.setAttribute('stroke-dasharray', `${pct}, 100`);
}

/* ============================================================
   ІМПОРТ З ТИЖНЕВОГО МЕНЮ
   ============================================================ */

function checkWeekMenuImport() {
  const raw = localStorage.getItem('week_shopping_list');
  if (!raw) return;
  try {
    const items = JSON.parse(raw);
    if (items?.length > 0) importBannerEl.hidden = false;
  } catch {
    localStorage.removeItem('week_shopping_list');
  }
}

async function importFromWeekMenu() {
  if (!activeListId) return;
  const raw = localStorage.getItem('week_shopping_list');
  if (!raw) return;

  let items;
  try { items = JSON.parse(raw); } catch { return; }
  if (!items?.length) return;

  const rows = items.map(item => ({
    list_id: activeListId,
    user_id: currentUser.id,
    name: item.name,
    amount: item.amount || null,
    unit: item.unit || null,
    category: item.category || 'Інше',
    is_checked: false,
  }));

  const { error } = await supabase.from('shopping_items').insert(rows);
  if (error) { showToast('Помилка імпорту', 'error'); return; }

  localStorage.removeItem('week_shopping_list');
  importBannerEl.hidden = true;
  showToast(`Імпортовано ${rows.length} продуктів ✓`);
  await loadActiveItems();
}

/* ============================================================
   CRUD — АКТИВНИЙ СПИСОК
   ============================================================ */

async function addItem(name, amount, unit) {
  if (!currentUser) { showToast('Увійдіть в акаунт', 'error'); return; }
  if (!activeListId) { showToast('Оберіть список', 'error'); return; }

  const { data, error } = await supabase
    .from('shopping_items')
    .insert([{
      list_id: activeListId,
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

async function toggleItem(id, isChecked) {
  const { error } = await supabase
    .from('shopping_items')
    .update({ is_checked: isChecked })
    .eq('id', id)
    .eq('user_id', currentUser.id);

  if (error) { showToast('Помилка', 'error'); return; }

  const item = activeItems.find(i => i.id === id);
  if (item) item.is_checked = isChecked;

  const li = activeListEl.querySelector(`[data-id="${id}"]`);
  if (li) li.classList.toggle('shop-item--checked', isChecked);

  renderProgress();
}

async function deleteItem(id) {
  const { error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUser.id);

  if (error) { showToast('Помилка видалення', 'error'); return; }

  activeItems = activeItems.filter(i => i.id !== id);
  renderActiveList();
  renderProgress();
}

async function clearCheckedItems() {
  const checkedIds = activeItems.filter(i => i.is_checked).map(i => i.id);
  if (checkedIds.length === 0) { showToast('Немає куплених позицій', 'info'); return; }

  const { error } = await supabase
    .from('shopping_items')
    .delete()
    .in('id', checkedIds)
    .eq('user_id', currentUser.id);

  if (error) { showToast('Помилка', 'error'); return; }

  activeItems = activeItems.filter(i => !i.is_checked);
  renderActiveList();
  renderProgress();
  showToast(`Видалено ${checkedIds.length} куплених позицій`);
}

/* ============================================================
   CRUD — ВІШЛІСТ
   ============================================================ */

async function addWishlistItem(name, note) {
  if (!currentUser) { showToast('Увійдіть в акаунт', 'error'); return; }
  if (!wishlistId) return;

  const { data, error } = await supabase
    .from('shopping_items')
    .insert([{
      list_id: wishlistId,
      user_id: currentUser.id,
      name,
      note: note || null,
      category: 'Інше',
      is_checked: false,
    }])
    .select()
    .single();

  if (error) { showToast('Помилка', 'error'); return; }

  wishlistItems.push(data);
  renderWishlist();
}

async function deleteWishlistItem(id) {
  const { error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUser.id);

  if (error) { showToast('Помилка', 'error'); return; }

  wishlistItems = wishlistItems.filter(i => i.id !== id);
  renderWishlist();
}

async function moveWishlistItemToList(item) {
  if (!activeListId) { showToast('Оберіть список', 'error'); return; }

  const { data, error } = await supabase
    .from('shopping_items')
    .insert([{
      list_id: activeListId,
      user_id: currentUser.id,
      name: item.name,
      amount: item.amount || null,
      unit: item.unit || null,
      category: 'Інше',
      is_checked: false,
    }])
    .select()
    .single();

  if (error) { showToast('Помилка', 'error'); return; }

  activeItems.push(data);
  renderActiveList();
  renderProgress();
  showToast(`"${item.name}" додано до списку`);
}

/* ============================================================
   CRUD — СПИСКИ
   ============================================================ */

async function createList(name, type) {
  if (!currentUser) return;
  if (!name.trim()) { showToast('Введіть назву списку', 'error'); return; }

  const { data, error } = await supabase
    .from('shopping_lists')
    .insert([{ user_id: currentUser.id, name: name.trim(), type }])
    .select()
    .single();

  if (error) { showToast('Помилка створення', 'error'); return; }

  allLists.push(data);
  renderLists();
  await selectList(data.id);
  showToast(`Список "${data.name}" створено`);
}

/* ============================================================
   РЕДАГУВАННЯ (МОДАЛКА)
   ============================================================ */

const editModal = document.getElementById('shop-edit-modal');
const editName  = document.getElementById('shop-edit-name');
const editQty   = document.getElementById('shop-edit-qty');
const editUnit  = document.getElementById('shop-edit-unit');

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
    .from('shopping_items')
    .update({ name, amount, unit })
    .eq('id', editingItemId)
    .eq('user_id', currentUser.id);

  if (error) { showToast('Помилка збереження', 'error'); return; }

  const item = activeItems.find(i => i.id === editingItemId);
  if (item) { item.name = name; item.amount = amount; item.unit = unit; }

  closeEditModal();
  renderActiveList();
}

/* ============================================================
   ДРУК / ПОДІЛИТИСЯ
   ============================================================ */

function printList() {
  const groups = {};
  activeItems.filter(i => !i.is_checked).forEach(i => {
    const cat = i.category || 'Інше';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(i);
  });

  let html = '<html><head><title>Список покупок</title></head><body>';
  html += `<h1>${escapeHTML(mainTitleEl?.textContent || 'Список покупок')}</h1>`;

  Object.entries(groups).forEach(([cat, items]) => {
    html += `<h2>${cat}</h2><ul>`;
    items.forEach(i => {
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

async function shareList() {
  const unchecked = activeItems.filter(i => !i.is_checked);
  if (unchecked.length === 0) { showToast('Список порожній', 'info'); return; }

  const text = unchecked
    .map(i => `• ${i.name}${i.amount ? ' ' + i.amount + (i.unit ? ' ' + i.unit : '') : ''}`)
    .join('\n');

  if (navigator.share) {
    try { await navigator.share({ title: 'Список покупок', text }); } catch { }
  } else {
    await navigator.clipboard.writeText(text);
    showToast('Список скопійовано в буфер ✓');
  }
}

/* ============================================================
   ПОДІЇ
   ============================================================ */

function bindEvents() {
  // Форма додавання продукту
  document.getElementById('shop-add-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('shop-add-input').value.trim();
    const qty  = parseFloat(document.getElementById('shop-add-qty').value) || null;
    const unit = document.getElementById('shop-add-unit').value.trim() || null;
    if (!name) return;
    await addItem(name, qty, unit);
    document.getElementById('shop-add-input').value = '';
    document.getElementById('shop-add-qty').value   = '';
    document.getElementById('shop-add-unit').value  = '';
    document.getElementById('shop-add-input').focus();
  });

  // Очистити куплені
  document.getElementById('shop-clear-checked-btn').addEventListener('click', clearCheckedItems);

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
  editModal.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });

  // Швидке створення списку в панелі
  document.getElementById('shop-newlist-quick-btn').addEventListener('click', async () => {
    const input = document.getElementById('shop-newlist-quick');
    const name = input.value.trim();
    if (!name) return;
    await createList(name, 'shopping');
    input.value = '';
  });
  document.getElementById('shop-newlist-quick').addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      const name = e.target.value.trim();
      if (!name) return;
      await createList(name, 'shopping');
      e.target.value = '';
    }
  });

  // Форма новий список (панель)
  document.getElementById('newlist-create-btn').addEventListener('click', async () => {
    const name = document.getElementById('newlist-name-input').value.trim();
    const type = document.querySelector('input[name="list-type"]:checked')?.value || 'shopping';
    if (!name) { showToast('Введіть назву списку', 'error'); return; }
    await createList(name, type);
    document.getElementById('newlist-name-input').value = '';
    // Закриваємо панель
    const body = document.getElementById('panel-new-list-body');
    const toggle = document.querySelector('[data-panel="new-list"]');
    body.classList.remove('is-open');
    toggle.classList.remove('is-open');
  });

  // Додати до вішліста
  document.getElementById('wishlist-add-btn').addEventListener('click', async () => {
    const name = document.getElementById('wishlist-name-input').value.trim();
    const note = document.getElementById('wishlist-note-input').value.trim();
    if (!name) { showToast('Введіть назву', 'error'); return; }
    await addWishlistItem(name, note);
    document.getElementById('wishlist-name-input').value = '';
    document.getElementById('wishlist-note-input').value = '';
  });

  // Акордеони правої панелі
  document.querySelectorAll('.shop-panel__toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      const body  = document.getElementById(`panel-${panel}-body`);
      const isOpen = btn.classList.contains('is-open');
      btn.classList.toggle('is-open', !isOpen);
      body.classList.toggle('is-open', !isOpen);
    });
  });

  // Тип списку — radio highlight
  document.querySelectorAll('.shop-newlist__type input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.shop-newlist__type').forEach(el => {
        el.classList.remove('shop-newlist__type--active');
      });
      radio.closest('.shop-newlist__type').classList.add('shop-newlist__type--active');
    });
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
