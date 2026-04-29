/* ============================================================
   shopping-list.js — Список покупок
   Центр: завжди активний список. Права панель: шаблони, які
   розкриваються в собі й переносять товари до центру.
   ============================================================ */

import { supabase } from './supabaseClient.js';
import { initAuth } from './auth.js';
import { showToast } from './utils.js';

/* ============================================================
   СТАН
   ============================================================ */

let currentUser  = null;
let mainListId   = null;   // завжди відображається в центрі
let allLists     = [];     // всі списки (без mainList і wishlist)
let activeItems  = [];     // позиції mainList
let wishlistId   = null;
let wishlistItems= [];
let panelOpenId  = null;   // який список розкрито в правій панелі
let editingItemId= null;

/* ============================================================
   DOM
   ============================================================ */

const activeListEl   = document.getElementById('shop-active-list');
const emptyStateEl   = document.getElementById('shop-empty');
const progressFillEl = document.getElementById('shop-progress-fill');
const countLabelEl   = document.getElementById('shop-count-label');
const ringPathEl     = document.getElementById('shop-ring-path');
const ringValueEl    = document.getElementById('shop-ring-value');
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

  // Гарантуємо існування системних списків
  wishlistId = await ensureList('wishlist', 'Вішліст');
  await ensureList('permanent', 'Постійний список');
  mainListId = await ensureMainList();

  renderLists();
  await Promise.all([loadActiveItems(), loadWishlistItems()]);
}

async function loadAllLists() {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  if (error) { console.error(error); return; }
  allLists = data || [];
}

async function ensureList(type, name) {
  const existing = allLists.find(l => l.type === type);
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('shopping_lists')
    .insert([{ user_id: currentUser.id, name, type }])
    .select()
    .single();

  if (error) { console.error('ensureList:', error); return null; }
  allLists.push(data);
  return data.id;
}

async function ensureMainList() {
  // Перший shopping список — це головний активний список
  const existing = allLists.find(l => l.type === 'shopping');
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('shopping_lists')
    .insert([{ user_id: currentUser.id, name: 'Список покупок', type: 'shopping' }])
    .select()
    .single();

  if (error) { console.error('ensureMainList:', error); return null; }
  allLists.push(data);
  return data.id;
}

/* ============================================================
   ЗАВАНТАЖЕННЯ ПОЗИЦІЙ
   ============================================================ */

async function loadActiveItems() {
  if (!mainListId) return;

  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('list_id', mainListId)
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
   РЕНДЕР — ПРАВА ПАНЕЛЬ "МОЇ СПИСКИ"
   Показує всі списки, КРІМ mainList і wishlist
   ============================================================ */

function renderLists() {
  listsUlEl.innerHTML = '';

  const panelLists = allLists.filter(l =>
    l.id !== mainListId && l.type !== 'wishlist'
  );

  // Постійний список завжди першим
  const permanent = panelLists.find(l => l.type === 'permanent');
  if (permanent) listsUlEl.appendChild(buildListItem(permanent));

  panelLists
    .filter(l => l.type !== 'permanent')
    .forEach(l => listsUlEl.appendChild(buildListItem(l)));
}

function buildListItem(list) {
  const li = document.createElement('li');
  li.className = 'shop-list-item';
  li.dataset.id = list.id;

  const isPermanent = list.type === 'permanent';
  const lockIcon = isPermanent
    ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    : '';

  const meta = isPermanent
    ? 'відмітьте → перейдіть до активного'
    : formatListMeta(list);

  li.innerHTML = `
    <div class="shop-list-item__header">
      <div class="shop-list-item__left">
        <p class="shop-list-item__name">${lockIcon}${escapeHTML(list.name)}</p>
        ${meta ? `<p class="shop-list-item__meta">${meta}</p>` : ''}
      </div>
      <svg class="shop-list-item__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
    <ul class="shop-list-item__sub-items" hidden></ul>
  `;

  li.querySelector('.shop-list-item__header').addEventListener('click', () => {
    togglePanelList(list.id, li);
  });

  return li;
}

function formatListMeta(list) {
  const parts = [];
  if (list.event_date) {
    parts.push(new Date(list.event_date).toLocaleDateString('uk', { day: 'numeric', month: 'short' }));
  }
  if (list.is_shared) parts.push('Спільний');
  return parts.join(' · ');
}

async function togglePanelList(listId, li) {
  const subItems = li.querySelector('.shop-list-item__sub-items');

  if (panelOpenId === listId) {
    // Закриваємо
    subItems.hidden = true;
    li.classList.remove('shop-list-item--open');
    panelOpenId = null;
    return;
  }

  // Закриваємо попередній
  if (panelOpenId) {
    const prevLi = listsUlEl.querySelector(`[data-id="${panelOpenId}"]`);
    if (prevLi) {
      prevLi.querySelector('.shop-list-item__sub-items').hidden = true;
      prevLi.classList.remove('shop-list-item--open');
    }
  }

  panelOpenId = listId;
  li.classList.add('shop-list-item--open');
  subItems.hidden = false;
  await loadPanelListItems(listId, subItems);
}

async function loadPanelListItems(listId, container) {
  container.innerHTML = '<li class="shop-list-item__sub-empty">Завантаження...</li>';

  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('list_id', listId)
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  container.innerHTML = '';

  if (error || !data || data.length === 0) {
    container.innerHTML = '<li class="shop-list-item__sub-empty">Список порожній</li>';
    return;
  }

  data.forEach(item => {
    const el = document.createElement('li');
    el.className = 'shop-list-item__sub-item';

    const amountText = item.amount
      ? `${item.amount}${item.unit ? ' ' + item.unit : ''}`
      : '';

    el.innerHTML = `
      <span class="shop-list-item__sub-name">${escapeHTML(item.name)}</span>
      ${amountText ? `<span class="shop-list-item__sub-amount">${escapeHTML(amountText)}</span>` : ''}
      <button class="shop-list-item__sub-add">→ Додати</button>
    `;

    el.querySelector('.shop-list-item__sub-add').addEventListener('click', e => {
      e.stopPropagation();
      addFromPanel(item);
    });

    container.appendChild(el);
  });
}

async function addFromPanel(item) {
  if (!mainListId) return;

  const existing = activeItems.find(i =>
    i.name.toLowerCase() === item.name.toLowerCase() && !i.is_checked
  );

  if (existing) {
    const newAmount = (parseFloat(existing.amount) || 0) + (parseFloat(item.amount) || 0);
    await updateItemAmount(existing.id, newAmount || null);
    showToast(`"${item.name}" оновлено`);
  } else {
    const { data, error } = await supabase
      .from('shopping_items')
      .insert([{
        list_id: mainListId,
        user_id: currentUser.id,
        name: item.name,
        amount: item.amount || null,
        unit: item.unit || null,
        category: item.category || 'Інше',
        is_checked: false,
      }])
      .select()
      .single();

    if (error) { showToast('Помилка', 'error'); return; }
    activeItems.push(data);
    showToast(`"${item.name}" додано до списку`);
  }

  renderActiveList();
  renderProgress();
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

  if (wishlistItems.length === 0) {
    wishlistUlEl.innerHTML = '<li style="font-size:12px;color:var(--color-text-secondary);padding:4px 0">Список порожній</li>';
    return;
  }

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
      <button class="shop-wishlist-item__move-btn">→ До списку</button>
      <button class="shop-wishlist-item__delete-btn" aria-label="Видалити">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    li.querySelector('.shop-wishlist-item__move-btn').addEventListener('click', () => addFromPanel(item));
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
  if (!mainListId) return;
  const raw = localStorage.getItem('week_shopping_list');
  if (!raw) return;

  let items;
  try { items = JSON.parse(raw); } catch { return; }
  if (!items?.length) return;

  const rows = items.map(item => ({
    list_id: mainListId,
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
  if (!mainListId)  { showToast('Помилка ініціалізації', 'error'); return; }

  // Якщо такий товар вже є (та ж назва + та ж одиниця) — сумуємо кількість
  const existing = activeItems.find(i =>
    i.name.toLowerCase() === name.toLowerCase() &&
    (i.unit || '').toLowerCase() === (unit || '').toLowerCase() &&
    !i.is_checked
  );

  if (existing && amount) {
    const newAmount = (parseFloat(existing.amount) || 0) + amount;
    await updateItemAmount(existing.id, newAmount);
    return;
  }

  const { data, error } = await supabase
    .from('shopping_items')
    .insert([{
      list_id: mainListId,
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

async function updateItemAmount(id, newAmount) {
  const { error } = await supabase
    .from('shopping_items')
    .update({ amount: newAmount })
    .eq('id', id)
    .eq('user_id', currentUser.id);

  if (error) { showToast('Помилка', 'error'); return; }

  const item = activeItems.find(i => i.id === id);
  if (item) item.amount = newAmount;

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
  if (!currentUser || !wishlistId) return;

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

/* ============================================================
   CRUD — СПИСКИ (права панель)
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
  editingItemId  = item.id;
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
  html += '<h1>Список покупок</h1>';
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

  // Швидке створення нового списку в панелі
  const quickInput = document.getElementById('shop-newlist-quick');
  document.getElementById('shop-newlist-quick-btn').addEventListener('click', async () => {
    const name = quickInput.value.trim();
    if (!name) return;
    await createList(name, 'shopping');
    quickInput.value = '';
  });
  quickInput.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    const name = e.target.value.trim();
    if (!name) return;
    await createList(name, 'shopping');
    e.target.value = '';
  });

  // Форма "+ Новий список"
  document.getElementById('newlist-create-btn').addEventListener('click', async () => {
    const name = document.getElementById('newlist-name-input').value.trim();
    const type = document.querySelector('input[name="list-type"]:checked')?.value || 'shopping';
    if (!name) { showToast('Введіть назву списку', 'error'); return; }
    await createList(name, type);
    document.getElementById('newlist-name-input').value = '';
    // Закриваємо панель
    const body   = document.getElementById('panel-new-list-body');
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
      const panel  = btn.dataset.panel;
      const body   = document.getElementById(`panel-${panel}-body`);
      const isOpen = btn.classList.contains('is-open');
      btn.classList.toggle('is-open', !isOpen);
      body.classList.toggle('is-open', !isOpen);
    });
  });

  // Тип списку — radio highlight
  document.querySelectorAll('.shop-newlist__type input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.shop-newlist__type').forEach(el =>
        el.classList.remove('shop-newlist__type--active')
      );
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
