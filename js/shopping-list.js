/* ============================================================
   shopping-list.js
   Центр: активний список (завжди).
   Права панель: шаблони розкриваються в собі,
   товари переносяться до центру кнопкою "→ Додати".
   ============================================================ */

import { supabase } from './supabaseClient.js';
import { initAuth } from './auth.js';
import { showToast, escapeHTML } from './utils.js';
import { lockScroll, unlockScroll } from './scroll-lock.js';
import { getWeekShoppingList, clearWeekShoppingList } from './storage.js';
import { iconLock, iconPin, iconMoreVertical, iconChevronRight, iconEdit, iconTrash } from './icons.js';
import { showConfirmModal } from './ui-components.js';

/* ============================================================
   СТАН
   ============================================================ */

let currentUser = null;
let mainListId  = null;    // завжди в центрі
let allLists    = [];
let activeItems = [];      // позиції mainList
let panelOpenId = null;    // який список розкрито в панелі
let editingItemId      = null;
let editingPanelCtx    = null; // { listId, container } або null

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
const wishlistsUlEl  = document.getElementById('shop-wishlists-ul');
const importBannerEl = document.getElementById('shop-import-banner');

/* ============================================================
   ІНІЦІАЛІЗАЦІЯ
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await initAuth();
  if (currentUser) {
    await initLists();
    subscribeToMainList();
    startPolling();
    checkWeekMenuImport();
  }
  bindEvents();

  // Закриваємо dropdown при кліку поза ним
  document.addEventListener('click', e => {
    if (!e.target.closest('.shop-list-item__dropdown') &&
        !e.target.closest('.shop-list-item__dots-btn')) {
      document.querySelectorAll('.shop-list-item__dropdown:not([hidden])')
        .forEach(el => el.hidden = true);
    }
  });
});

async function initLists() {
  await loadAllLists();
  await ensureList('permanent', 'Постійний список');
  mainListId = await ensureMainList();
  renderLists();
  renderWishlistPanel();
  await loadActiveItems();
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
    .select().single();
  if (error) { console.error('ensureList:', error); return null; }
  allLists.push(data);
  return data.id;
}

async function ensureMainList() {
  const existing = allLists.find(l => l.type === 'shopping');
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from('shopping_lists')
    .insert([{ user_id: currentUser.id, name: 'Список покупок', type: 'shopping' }])
    .select().single();
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

/* ============================================================
   РЕНДЕР — ПРАВА ПАНЕЛЬ "МОЇ СПИСКИ"
   Все крім mainList і wishlist-типів
   ============================================================ */

function renderLists() {
  if (!listsUlEl) return;
  listsUlEl.innerHTML = '';

  const panelLists = allLists.filter(l => l.id !== mainListId && l.type !== 'wishlist');

  const permanent = panelLists.find(l => l.type === 'permanent');
  const pinned    = panelLists.filter(l => l.type !== 'permanent' && l.is_pinned);
  const unpinned  = panelLists.filter(l => l.type !== 'permanent' && !l.is_pinned);

  if (permanent) listsUlEl.appendChild(buildListItem(permanent));
  pinned.forEach(l   => listsUlEl.appendChild(buildListItem(l)));
  unpinned.forEach(l => listsUlEl.appendChild(buildListItem(l)));
}

function renderWishlistPanel() {
  if (!wishlistsUlEl) return;
  wishlistsUlEl.innerHTML = '';

  const wishlists = allLists.filter(l => l.type === 'wishlist');

  if (wishlists.length === 0) {
    wishlistsUlEl.innerHTML =
      '<li class="shop-list-item__sub-empty" style="padding:4px 2px">Вішлістів ще немає</li>';
    return;
  }

  const pinned   = wishlists.filter(l => l.is_pinned);
  const unpinned = wishlists.filter(l => !l.is_pinned);
  [...pinned, ...unpinned].forEach(l => wishlistsUlEl.appendChild(buildListItem(l)));
}

/* ============================================================
   BUILD LIST ITEM (права панель)
   ============================================================ */

function buildListItem(list) {
  const li = document.createElement('li');
  li.className = 'shop-list-item';
  li.dataset.id = list.id;

  const isPermanent = list.type === 'permanent';

  const lockIcon = isPermanent
    ? iconLock.replace('<svg ', '<svg width="11" height="11" ')
    : '';

  const pinBadge = (!isPermanent && list.is_pinned)
    ? iconPin.replace('<svg ', '<svg width="10" height="10" style="color:var(--color-accent)" ')
    : '';

  const meta = isPermanent
    ? 'відмітьте → перейдіть до активного'
    : formatListMeta(list);

  const dotsMenu = !isPermanent ? `
    <button class="shop-list-item__dots-btn" aria-label="Меню списку">
      ${iconMoreVertical.replace('<svg ', '<svg width="14" height="14" ')}
    </button>
    <div class="shop-list-item__dropdown" hidden>
      ${list.is_pinned
        ? `<button data-action="unpin">📌 Відкріпити</button>`
        : `<button data-action="pin">📌 Закріпити</button>`}
      <button data-action="share">🔗 Поділитися</button>
      <button data-action="clear">🧹 Очистити список</button>
      <button data-action="delete">🗑 Видалити список</button>
    </div>` : '';

  li.innerHTML = `
    <div class="shop-list-item__header">
      <div class="shop-list-item__left">
        <p class="shop-list-item__name">${lockIcon}${pinBadge}${escapeHTML(list.name)}</p>
        ${meta ? `<p class="shop-list-item__meta">${meta}</p>` : ''}
      </div>
      <div class="shop-list-item__controls">
        ${dotsMenu}
        ${iconChevronRight.replace('<svg ', '<svg class="shop-list-item__chevron" width="14" height="14" ')}
      </div>
    </div>
    <ul class="shop-list-item__sub-items" hidden></ul>
  `;

  // Toggle expand
  li.querySelector('.shop-list-item__header').addEventListener('click', e => {
    if (e.target.closest('.shop-list-item__dots-btn') ||
        e.target.closest('.shop-list-item__dropdown')) return;
    togglePanelList(list.id, li);
  });

  // Three-dot menu
  const dotsBtn  = li.querySelector('.shop-list-item__dots-btn');
  const dropdown = li.querySelector('.shop-list-item__dropdown');
  if (dotsBtn && dropdown) {
    dotsBtn.addEventListener('click', e => {
      e.stopPropagation();
      document.querySelectorAll('.shop-list-item__dropdown:not([hidden])')
        .forEach(el => { if (el !== dropdown) el.hidden = true; });
      dropdown.hidden = !dropdown.hidden;
    });

    dropdown.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      dropdown.hidden = true;
      const action = btn.dataset.action;
      if (action === 'pin')    pinListById(list.id, true);
      if (action === 'unpin')  pinListById(list.id, false);
      if (action === 'share')  shareListById(list.id);
      if (action === 'clear')  clearListById(list.id);
      if (action === 'delete') deleteListById(list.id);
    });
  }

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

/* ============================================================
   ПАНЕЛЬ — РОЗКРИТТЯ СПИСКУ
   ============================================================ */

async function togglePanelList(listId, li) {
  const subItems = li.querySelector('.shop-list-item__sub-items');

  if (panelOpenId === listId) {
    subItems.hidden = true;
    li.classList.remove('shop-list-item--open');
    panelOpenId = null;
    return;
  }

  // Закрити попередній
  if (panelOpenId) {
    const prev = document.querySelector(`.shop-list-item[data-id="${panelOpenId}"]`);
    if (prev) {
      prev.querySelector('.shop-list-item__sub-items').hidden = true;
      prev.classList.remove('shop-list-item--open');
    }
  }

  panelOpenId = listId;
  li.classList.add('shop-list-item--open');
  subItems.hidden = false;
  await loadPanelListItems(listId, subItems);
}

async function loadPanelListItems(listId, container) {
  container.innerHTML =
    '<li class="shop-list-item__sub-empty">Завантаження...</li>';

  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('list_id', listId)
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  container.innerHTML = '';

  if (data && data.length > 0) {
    data.forEach(item => container.appendChild(buildPanelSubItem(item, listId, container)));
  } else {
    const empty = document.createElement('li');
    empty.className = 'shop-list-item__sub-empty';
    empty.textContent = 'Список порожній';
    container.appendChild(empty);
  }

  const isWishlist = allLists.find(l => l.id === listId)?.type === 'wishlist';
  container.appendChild(buildPanelAddForm(listId, container, isWishlist));
}

function buildPanelSubItem(item, listId, container) {
  const li = document.createElement('li');
  li.className = 'shop-list-item__sub-item';
  li.dataset.id = item.id;

  const isWishlist = allLists.find(l => l.id === listId)?.type === 'wishlist';
  const amountText = !isWishlist && item.amount
    ? `${item.amount}${item.unit ? ' ' + item.unit : ''}`
    : '';

  li.innerHTML = `
    <div class="shop-list-item__sub-info">
      <span class="shop-list-item__sub-name">${escapeHTML(item.name)}</span>
      ${item.note ? `<span class="shop-list-item__sub-note">${escapeHTML(item.note)}</span>` : ''}
    </div>
    ${amountText ? `<span class="shop-list-item__sub-amount">${escapeHTML(amountText)}</span>` : ''}
    <button class="shop-list-item__sub-add" title="Додати до активного списку">→</button>
    <button class="shop-list-item__sub-btn shop-list-item__sub-btn--edit" aria-label="Редагувати">
      ${iconEdit.replace('<svg ', '<svg width="12" height="12" ')}
    </button>
    <button class="shop-list-item__sub-btn shop-list-item__sub-btn--delete" aria-label="Видалити">
      ${iconTrash.replace('<svg ', '<svg width="12" height="12" ')}
    </button>
  `;

  li.querySelector('.shop-list-item__sub-add').addEventListener('click', e => {
    e.stopPropagation();
    copyToActiveList(item);
  });

  li.querySelector('.shop-list-item__sub-btn--edit').addEventListener('click', e => {
    e.stopPropagation();
    openEditModal(item, { listId, container });
  });

  li.querySelector('.shop-list-item__sub-btn--delete').addEventListener('click', async e => {
    e.stopPropagation();
    await deletePanelItem(item.id, li, container);
  });

  return li;
}

function buildPanelAddForm(listId, container, isWishlist = false) {
  const li = document.createElement('li');
  li.className = 'shop-panel-item-add';

  if (isWishlist) {
    li.innerHTML = `
      <input type="text" class="shop-panel-item-add__input" placeholder="Назва..." />
      <div class="shop-panel-item-add__row">
        <input type="text" class="shop-panel-item-add__note" placeholder="Примітка..." />
        <button class="shop-panel-item-add__btn" aria-label="Додати">+</button>
      </div>
    `;
    const nameEl = li.querySelector('.shop-panel-item-add__input');
    const noteEl = li.querySelector('.shop-panel-item-add__note');
    const btn    = li.querySelector('.shop-panel-item-add__btn');
    const doAdd  = async () => {
      const name = nameEl.value.trim();
      if (!name) { nameEl.focus(); return; }
      await addPanelItem(name, null, null, listId, container, li, noteEl.value.trim() || null);
      nameEl.value = ''; noteEl.value = ''; nameEl.focus();
    };
    btn.addEventListener('click', doAdd);
    nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  } else {
    li.innerHTML = `
      <input type="text" class="shop-panel-item-add__input" placeholder="Назва продукту..." />
      <div class="shop-panel-item-add__row">
        <input type="number" class="shop-panel-item-add__qty"  placeholder="К-сть" min="0" step="any" />
        <input type="text"   class="shop-panel-item-add__unit" placeholder="од." maxlength="8" />
        <button class="shop-panel-item-add__btn" aria-label="Додати">+</button>
      </div>
    `;
    const nameEl = li.querySelector('.shop-panel-item-add__input');
    const qtyEl  = li.querySelector('.shop-panel-item-add__qty');
    const unitEl = li.querySelector('.shop-panel-item-add__unit');
    const btn    = li.querySelector('.shop-panel-item-add__btn');
    const doAdd  = async () => {
      const name = nameEl.value.trim();
      if (!name) { nameEl.focus(); return; }
      await addPanelItem(name, parseFloat(qtyEl.value) || null, unitEl.value.trim() || null, listId, container, li);
      nameEl.value = ''; qtyEl.value = ''; unitEl.value = ''; nameEl.focus();
    };
    btn.addEventListener('click', doAdd);
    nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  }

  return li;
}

async function addPanelItem(name, qty, unit, listId, container, formLi, note = null) {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from('shopping_items')
    .insert([{
      list_id: listId,
      user_id: currentUser.id,
      name, amount: qty || null, unit: unit || null,
      note: note || null,
      category: guessCategory(name), is_checked: false,
    }])
    .select().single();

  if (error) { showToast('Помилка', 'error'); return; }

  // Видаляємо плашку "порожньо" якщо є
  container.querySelector('.shop-list-item__sub-empty')?.remove();
  // Вставляємо перед формою
  container.insertBefore(buildPanelSubItem(data, listId, container), formLi);
}

async function deletePanelItem(id, liEl, container) {
  const { error } = await supabase
    .from('shopping_items').delete()
    .eq('id', id).eq('user_id', currentUser.id);

  if (error) { showToast('Помилка', 'error'); return; }
  liEl.remove();

  // Якщо більше немає позицій — показати "порожньо"
  const hasItems = container.querySelectorAll('.shop-list-item__sub-item').length > 0;
  if (!hasItems) {
    const empty = document.createElement('li');
    empty.className = 'shop-list-item__sub-empty';
    empty.textContent = 'Список порожній';
    container.prepend(empty);
  }
}

async function copyToActiveList(item) {
  if (!mainListId) return;

  const existing = activeItems.find(i =>
    i.name.toLowerCase() === item.name.toLowerCase() &&
    (i.unit || '') === (item.unit || '') && !i.is_checked
  );

  if (existing) {
    const newAmt = (parseFloat(existing.amount) || 0) + (parseFloat(item.amount) || 0);
    await updateItemAmount(existing.id, newAmt || null);
    showToast(`"${item.name}" оновлено`);
    return;
  }

  const { data, error } = await supabase
    .from('shopping_items')
    .insert([{
      list_id: mainListId, user_id: currentUser.id,
      name: item.name, amount: item.amount || null,
      unit: item.unit || null, category: item.category || guessCategory(item.name),
      is_checked: false,
    }])
    .select().single();

  if (error) { showToast('Помилка', 'error'); return; }

  activeItems.push(data);
  renderActiveList();
  renderProgress();
  showToast(`"${item.name}" додано до списку`);
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

  const cbId = `shop-cb-${item.id}`;
  // ВАЖЛИВО: <label> містить ТІЛЬКИ чекбокс + його візуал.
  // info/amount винесені на рівень <li>, бо <div> всередині <label> — невалідний HTML
  // і ламає поведінку на iOS Safari.
  li.innerHTML = `
    <label class="shop-item__check-label" for="${cbId}">
      <input type="checkbox" class="shop-item__checkbox" id="${cbId}" ${item.is_checked ? 'checked' : ''} aria-label="Куплено">
      <span class="shop-item__custom-check"></span>
    </label>
    <div class="shop-item__info">
      <span class="shop-item__name">${escapeHTML(item.name)}</span>
      ${item.note ? `<span class="shop-item__note">${escapeHTML(item.note)}</span>` : ''}
    </div>
    ${amountText ? `<span class="shop-item__amount">${escapeHTML(amountText)}</span>` : ''}
    <div class="shop-item__actions">
      <button class="shop-item__btn shop-item__btn--edit" aria-label="Редагувати">
        ${iconEdit.replace('<svg ', '<svg width="14" height="14" ')}
      </button>
      <button class="shop-item__btn shop-item__btn--delete" aria-label="Видалити">
        ${iconTrash.replace('<svg ', '<svg width="14" height="14" ')}
      </button>
    </div>
  `;

  // Один click handler на весь <li>. Без touch-подій, без ghost-кліків.
  // cursor:pointer на .shop-item (CSS) робить ВСІ діти "клікабельними" для iOS,
  // тому click event тепер файриться при тапі на будь-яке місце рядка.
  li.addEventListener('click', e => {
    if (e.target.closest('.shop-item__actions')) return;

    const cb = li.querySelector('.shop-item__checkbox');

    // Якщо клік був по label/input/custom-check — браузер уже перемкнув чекбокс.
    // Якщо по info/name/note/amount — перемикаємо вручну.
    const clickedLabel = e.target.closest('.shop-item__check-label');
    if (!clickedLabel) {
      cb.checked = !cb.checked;
    }
    toggleItem(item.id, cb.checked);
  });

  li.querySelector('.shop-item__btn--edit').addEventListener('click', e => {
    e.stopPropagation();
    openEditModal(item, null);
  });
  li.querySelector('.shop-item__btn--delete').addEventListener('click', e => {
    e.stopPropagation();
    deleteItem(item.id);
  });

  return li;
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
   CRUD — АКТИВНИЙ СПИСОК
   ============================================================ */

async function addItem(name, amount, unit) {
  if (!currentUser) { showToast('Увійдіть в акаунт', 'error'); return; }
  if (!mainListId)  { showToast('Помилка ініціалізації', 'error'); return; }

  // Сумуємо якщо та сама назва + одиниця
  const existing = activeItems.find(i =>
    i.name.toLowerCase() === name.toLowerCase() &&
    (i.unit || '').toLowerCase() === (unit || '').toLowerCase() &&
    !i.is_checked
  );

  if (existing && amount) {
    const newAmt = (parseFloat(existing.amount) || 0) + amount;
    await updateItemAmount(existing.id, newAmt);
    return;
  }

  const { data, error } = await supabase
    .from('shopping_items')
    .insert([{
      list_id: mainListId, user_id: currentUser.id,
      name, amount: amount || null, unit: unit || null,
      category: guessCategory(name), is_checked: false,
    }])
    .select().single();

  if (error) { showToast('Помилка додавання', 'error'); return; }
  activeItems.push(data);
  renderActiveList();
  renderProgress();
}

async function updateItemAmount(id, newAmount) {
  const { error } = await supabase
    .from('shopping_items').update({ amount: newAmount })
    .eq('id', id).eq('user_id', currentUser.id);
  if (error) { showToast('Помилка', 'error'); return; }
  const item = activeItems.find(i => i.id === id);
  if (item) item.amount = newAmount;
  renderActiveList();
  renderProgress();
}

async function toggleItem(id, isChecked) {
  const { error } = await supabase
    .from('shopping_items').update({ is_checked: isChecked })
    .eq('id', id).eq('user_id', currentUser.id);
  if (error) { showToast('Помилка', 'error'); return; }
  const item = activeItems.find(i => i.id === id);
  if (item) item.is_checked = isChecked;
  const li = activeListEl.querySelector(`[data-id="${id}"]`);
  if (li) li.classList.toggle('shop-item--checked', isChecked);
  renderProgress();
}

async function deleteItem(id) {
  const { error } = await supabase
    .from('shopping_items').delete()
    .eq('id', id).eq('user_id', currentUser.id);
  if (error) { showToast('Помилка', 'error'); return; }
  activeItems = activeItems.filter(i => i.id !== id);
  renderActiveList();
  renderProgress();
}

async function clearCheckedItems() {
  const ids = activeItems.filter(i => i.is_checked).map(i => i.id);
  if (!ids.length) { showToast('Немає куплених позицій', 'info'); return; }
  const { error } = await supabase
    .from('shopping_items').delete().in('id', ids).eq('user_id', currentUser.id);
  if (error) { showToast('Помилка', 'error'); return; }
  activeItems = activeItems.filter(i => !i.is_checked);
  renderActiveList();
  renderProgress();
  showToast(`Видалено ${ids.length} куплених позицій`);
}

/* ============================================================
   CRUD — СПИСКИ (права панель)
   ============================================================ */

async function createList(name, type) {
  if (!currentUser || !name.trim()) { showToast('Введіть назву', 'error'); return; }
  const { data, error } = await supabase
    .from('shopping_lists')
    .insert([{ user_id: currentUser.id, name: name.trim(), type }])
    .select().single();
  if (error) { showToast('Помилка створення', 'error'); return; }
  allLists.push(data);
  if (type === 'wishlist') renderWishlistPanel();
  else renderLists();
  showToast(`"${data.name}" створено`);
}

async function pinListById(id, isPinned) {
  const { error } = await supabase
    .from('shopping_lists').update({ is_pinned: isPinned })
    .eq('id', id).eq('user_id', currentUser.id);
  if (error) { showToast('Помилка', 'error'); return; }
  const l = allLists.find(l => l.id === id);
  if (l) l.is_pinned = isPinned;
  renderLists();
  renderWishlistPanel();
  showToast(isPinned ? 'Закріплено' : 'Відкріплено');
}

async function clearListById(id) {
  showConfirmModal({
    title: 'Очистити список?',
    message: 'Всі позиції зі списку буде видалено.',
    confirmText: 'Так, очистити',
    onConfirm: async () => {
      const { error } = await supabase
        .from('shopping_items').delete()
        .eq('list_id', id).eq('user_id', currentUser.id);
      if (error) { showToast('Помилка', 'error'); return; }
      if (panelOpenId === id) {
        const li = document.querySelector(`.shop-list-item[data-id="${id}"]`);
        const sub = li?.querySelector('.shop-list-item__sub-items');
        if (sub) await loadPanelListItems(id, sub);
      }
      showToast('Список очищено');
    },
  });
}

async function deleteListById(id) {
  showConfirmModal({
    title: 'Видалити список?',
    message: 'Цю дію неможливо скасувати.',
    confirmText: 'Так, видалити',
    onConfirm: async () => {
      const { error } = await supabase
        .from('shopping_lists').delete()
        .eq('id', id).eq('user_id', currentUser.id);
      if (error) { showToast('Помилка', 'error'); return; }
      allLists = allLists.filter(l => l.id !== id);
      if (panelOpenId === id) panelOpenId = null;
      renderLists();
      renderWishlistPanel();
      showToast('Список видалено');
    },
  });
}

async function shareListById(id) {
  const list = allLists.find(l => l.id === id);
  const token = list?.share_token;
  if (!token) { showToast('Помилка посилання', 'error'); return; }
  const url = buildShareUrl(token);
  if (navigator.share) {
    try { await navigator.share({ title: list.name, url }); } catch { }
  } else {
    await navigator.clipboard.writeText(url);
    showToast('Посилання скопійовано ✓');
  }
}

/* ============================================================
   РЕДАГУВАННЯ МОДАЛКА (активний список + панельні списки)
   ============================================================ */

const editModal   = document.getElementById('shop-edit-modal');
const editName    = document.getElementById('shop-edit-name');
const editQty     = document.getElementById('shop-edit-qty');
const editUnit    = document.getElementById('shop-edit-unit');
const editNote    = document.getElementById('shop-edit-note');
const editQtyRow  = document.getElementById('shop-edit-qty-row');

function openEditModal(item, panelCtx = null) {
  editingItemId   = item.id;
  editingPanelCtx = panelCtx;
  editName.value  = item.name;
  editQty.value   = item.amount || '';
  editUnit.value  = item.unit  || '';
  editNote.value  = item.note  || '';

  const isWishlist = panelCtx
    ? allLists.find(l => l.id === panelCtx.listId)?.type === 'wishlist'
    : false;
  editQtyRow.style.display = isWishlist ? 'none' : '';

  editModal.classList.add('is-active');
  lockScroll('shopping-edit-modal');
  editName.focus();
}

function closeEditModal() {
  editModal.classList.remove('is-active');
  unlockScroll('shopping-edit-modal');
  editingItemId = null;
  editingPanelCtx = null;
}

async function saveEdit() {
  if (!editingItemId) return;
  const name   = editName.value.trim();
  const amount = parseFloat(editQty.value) || null;
  const unit   = editUnit.value.trim() || null;
  if (!name) { showToast('Введіть назву', 'error'); return; }

  const note = editNote.value.trim() || null;

  const { error } = await supabase
    .from('shopping_items').update({ name, amount, unit, note })
    .eq('id', editingItemId).eq('user_id', currentUser.id);
  if (error) { showToast('Помилка', 'error'); return; }

  if (editingPanelCtx) {
    const { listId, container } = editingPanelCtx;
    await loadPanelListItems(listId, container);
  } else {
    const item = activeItems.find(i => i.id === editingItemId);
    if (item) { item.name = name; item.amount = amount; item.unit = unit; item.note = note; }
    renderActiveList();
  }

  closeEditModal();
}

/* ============================================================
   ІМПОРТ З ТИЖНЕВОГО МЕНЮ
   ============================================================ */

function checkWeekMenuImport() {
  const items = getWeekShoppingList();
  if (items?.length > 0) importBannerEl.hidden = false;
}

async function importFromWeekMenu() {
  if (!mainListId) return;
  const items = getWeekShoppingList();
  if (!items?.length) return;

  const rows = items.map(i => ({
    list_id: mainListId, user_id: currentUser.id,
    name: i.name, amount: i.amount || null,
    unit: i.unit || null, category: i.category || 'Інше', is_checked: false,
  }));

  const { error } = await supabase.from('shopping_items').insert(rows);
  if (error) { showToast('Помилка імпорту', 'error'); return; }
  clearWeekShoppingList();
  importBannerEl.hidden = true;
  showToast(`Імпортовано ${rows.length} продуктів ✓`);
  await loadActiveItems();
}

/* ============================================================
   REALTIME — синхронізація з поділеним списком
   ============================================================ */

function subscribeToMainList() {
  if (!mainListId) return;
  supabase
    .channel(`list-${mainListId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'shopping_items',
      filter: `list_id=eq.${mainListId}`,
    }, handleRealtimeEvent)
    .subscribe();
}

function startPolling() {
  setInterval(syncActiveItems, 5000);
}

async function syncActiveItems() {
  if (!mainListId || !currentUser) return;
  const { data } = await supabase
    .from('shopping_items').select('*')
    .eq('list_id', mainListId).eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });
  if (!data) return;

  let changed = false;
  data.forEach(newItem => {
    const existing = activeItems.find(i => i.id === newItem.id);
    if (!existing) {
      activeItems.push(newItem);
      changed = true;
    } else if (existing.is_checked !== newItem.is_checked) {
      existing.is_checked = newItem.is_checked;
      changed = true;
    }
  });
  const before = activeItems.length;
  activeItems = activeItems.filter(i => data.some(d => d.id === i.id));
  if (activeItems.length !== before) changed = true;

  if (changed) { renderActiveList(); renderProgress(); }
}

function handleRealtimeEvent(payload) {
  if (payload.eventType === 'INSERT') {
    if (!activeItems.some(i => i.id === payload.new.id)) {
      activeItems.push(payload.new);
      renderActiveList();
      renderProgress();
      requestAnimationFrame(() => {
        activeListEl.querySelector(`[data-id="${payload.new.id}"]`)
          ?.classList.add('shop-item--new');
      });
    }
  } else if (payload.eventType === 'UPDATE') {
    const item = activeItems.find(i => i.id === payload.new.id);
    if (item && item.is_checked !== payload.new.is_checked) {
      item.is_checked = payload.new.is_checked;
      const li = activeListEl.querySelector(`[data-id="${item.id}"]`);
      if (li) {
        li.classList.toggle('shop-item--checked', item.is_checked);
        const cb = li.querySelector('.shop-item__checkbox');
        if (cb) cb.checked = item.is_checked;
      }
      renderProgress();
    }
  } else if (payload.eventType === 'DELETE') {
    const before = activeItems.length;
    activeItems = activeItems.filter(i => i.id !== payload.old.id);
    if (activeItems.length !== before) {
      renderActiveList();
      renderProgress();
    }
  }
}

/* ============================================================
   ДРУК / ПОДІЛИТИСЯ
   ============================================================ */

function buildShareUrl(token) {
  const base = location.href.split('?')[0].replace(/[^/]+$/, '');
  return `${base}shared-list.html?token=${token}`;
}

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
      html += `<li>${i.name}${i.amount ? ' — ' + i.amount + (i.unit ? ' ' + i.unit : '') : ''}</li>`;
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
  const list = allLists.find(l => l.id === mainListId);
  const token = list?.share_token;
  if (!token) { showToast('Помилка посилання', 'error'); return; }
  const url = buildShareUrl(token);
  if (navigator.share) {
    try { await navigator.share({ title: list.name || 'Список покупок', url }); } catch { }
  } else {
    await navigator.clipboard.writeText(url);
    showToast('Посилання скопійовано ✓');
  }
}

/* ============================================================
   ПОДІЇ
   ============================================================ */

function bindEvents() {
  // Форма додавання
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

  document.getElementById('shop-clear-checked-btn').addEventListener('click', clearCheckedItems);
  document.getElementById('shop-print-btn').addEventListener('click', printList);
  document.getElementById('shop-share-btn').addEventListener('click', shareList);

  document.getElementById('shop-import-confirm').addEventListener('click', importFromWeekMenu);
  document.getElementById('shop-import-dismiss').addEventListener('click', () => {
    importBannerEl.hidden = true;
    clearWeekShoppingList();
  });

  // Редагування модалка
  document.getElementById('shop-edit-close').addEventListener('click', closeEditModal);
  document.getElementById('shop-edit-cancel').addEventListener('click', closeEditModal);
  document.getElementById('shop-edit-save').addEventListener('click', saveEdit);
  editModal.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });

  // Новий вішліст
  const wlInput = document.getElementById('new-wishlist-input');
  const wlBtn   = document.getElementById('new-wishlist-btn');
  if (wlBtn) wlBtn.addEventListener('click', async () => {
    const name = wlInput.value.trim();
    if (!name) return;
    await createList(name, 'wishlist');
    wlInput.value = '';
  });
  if (wlInput) wlInput.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    const name = e.target.value.trim();
    if (!name) return;
    await createList(name, 'wishlist');
    e.target.value = '';
  });

  // "+ Новий список"
  document.getElementById('newlist-create-btn').addEventListener('click', async () => {
    const name = document.getElementById('newlist-name-input').value.trim();
    const type = document.querySelector('input[name="list-type"]:checked')?.value || 'shopping';
    if (!name) { showToast('Введіть назву', 'error'); return; }
    await createList(name, type);
    document.getElementById('newlist-name-input').value = '';
    const body = document.getElementById('panel-new-list-body');
    const tog  = document.querySelector('[data-panel="new-list"]');
    body.classList.remove('is-open');
    tog.classList.remove('is-open');
  });

  // Акордеони
  document.querySelectorAll('.shop-panel__toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      const body  = document.getElementById(`panel-${panel}-body`);
      const open  = btn.classList.contains('is-open');
      btn.classList.toggle('is-open', !open);
      body.classList.toggle('is-open', !open);
    });
  });

  // Radio type highlight
  document.querySelectorAll('.shop-newlist__type input[type="radio"]').forEach(r => {
    r.addEventListener('change', () => {
      document.querySelectorAll('.shop-newlist__type').forEach(el =>
        el.classList.remove('shop-newlist__type--active'));
      r.closest('.shop-newlist__type').classList.add('shop-newlist__type--active');
    });
  });
}

/* ============================================================
   УТИЛІТИ
   ============================================================ */

const CATEGORY_RULES = [
  {
    name: 'Овочі та фрукти',
    words: [
      // UA
      'помідор', 'томат', 'огір', 'морква', 'цибуля', 'часник', 'картопл', 'капуст',
      'перець', 'баклажан', 'кабачок', 'гарбуз', 'буряк', 'редиск', 'салат', 'шпинат',
      'петрушк', 'кріп', 'селера', 'броколі', 'цвітна', 'зелень', 'зелений',
      'яблук', 'груш', 'банан', 'апельсин', 'мандарин', 'лимон', 'грейпфрут', 'виноград',
      'полуниц', 'черешн', 'вишн', 'слив', 'персик', 'абрикос', 'нектарин',
      'кавун', 'диня', 'ківі', 'манго', 'ананас', 'авокадо', 'гриб', 'шампіньон',
      // EN
      'tomato', 'cucumber', 'carrot', 'onion', 'garlic', 'potato', 'cabbage',
      'pepper', 'eggplant', 'zucchini', 'pumpkin', 'beetroot', 'radish', 'lettuce',
      'spinach', 'parsley', 'dill', 'celery', 'broccoli', 'cauliflower', 'mushroom',
      'apple', 'pear', 'banana', 'orange', 'tangerine', 'lemon', 'grapefruit', 'grape',
      'strawberry', 'cherry', 'plum', 'peach', 'apricot', 'nectarine',
      'watermelon', 'melon', 'kiwi', 'mango', 'pineapple', 'avocado',
      // PL
      'pomidor', 'ogórek', 'marchew', 'cebula', 'czosnek', 'ziemniak', 'kapusta',
      'papryka', 'bakłażan', 'cukinia', 'dynia', 'burak', 'rzodkiew', 'sałata',
      'szpinak', 'pietruszka', 'koper', 'seler', 'brokuł', 'kalafior', 'grzyb', 'pieczarka',
      'jabłko', 'gruszka', 'banan', 'pomarańcza', 'mandarynka', 'cytryna', 'winogrono',
      'truskawka', 'czereśnia', 'wiśnia', 'śliwka', 'brzoskwinia', 'morela', 'nektaryna',
      'arbuz', 'melon', 'kiwi', 'mango', 'ananas', 'awokado',
    ],
  },
  {
    name: 'М\'ясо та риба',
    words: [
      // UA
      'курк', 'курич', 'свинин', 'яловичин', 'баранин', 'індич', 'качк', 'кролик',
      'фарш', 'стейк', 'відбивн', 'котлет', 'шашлик', 'печінк', 'нирк',
      'ковбас', 'сосиск', 'шинка', 'бекон', 'буженин', 'карбонад', 'паштет',
      'риба', 'лосось', 'сьомга', 'тунець', 'оселедець', 'скумбрія', 'мінтай',
      'карп', 'судак', 'форель', 'креветк', 'кальмар', 'краб', 'мідії', 'кета',
      // EN
      'chicken', 'pork', 'beef', 'lamb', 'turkey', 'duck', 'rabbit',
      'mince', 'minced', 'steak', 'chop', 'cutlet', 'liver', 'kidney',
      'sausage', 'ham', 'bacon', 'salami', 'pepperoni', 'pate',
      'fish', 'salmon', 'tuna', 'herring', 'mackerel', 'cod', 'trout',
      'carp', 'shrimp', 'prawn', 'squid', 'crab', 'mussel',
      // PL
      'kurczak', 'wieprzowina', 'wołowina', 'baranina', 'indyk', 'kaczka', 'królik',
      'mielone', 'stek', 'kotlet', 'wątróbka',
      'kiełbas', 'szynka', 'boczek', 'pasztet', 'kabanos',
      'ryba', 'łosoś', 'tuńczyk', 'śledź', 'makrela', 'dorsz', 'pstrąg',
      'karp', 'krewetk', 'kalmary', 'małże',
    ],
  },
  {
    name: 'Молочні продукти',
    words: [
      // UA
      'молоко', 'кефір', 'йогурт', 'сметан', 'вершк', 'ряжанк', 'простокваш',
      'сир', 'творог', 'творожок', 'рикотт', 'моцарел', 'пармезан', 'бринз',
      'яйц', 'яйко',
      // EN
      'milk', 'kefir', 'yogurt', 'yoghurt', 'sour cream', 'cream', 'buttermilk',
      'cheese', 'cottage cheese', 'ricotta', 'mozzarella', 'parmesan', 'cheddar',
      'butter', 'egg', 'eggs',
      // PL
      'mleko', 'kefir', 'jogurt', 'śmietana', 'śmietank', 'maślanka',
      'ser', 'twaróg', 'ricotta', 'mozzarella', 'parmezan',
      'masło', 'jajk', 'jajc',
    ],
  },
  {
    name: 'Хліб та випічка',
    words: [
      // UA
      'хліб', 'батон', 'булочк', 'багет', 'піта', 'лаваш', 'круасан', 'рогалик',
      'торт', 'тістечк', 'кекс', 'мафін', 'пиріг', 'пиріжок', 'рулет', 'штрудель',
      // EN
      'bread', 'loaf', 'bun', 'baguette', 'pita', 'croissant', 'roll',
      'cake', 'pastry', 'muffin', 'pie', 'strudel', 'bagel', 'toast',
      // PL
      'chleb', 'bułka', 'bagietka', 'pita', 'croissant', 'rogal',
      'tort', 'ciasto', 'muffin', 'pączek', 'drożdżówk',
    ],
  },
  {
    name: 'Крупи та макарони',
    words: [
      // UA
      'рис', 'гречк', 'вівсянк', 'вівсяні', 'манк', 'пшоно', 'перловк', 'булгур',
      'кускус', 'полента', 'крупа', 'пластівц',
      'макарон', 'спагет', 'феттучін', 'пенне', 'лазань', 'лапш',
      'борошно', 'крохмал',
      // EN
      'rice', 'buckwheat', 'oat', 'oatmeal', 'semolina', 'millet', 'barley', 'bulgur',
      'couscous', 'polenta', 'cereal', 'flakes', 'groat',
      'pasta', 'spaghetti', 'fettuccine', 'penne', 'lasagna', 'noodle',
      'flour', 'starch',
      // PL
      'ryż', 'kasza', 'gryczana', 'owsian', 'płatki', 'manna', 'proso', 'bulgur',
      'kuskus', 'polenta',
      'makaron', 'spaghetti', 'penne', 'lasagne',
      'mąka', 'skrobia',
    ],
  },
  {
    name: 'Консерви та соуси',
    words: [
      // UA
      'консерв', 'тушонк', 'кетчуп', 'майонез', 'гірчиц', 'соус', 'томатна паст',
      'аджик', 'хрін', 'оцет', 'соєвий',
      'оливк', 'корнішон', 'квасол', 'нут', 'сочевиц', 'боби',
      // EN
      'canned', 'tinned', 'ketchup', 'mayonnaise', 'mustard', 'sauce', 'tomato paste',
      'adjika', 'horseradish', 'vinegar', 'soy sauce',
      'olive', 'gherkin', 'pickle', 'bean', 'chickpea', 'lentil',
      // PL
      'konserw', 'ketchup', 'majonez', 'musztarda', 'sos', 'passata', 'koncentrat',
      'chrzan', 'ocet', 'oliwki', 'korniszon', 'fasola', 'ciecierzyca', 'soczewica',
    ],
  },
  {
    name: 'Напої',
    words: [
      // UA
      'вода', 'мінеральна', 'сік', 'нектар', 'компот', 'морс', 'лимонад', 'кола',
      'спрайт', 'фанта', 'пепсі', 'енергетик',
      'чай', 'кава', 'какао', 'цикорій',
      'пиво', 'вино', 'шампанськ', 'коньяк', 'горілк', 'ром', 'віскі',
      // EN
      'water', 'mineral', 'juice', 'nectar', 'lemonade', 'cola', 'sprite', 'fanta',
      'pepsi', 'energy drink', 'tea', 'coffee', 'cocoa',
      'beer', 'wine', 'champagne', 'cognac', 'vodka', 'rum', 'whisky', 'whiskey',
      // PL
      'woda', 'mineralna', 'sok', 'nektar', 'lemoniada', 'cola', 'napój', 'energetyk',
      'herbata', 'kawa', 'kakao',
      'piwo', 'wino', 'szampan', 'koniak', 'wódka', 'rum', 'whisky',
    ],
  },
  {
    name: 'Заморожені продукти',
    words: [
      // UA
      'замороже', 'пельмен', 'вареник', 'млинц', 'налисник', 'морозив',
      // EN
      'frozen', 'ice cream', 'gelato', 'sorbet', 'dumpling',
      // PL
      'mrożon', 'lody', 'pierogi mrożone', 'kopytka',
    ],
  },
  {
    name: 'Солодощі та снеки',
    words: [
      // UA
      'цукерк', 'шоколад', 'мармелад', 'зефір', 'халва', 'карамель', 'льодяник',
      'чіпс', 'сухарик', 'поп-корн', 'попкорн', 'крекер', 'вафл',
      'горіх', 'горішк', 'оріш', 'мигдаль', 'фундук', 'кешью', 'арахіс', 'фісташк', 'насіння',
      'мед', 'варення', 'джем', 'повидло', 'нутелл', 'цукор',
      // EN
      'candy', 'chocolate', 'marshmallow', 'caramel', 'lollipop', 'halva',
      'chip', 'crisp', 'popcorn', 'cracker', 'wafer', 'waffle',
      'nut', 'almond', 'hazelnut', 'cashew', 'peanut', 'pistachio', 'seed',
      'honey', 'jam', 'jelly', 'nutella', 'sugar',
      // PL
      'cukierek', 'czekolada', 'żelki', 'pianka', 'karmel', 'lizak',
      'chipsy', 'chrupki', 'popcorn', 'krakersy', 'wafelek',
      'orzech', 'migdał', 'orzechy', 'pestki', 'słonecznik',
      'miód', 'dżem', 'marmolada', 'nutella', 'cukier',
    ],
  },
  {
    name: 'Спеції та олія',
    words: [
      // UA
      'сіль', 'паприк', 'куркум', 'кориц', 'ванілін', 'ваніль', 'мускатн',
      'кардамон', 'лавров', 'приправ', 'спеці', 'базилік', 'орегано', 'розмарин',
      'олія', 'соняшников',
      // EN
      'salt', 'paprika', 'turmeric', 'cinnamon', 'vanilla', 'nutmeg',
      'cardamom', 'bay leaf', 'spice', 'seasoning', 'basil', 'oregano', 'rosemary',
      'thyme', 'cumin', 'ginger', 'clove',
      'oil', 'olive oil', 'sunflower oil', 'coconut oil',
      // PL
      'sól', 'papryka', 'kurkuma', 'cynamon', 'wanilia', 'gałka muszkatołowa',
      'kardamon', 'liść laurowy', 'przyprawa', 'zioła', 'bazylia', 'oregano', 'rozmaryn',
      'tymianek', 'kminek', 'imbir', 'goździki',
      'olej', 'oliwa',
    ],
  },
  {
    name: 'Гігієна та побутова хімія',
    words: [
      // UA
      'мило', 'шампунь', 'гель для душ', 'дезодорант',
      'зубна паст', 'зубна щітк', 'ополіскув',
      'туалетний папір', 'серветк', 'ватн', 'тампон', 'прокладк', 'підгузн',
      'пральн', 'порошок для', 'гель для прання', 'миючий', 'губк',
      // EN
      'soap', 'shampoo', 'shower gel', 'deodorant', 'conditioner',
      'toothpaste', 'toothbrush', 'mouthwash', 'floss',
      'toilet paper', 'tissue', 'cotton', 'tampon', 'pad', 'diaper', 'nappy',
      'detergent', 'washing powder', 'fabric softener', 'dishwasher', 'sponge',
      'bleach', 'cleaner', 'disinfect',
      // PL
      'mydło', 'szampon', 'żel pod prysznic', 'dezodorant', 'odżywka',
      'pasta do zębów', 'szczoteczka', 'płyn do płukania',
      'papier toaletowy', 'chusteczk', 'wacik', 'tampon', 'podpaska', 'pieluch',
      'proszek do prania', 'płyn do prania', 'płukacz', 'gąbka', 'ścierka',
      'wybielacz', 'płyn do naczyń', 'tabletki do zmywark',
    ],
  },
];

function guessCategory(name) {
  const lower = name.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some(w => lower.includes(w))) return rule.name;
  }
  return 'Інше';
}
