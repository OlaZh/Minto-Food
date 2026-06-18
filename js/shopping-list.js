/* ============================================================
   shopping-list.js
   Центр: активний список (завжди).
   Права панель: шаблони розкриваються в собі,
   товари переносяться до центру кнопкою "→ Додати".
   ============================================================ */

import { supabase } from './supabaseClient.js';
import { initAuth } from './auth.js';
import { showToast, escapeHTML } from './utils.js';
import { t } from './i18n-apply.js';
import { lockScroll, unlockScroll } from './scroll-lock.js';
import { getWeekShoppingList, clearWeekShoppingList } from './storage.js';
import { normalizeKey } from './parse-food.js';
import { iconLock, iconPin, iconMoreVertical, iconChevronRight, iconEdit, iconTrash, iconLink, iconBroom } from './icons.js';
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
    subscribeToMainList(); // polling вмикається сам як fallback, якщо realtime відвалиться
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
      `<li class="shop-list-item__sub-empty" style="padding:4px 2px">${t('shopWishlistEmpty')}</li>`;
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
    ? t('shopPermanentMeta')
    : formatListMeta(list);

  const dotsMenu = !isPermanent ? `
    <button class="shop-list-item__dots-btn" aria-label="${t('shopListMenu')}">
      ${iconMoreVertical.replace('<svg ', '<svg width="14" height="14" ')}
    </button>
    <div class="shop-list-item__dropdown" hidden>
      ${list.is_pinned
        ? `<button data-action="unpin">${iconPin} ${t('shopUnpin')}</button>`
        : `<button data-action="pin">${iconPin} ${t('shopPin')}</button>`}
      <button data-action="share">${iconLink} ${t('shopShare')}</button>
      <button data-action="clear">${iconBroom} ${t('shopClearList')}</button>
      <button data-action="delete">${iconTrash} ${t('shopDeleteList')}</button>
    </div>` : '';

  li.innerHTML = `
    <div class="shop-list-item__header">
      <div class="shop-list-item__left">
        <p class="shop-list-item__name">${lockIcon}${pinBadge}${escapeHTML(localizeListName(list.name))}</p>
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
  if (list.is_shared) parts.push(t('shopShared'));
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
    `<li class="shop-list-item__sub-empty">${t('loading')}</li>`;

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
    empty.textContent = t('shopEmptyTitle');
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
    <button class="shop-list-item__sub-add" title="${t('shopAddToActive')}">→</button>
    <button class="shop-list-item__sub-btn shop-list-item__sub-btn--edit" aria-label="${t('shopEditItem')}">
      ${iconEdit.replace('<svg ', '<svg width="12" height="12" ')}
    </button>
    <button class="shop-list-item__sub-btn shop-list-item__sub-btn--delete" aria-label="${t('delete')}">
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
      <input type="text" class="shop-panel-item-add__input" placeholder="${t('shopNamePlaceholder')}" />
      <div class="shop-panel-item-add__row">
        <input type="text" class="shop-panel-item-add__note" placeholder="${t('shopNoteInputPlaceholder')}" />
        <button class="shop-panel-item-add__btn" aria-label="${t('add')}">+</button>
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
      <input type="text" class="shop-panel-item-add__input" placeholder="${t('shopNamePlaceholder')}" />
      <div class="shop-panel-item-add__row">
        <input type="number" class="shop-panel-item-add__qty"  placeholder="${t('shopQtyPlaceholder')}" min="0" step="any" />
        <input type="text"   class="shop-panel-item-add__unit" placeholder="${t('shopUnitShortPlaceholder')}" maxlength="8" />
        <button class="shop-panel-item-add__btn" aria-label="${t('add')}">+</button>
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
      category: await lookupCategory(name), is_checked: false,
    }])
    .select().single();

  if (error) { showToast(t('shopErr'), 'error'); return; }

  // Видаляємо плашку "порожньо" якщо є
  container.querySelector('.shop-list-item__sub-empty')?.remove();
  // Вставляємо перед формою
  container.insertBefore(buildPanelSubItem(data, listId, container), formLi);
}

async function deletePanelItem(id, liEl, container) {
  const { error } = await supabase
    .from('shopping_items').delete()
    .eq('id', id).eq('user_id', currentUser.id);

  if (error) { showToast(t('shopErr'), 'error'); return; }
  liEl.remove();

  // Якщо більше немає позицій — показати "порожньо"
  const hasItems = container.querySelectorAll('.shop-list-item__sub-item').length > 0;
  if (!hasItems) {
    const empty = document.createElement('li');
    empty.className = 'shop-list-item__sub-empty';
    empty.textContent = t('shopEmptyTitle');
    container.prepend(empty);
  }
}

async function copyToActiveList(item) {
  if (!mainListId) return;

  // Канонізуємо назву (як в addItem), щоб копія з шаблону зливалася з
  // наявним продуктом навіть за іншого написання.
  const { canonicalName, category } = await resolveProduct(item.name);
  const finalName = canonicalName || item.name;

  if (!canonicalName) logUnmatched(item.name);

  const existing = activeItems.find(i =>
    i.name.toLowerCase() === finalName.toLowerCase() &&
    (i.unit || '') === (item.unit || '') && !i.is_checked
  );

  if (existing) {
    const newAmt = (parseFloat(existing.amount) || 0) + (parseFloat(item.amount) || 0);
    await updateItemAmount(existing.id, newAmt || null);
    showToast(`"${finalName}" ${t('shopUpdatedSuffix')}`);
    return;
  }

  const { data, error } = await supabase
    .from('shopping_items')
    .insert([{
      list_id: mainListId, user_id: currentUser.id,
      name: finalName, amount: item.amount || null,
      unit: item.unit || null, category: item.category || category,
      is_checked: false,
    }])
    .select().single();

  if (error) { showToast(t('shopErr'), 'error'); return; }

  activeItems.push(data);
  renderActiveList();
  renderProgress();
  showToast(`"${finalName}" ${t('shopAddedSuffix')}`);
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

  // Стабільний порядок секцій (як топ-категорії БД + хім./Інше в кінці).
  const sortedGroups = Object.entries(groups).sort(
    ([a], [b]) => categoryOrderIndex(a) - categoryOrderIndex(b)
  );

  sortedGroups.forEach(([category, items]) => {
    const section = document.createElement('div');
    section.className = 'shop-category';
    section.innerHTML = `
      <h3 class="shop-category__title">${escapeHTML(localizeCategory(category))}</h3>
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
      <input type="checkbox" class="shop-item__checkbox" id="${cbId}" ${item.is_checked ? 'checked' : ''} aria-label="${t('shopBoughtAria')}">
      <span class="shop-item__custom-check"></span>
    </label>
    <div class="shop-item__info">
      <span class="shop-item__name">${escapeHTML(item.name)}</span>
      ${item.note ? `<span class="shop-item__note">${escapeHTML(item.note)}</span>` : ''}
    </div>
    ${amountText ? `<span class="shop-item__amount">${escapeHTML(amountText)}</span>` : ''}
    <div class="shop-item__actions">
      <button class="shop-item__btn shop-item__btn--edit" aria-label="${t('shopEditItem')}">
        ${iconEdit.replace('<svg ', '<svg width="14" height="14" ')}
      </button>
      <button class="shop-item__btn shop-item__btn--delete" aria-label="${t('delete')}">
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

  if (countLabelEl)   countLabelEl.textContent = total > 0 ? `${checked} ${t('shopOfCount')} ${total} ${t('shopBoughtSuffix')}` : '';
  if (progressFillEl) progressFillEl.style.width = `${pct}%`;
  if (ringValueEl)    ringValueEl.textContent = `${checked}/${total}`;
  if (ringPathEl)     ringPathEl.setAttribute('stroke-dasharray', `${pct}, 100`);
}

/* ============================================================
   CRUD — АКТИВНИЙ СПИСОК
   ============================================================ */

async function addItem(name, amount, unit) {
  if (!currentUser) { showToast(t('signInRequired'), 'error'); return; }
  if (!mainListId)  { showToast(t('shopErrInit'), 'error'); return; }

  // Резолв до канонічного продукту БД: "яблоко"/"apple"/"яблуко" → "Яблуко".
  // Зберігаємо під канонічною назвою, тому однакові продукти зливаються в один
  // рядок навіть за різного написання. Невідомі продукти лишаються як введено.
  const { canonicalName, category } = await resolveProduct(name);
  const finalName = canonicalName || name;

  // Продукт невідомий БД → у чергу нерозпізнаних (популярні додам у БД).
  if (!canonicalName) logUnmatched(name);

  // Сумуємо якщо та сама (канонічна) назва + одиниця
  const existing = activeItems.find(i =>
    i.name.toLowerCase() === finalName.toLowerCase() &&
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
      name: finalName, amount: amount || null, unit: unit || null,
      category, is_checked: false,
    }])
    .select().single();

  if (error) { showToast(t('shopErrAdd'), 'error'); return; }
  activeItems.push(data);
  renderActiveList();
  renderProgress();
}

async function updateItemAmount(id, newAmount) {
  const { error } = await supabase
    .from('shopping_items').update({ amount: newAmount })
    .eq('id', id).eq('user_id', currentUser.id);
  if (error) { showToast(t('shopErr'), 'error'); return; }
  const item = activeItems.find(i => i.id === id);
  if (item) item.amount = newAmount;
  renderActiveList();
  renderProgress();
}

async function toggleItem(id, isChecked) {
  const { error } = await supabase
    .from('shopping_items').update({ is_checked: isChecked })
    .eq('id', id).eq('user_id', currentUser.id);
  if (error) { showToast(t('shopErr'), 'error'); return; }
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
  if (error) { showToast(t('shopErr'), 'error'); return; }
  activeItems = activeItems.filter(i => i.id !== id);
  renderActiveList();
  renderProgress();
}

async function clearCheckedItems() {
  const ids = activeItems.filter(i => i.is_checked).map(i => i.id);
  if (!ids.length) { showToast(t('shopNoChecked'), 'info'); return; }
  const { error } = await supabase
    .from('shopping_items').delete().in('id', ids).eq('user_id', currentUser.id);
  if (error) { showToast(t('shopErr'), 'error'); return; }
  activeItems = activeItems.filter(i => !i.is_checked);
  renderActiveList();
  renderProgress();
  showToast(`${t('shopRemovedPrefix')} ${ids.length} ${t('shopRemovedSuffix')}`);
}

/* ============================================================
   CRUD — СПИСКИ (права панель)
   ============================================================ */

async function createList(name, type) {
  if (!currentUser || !name.trim()) { showToast(t('shopEnterName'), 'error'); return; }
  const { data, error } = await supabase
    .from('shopping_lists')
    .insert([{ user_id: currentUser.id, name: name.trim(), type }])
    .select().single();
  if (error) { showToast(t('shopErrCreate'), 'error'); return; }
  allLists.push(data);
  if (type === 'wishlist') renderWishlistPanel();
  else renderLists();
  showToast(`"${data.name}" ${t('shopCreatedSuffix')}`);
}

async function pinListById(id, isPinned) {
  const { error } = await supabase
    .from('shopping_lists').update({ is_pinned: isPinned })
    .eq('id', id).eq('user_id', currentUser.id);
  if (error) { showToast(t('shopErr'), 'error'); return; }
  const l = allLists.find(l => l.id === id);
  if (l) l.is_pinned = isPinned;
  renderLists();
  renderWishlistPanel();
  showToast(isPinned ? t('shopPinned') : t('shopUnpinned'));
}

async function clearListById(id) {
  showConfirmModal({
    title: t('shopClearTitle'),
    message: t('shopClearMsg'),
    confirmText: t('shopClearYes'),
    onConfirm: async () => {
      const { error } = await supabase
        .from('shopping_items').delete()
        .eq('list_id', id).eq('user_id', currentUser.id);
      if (error) { showToast(t('shopErr'), 'error'); return; }
      if (panelOpenId === id) {
        const li = document.querySelector(`.shop-list-item[data-id="${id}"]`);
        const sub = li?.querySelector('.shop-list-item__sub-items');
        if (sub) await loadPanelListItems(id, sub);
      }
      showToast(t('shopListCleared'));
    },
  });
}

async function deleteListById(id) {
  showConfirmModal({
    title: t('shopDeleteTitle'),
    message: t('shopDeleteMsg'),
    confirmText: t('shopDeleteYes'),
    onConfirm: async () => {
      const { error } = await supabase
        .from('shopping_lists').delete()
        .eq('id', id).eq('user_id', currentUser.id);
      if (error) { showToast(t('shopErr'), 'error'); return; }
      allLists = allLists.filter(l => l.id !== id);
      if (panelOpenId === id) panelOpenId = null;
      renderLists();
      renderWishlistPanel();
      showToast(t('shopListDeleted'));
    },
  });
}

async function shareListById(id) {
  const list = allLists.find(l => l.id === id);
  const token = list?.share_token;
  if (!token) { showToast(t('shopErrLink'), 'error'); return; }
  const url = buildShareUrl(token);
  if (navigator.share) {
    try { await navigator.share({ title: localizeListName(list.name), url }); } catch { }
  } else {
    await navigator.clipboard.writeText(url);
    showToast(t('shopLinkCopied'));
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
  if (!name) { showToast(t('shopEnterName'), 'error'); return; }

  const note = editNote.value.trim() || null;

  const { error } = await supabase
    .from('shopping_items').update({ name, amount, unit, note })
    .eq('id', editingItemId).eq('user_id', currentUser.id);
  if (error) { showToast(t('shopErr'), 'error'); return; }

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
  if (error) { showToast(t('shopErrImport'), 'error'); return; }
  clearWeekShoppingList();
  importBannerEl.hidden = true;
  showToast(`${t('shopImportedPrefix')} ${rows.length} ${t('shopImportedSuffix')}`);
  await loadActiveItems();
}

/* ============================================================
   REALTIME — синхронізація з поділеним списком
   ============================================================ */

let realtimeChannel = null;
let pollTimer = null;
let lastRealtimeActivity = 0;
let realtimeWatchdog = null;

// Скільки терпимо тишу від realtime, перш ніж підстрахуватись polling-ом.
const REALTIME_SILENCE_MS = 20000;

function subscribeToMainList() {
  if (!mainListId) return;

  lastRealtimeActivity = Date.now();
  realtimeChannel = supabase
    .channel(`list-${mainListId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'shopping_items',
      filter: `list_id=eq.${mainListId}`,
    }, payload => {
      lastRealtimeActivity = Date.now();
      // Realtime живий → fallback-polling більше не потрібен.
      stopPolling();
      handleRealtimeEvent(payload);
    })
    .subscribe(status => {
      // Канал не зміг/перестав отримувати події → вмикаємо polling.
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        startPolling();
      } else if (status === 'SUBSCRIBED') {
        lastRealtimeActivity = Date.now();
      }
    });

  // Watchdog: realtime може «тихо» відвалитись уже після успішного конекту
  // (RLS/мережа), не змінивши статусу. Якщо подій нема надто довго —
  // підстраховуємось одноразовою синхронізацією + вмикаємо polling.
  if (realtimeWatchdog) clearInterval(realtimeWatchdog);
  realtimeWatchdog = setInterval(() => {
    if (!mainListId || !currentUser) return;
    if (pollTimer) return; // polling уже працює — watchdog не потрібен
    if (Date.now() - lastRealtimeActivity > REALTIME_SILENCE_MS) {
      // Тиха звірка: якщо realtime живий, вона нічого не змінить (і оновить мітку
      // лише за наявності реальних змін). Якщо ні — підхопимо розбіжності.
      syncActiveItems();
    }
  }, REALTIME_SILENCE_MS);
}

function startPolling() {
  if (pollTimer) return; // ідемпотентно: не плодимо інтервали
  pollTimer = setInterval(syncActiveItems, 5000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
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

  if (changed) {
    renderActiveList();
    renderProgress();
    // Знайшли розбіжність поза polling-ом → realtime пропускає події.
    // Вмикаємо постійний polling як надійний fallback.
    if (!pollTimer) startPolling();
  }
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
  let html = `<html><head><title>${t('navShoppingList')}</title></head><body>`;
  html += `<h1>${t('navShoppingList')}</h1>`;
  Object.entries(groups)
    .sort(([a], [b]) => categoryOrderIndex(a) - categoryOrderIndex(b))
    .forEach(([cat, items]) => {
    html += `<h2>${localizeCategory(cat)}</h2><ul>`;
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
  if (!token) { showToast(t('shopErrLink'), 'error'); return; }
  const url = buildShareUrl(token);
  if (navigator.share) {
    try { await navigator.share({ title: localizeListName(list.name) || t('navShoppingList'), url }); } catch { }
  } else {
    await navigator.clipboard.writeText(url);
    showToast(t('shopLinkCopied'));
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
    if (!name) { showToast(t('shopEnterName'), 'error'); return; }
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

// Порядок секцій у списку = топ-категорії БД (id 1..20) + хім./Інше в кінці.
const CATEGORY_ORDER = [
  'Овочі', 'Гриби', 'Зелень', 'Фрукти', 'Ягоди',
  'Молочні продукти', 'М\'ясо', 'Риба', 'Морепродукти', 'Яйця',
  'Хліб і випічка', 'Бакалія', 'Напівфабрикати', 'Готові страви',
  'Олії та жири', 'Соуси та заправки', 'Солодощі', 'Напої', 'Алкоголь',
  'Спеції та добавки', 'Гігієна та побутова хімія',
];
function categoryOrderIndex(name) {
  const i = CATEGORY_ORDER.indexOf(name);
  return i === -1 ? CATEGORY_ORDER.length : i; // невідомі/"Інше" — в кінець
}

// UA-назва категорії (= categories.name_ua у БД, канонічний ключ) → i18n-ключ.
// БД зберігає UA-назву; локалізуємо ЛИШЕ при відображенні (БД не чіпаємо).
const CATEGORY_I18N = {
  'Овочі': 'catVegetables', 'Гриби': 'catMushrooms', 'Зелень': 'catGreens',
  'Фрукти': 'catFruits', 'Ягоди': 'catBerries', 'Молочні продукти': 'catDairy',
  'М\'ясо': 'catMeat', 'Риба': 'catFish', 'Морепродукти': 'catSeafood',
  'Яйця': 'catEggs', 'Хліб і випічка': 'catBakery', 'Бакалія': 'catGroceries',
  'Напівфабрикати': 'catSemiFinished', 'Готові страви': 'catReadyMeals',
  'Олії та жири': 'catOilsFats', 'Соуси та заправки': 'catSaucesDressings',
  'Солодощі': 'catSweets', 'Напої': 'catDrinks', 'Алкоголь': 'catAlcohol',
  'Спеції та добавки': 'catSpicesAdditives', 'Гігієна та побутова хімія': 'catHygieneHousehold',
  'Інше': 'categoryOther',
};
// Назва категорії поточною мовою (фолбек — оригінальна назва, якщо ключа нема).
function localizeCategory(name) {
  const key = CATEGORY_I18N[name];
  return key ? t(key) : name;
}

// Системні назви списків зберігаються в БД UA-мовою; локалізуємо при показі.
// Користувацькі назви (не в мапі) виводимо як є.
const SYSTEM_LIST_I18N = {
  'Постійний список': 'permanentListName',
  'Список покупок': 'shoppingListName',
};
function localizeListName(name) {
  const key = SYSTEM_LIST_I18N[name];
  return key ? t(key) : name;
}

// Бакети fallback мають збігатися з топ-категоріями БД (categories.name_ua),
// щоб keyword-вгадування й БД-резолв давали ОДНАКОВІ назви груп.
// Порядок важливий: перше співпадіння виграє → специфічніші правила раніше.
const CATEGORY_RULES = [
  {
    name: 'Зелень',
    words: [
      // UA (свіжа зелень/трави; сушені — в "Спеції та добавки" нижче за БД)
      'петрушк', 'кріп', 'кінза', 'коріандр', 'базилік свіж', 'рукол', 'шпинат',
      'щавель', 'зелена цибул', 'зелень',
      // RU
      'петрушк', 'укроп', 'кинза', 'руккол', 'шпинат', 'щавель',
      // EN / PL
      'parsley', 'dill', 'cilantro', 'arugula', 'rocket', 'spinach',
      'pietruszka', 'koperek', 'kolendra', 'rukola', 'szpinak',
    ],
  },
  {
    name: 'Гриби',
    words: [
      'гриб', 'печериц', 'шампіньон', 'глив', 'лисичк', 'опен', 'білий гриб', 'трюфел',
      'грибы', 'шампиньон', 'вешенк', 'лисичк',
      'mushroom', 'champignon', 'porcini', 'chanterelle', 'truffle',
      'grzyb', 'pieczark', 'borowik',
    ],
  },
  {
    name: 'Ягоди',
    words: [
      'полуниц', 'суниц', 'малин', 'ожин', 'смородин', 'аґрус', 'агрус',
      'журавлин', 'чорниц', 'лохин', 'обліпих', 'брусниц', 'клюкв', 'годжі',
      'клубник', 'черник', 'ежевик', 'крыжовник', 'брусник', 'голубик',
      'strawberry', 'raspberry', 'blackberry', 'blueberry', 'currant', 'cranberry', 'gooseberry',
      'truskawk', 'malin', 'jagod', 'borówk', 'porzeczk', 'żurawin',
    ],
  },
  {
    name: 'Фрукти',
    words: [
      'яблук', 'груш', 'банан', 'апельсин', 'мандарин', 'лимон', 'грейпфрут', 'виноград',
      'черешн', 'вишн', 'слив', 'персик', 'абрикос', 'нектарин',
      'кавун', 'диня', 'ківі', 'манго', 'ананас', 'авокадо',
      'гранат', 'папай', 'хурма', 'інжир', 'фейхоа', 'личі', 'маракуй', 'помело', 'айв',
      // RU
      'яблок', 'апельсін', 'абрікос', 'грейпфрут', 'вишн', 'черешн', 'хурм',
      // EN
      'apple', 'pear', 'banana', 'orange', 'tangerine', 'lemon', 'grapefruit', 'grape',
      'cherry', 'plum', 'peach', 'apricot', 'nectarine',
      'watermelon', 'melon', 'kiwi', 'mango', 'pineapple', 'avocado', 'pomegranate',
      // PL
      'jabłko', 'gruszka', 'banan', 'pomarańcza', 'mandarynka', 'cytryna', 'winogrono',
      'czereśnia', 'wiśnia', 'śliwka', 'brzoskwinia', 'morela', 'nektaryna',
      'arbuz', 'melon', 'kiwi', 'mango', 'ananas', 'awokado',
    ],
  },
  {
    name: 'Овочі',
    words: [
      'помідор', 'томат', 'огір', 'морква', 'цибуля', 'часник', 'картопл', 'капуст',
      'перець', 'баклажан', 'кабачок', 'гарбуз', 'буряк', 'редиск', 'салат',
      'селера', 'броколі', 'цвітна', 'редьк', 'патисон', 'спаржа', 'кукурудз',
      // RU
      'свекл', 'огур', 'помид', 'кабачок', 'чеснок', 'тыкв', 'морков', 'картош', 'капуст',
      // EN
      'tomato', 'cucumber', 'carrot', 'onion', 'garlic', 'potato', 'cabbage',
      'pepper', 'eggplant', 'zucchini', 'pumpkin', 'beetroot', 'radish', 'lettuce',
      'celery', 'broccoli', 'cauliflower', 'asparagus', 'corn',
      // PL
      'pomidor', 'ogórek', 'marchew', 'cebula', 'czosnek', 'ziemniak', 'kapusta',
      'papryka', 'bakłażan', 'cukinia', 'dynia', 'burak', 'rzodkiew', 'sałata',
      'seler', 'brokuł', 'kalafior', 'szparag', 'kukurydz',
    ],
  },
  {
    name: 'Морепродукти',
    words: [
      'креветк', 'кальмар', 'краб', 'мідії', 'устриц', 'гребінц', 'восьминіг', 'лангустин',
      'креветк', 'кальмар', 'краб', 'мидии', 'устриц', 'осьминог',
      'shrimp', 'prawn', 'squid', 'crab', 'mussel', 'oyster', 'scallop', 'octopus', 'seafood',
      'krewetk', 'kalmary', 'małże', 'ostryg', 'ośmiornic',
    ],
  },
  {
    name: 'Риба',
    words: [
      'риба', 'лосось', 'сьомга', 'тунець', 'оселедець', 'скумбрія', 'мінтай',
      'карп', 'судак', 'форель', 'кета', 'хек', 'тріск', 'камбал', 'дорад', 'сібас', 'ікра',
      'рыба', 'лосось', 'сёмга', 'тунец', 'селёдк', 'скумбри', 'минтай', 'треск', 'икра',
      'fish', 'salmon', 'tuna', 'herring', 'mackerel', 'cod', 'trout', 'carp', 'caviar',
      'ryba', 'łosoś', 'tuńczyk', 'śledź', 'makrela', 'dorsz', 'pstrąg', 'karp', 'kawior',
    ],
  },
  {
    name: 'М\'ясо',
    words: [
      'курк', 'курич', 'свинин', 'яловичин', 'баранин', 'індич', 'качк', 'кролик',
      'фарш', 'стейк', 'відбивн', 'котлет', 'шашлик', 'печінк', 'нирк',
      'ковбас', 'сосиск', 'шинка', 'бекон', 'буженин', 'карбонад', 'паштет', 'сало',
      // RU
      'куриц', 'свинин', 'говядин', 'баранин', 'индейк', 'утк', 'кролик', 'фарш', 'колбас', 'сосиск', 'ветчин',
      // EN
      'chicken', 'pork', 'beef', 'lamb', 'turkey', 'duck', 'rabbit',
      'mince', 'minced', 'steak', 'chop', 'cutlet', 'liver', 'kidney',
      'sausage', 'ham', 'bacon', 'salami', 'pepperoni', 'pate',
      // PL
      'kurczak', 'wieprzowina', 'wołowina', 'baranina', 'indyk', 'kaczka', 'królik',
      'mielone', 'stek', 'kotlet', 'wątróbka',
      'kiełbas', 'szynka', 'boczek', 'pasztet', 'kabanos',
    ],
  },
  {
    name: 'Яйця',
    words: [
      'яйц', 'яйк', 'яєчн', 'білок яєчн', 'жовток',
      'яйц', 'яйк', 'яичн', 'желток', 'белок яичн',
      'egg', 'eggs', 'egg white', 'egg yolk',
      'jajk', 'jajc', 'jajo', 'białko jaj', 'żółtko',
    ],
  },
  {
    name: 'Молочні продукти',
    words: [
      'молоко', 'кефір', 'йогурт', 'сметан', 'вершк', 'ряжанк', 'простокваш', 'масло вершков',
      'сир', 'творог', 'творожок', 'рикотт', 'моцарел', 'пармезан', 'бринз', 'фета',
      // RU
      'молок', 'кефир', 'йогурт', 'сметан', 'сливк', 'творог', 'ряженк', 'сыр',
      // EN
      'milk', 'kefir', 'yogurt', 'yoghurt', 'sour cream', 'cream', 'buttermilk',
      'cheese', 'cottage cheese', 'ricotta', 'mozzarella', 'parmesan', 'cheddar', 'butter',
      // PL
      'mleko', 'kefir', 'jogurt', 'śmietana', 'śmietank', 'maślanka',
      'ser', 'twaróg', 'ricotta', 'mozzarella', 'parmezan', 'masło',
    ],
  },
  {
    name: 'Хліб і випічка',
    words: [
      'хліб', 'батон', 'булочк', 'багет', 'піта', 'лаваш', 'круасан', 'рогалик',
      'торт', 'тістечк', 'кекс', 'мафін', 'пиріг', 'пиріжок', 'рулет', 'штрудель', 'сухар',
      // RU
      'хлеб', 'батон', 'булочк', 'багет', 'лаваш', 'круассан', 'пирог', 'пирожок', 'кекс',
      // EN
      'bread', 'loaf', 'bun', 'baguette', 'pita', 'croissant', 'roll',
      'cake', 'pastry', 'muffin', 'pie', 'strudel', 'bagel', 'toast',
      // PL
      'chleb', 'bułka', 'bagietka', 'pita', 'croissant', 'rogal',
      'tort', 'ciasto', 'muffin', 'pączek', 'drożdżówk',
    ],
  },
  {
    name: 'Напівфабрикати',
    words: [
      'замороже', 'пельмен', 'вареник', 'млинц', 'налисник', 'голубц', 'котлети заморож', 'чебурек',
      'заморож', 'пельмен', 'вареник', 'блинчик', 'голубц',
      'frozen', 'dumpling',
      'mrożon', 'pierogi', 'kopytka',
    ],
  },
  {
    name: 'Бакалія',
    words: [
      'рис', 'гречк', 'вівсянк', 'вівсяні', 'манк', 'пшоно', 'перловк', 'булгур',
      'кускус', 'полента', 'крупа', 'пластівц', 'мюслі', 'гранол',
      'макарон', 'спагет', 'феттучін', 'пенне', 'лазань', 'лапш', 'вермішел',
      'борошно', 'крохмал', 'квасол', 'нут', 'сочевиц', 'боби', 'горох',
      'горіх', 'горішк', 'оріш', 'мигдаль', 'фундук', 'кешью', 'арахіс', 'фісташк',
      // RU
      'рис', 'гречк', 'овсян', 'пшено', 'перловк', 'крупа', 'мука', 'макарон', 'вермишел',
      'фасол', 'чечевиц', 'горох', 'орех', 'миндал', 'фундук', 'арахис',
      // EN
      'rice', 'buckwheat', 'oat', 'oatmeal', 'semolina', 'millet', 'barley', 'bulgur',
      'couscous', 'polenta', 'cereal', 'flakes', 'groat', 'muesli', 'granola',
      'pasta', 'spaghetti', 'fettuccine', 'penne', 'lasagna', 'noodle',
      'flour', 'starch', 'bean', 'chickpea', 'lentil', 'pea',
      'nut', 'almond', 'hazelnut', 'cashew', 'peanut', 'pistachio',
      // PL
      'ryż', 'kasza', 'gryczana', 'owsian', 'płatki', 'manna', 'proso', 'bulgur',
      'kuskus', 'polenta', 'makaron', 'spaghetti', 'penne', 'lasagne',
      'mąka', 'skrobia', 'fasola', 'ciecierzyca', 'soczewica', 'groch',
      'orzech', 'migdał', 'orzeszk',
    ],
  },
  {
    name: 'Соуси та заправки',
    words: [
      'кетчуп', 'майонез', 'гірчиц', 'соус', 'томатна паст', 'аджик', 'хрін', 'оцет',
      'соєвий', 'песто', 'табаско', 'заправк', 'консерв', 'тушонк', 'оливк', 'корнішон',
      'кетчуп', 'майонез', 'горчиц', 'соус', 'аджик', 'хрен', 'уксус', 'оливк',
      'canned', 'tinned', 'ketchup', 'mayonnaise', 'mustard', 'sauce', 'tomato paste',
      'horseradish', 'vinegar', 'soy sauce', 'pesto', 'olive', 'gherkin', 'pickle',
      'konserw', 'ketchup', 'majonez', 'musztarda', 'sos', 'passata', 'koncentrat',
      'chrzan', 'ocet', 'oliwki', 'korniszon',
    ],
  },
  {
    name: 'Алкоголь',
    words: [
      'пиво', 'вино', 'шампанськ', 'коньяк', 'горілк', 'ром', 'віскі', 'лікер', 'джин', 'текіл', 'сидр', 'вермут',
      'пиво', 'вино', 'шампанск', 'коньяк', 'водк', 'ром', 'виски', 'ликёр', 'джин',
      'beer', 'wine', 'champagne', 'cognac', 'vodka', 'rum', 'whisky', 'whiskey', 'liqueur', 'gin', 'tequila', 'cider',
      'piwo', 'wino', 'szampan', 'koniak', 'wódka', 'rum', 'whisky', 'likier', 'gin',
    ],
  },
  {
    name: 'Напої',
    words: [
      'вода', 'мінеральна', 'сік', 'нектар', 'компот', 'морс', 'лимонад', 'кока-кола',
      'спрайт', 'фанта', 'пепсі', 'енергетик', 'чай', 'кава', 'какао', 'цикорій', 'смузі',
      'вода', 'минерал', 'сок', 'компот', 'лимонад', 'чай', 'кофе', 'какао',
      'water', 'mineral', 'juice', 'nectar', 'lemonade', 'coca-cola', 'sprite', 'fanta',
      'pepsi', 'energy drink', 'tea', 'coffee', 'cocoa', 'smoothie',
      'woda', 'mineralna', 'sok', 'nektar', 'lemoniada', 'coca-cola', 'napój', 'energetyk',
      'herbata', 'kawa', 'kakao',
    ],
  },
  {
    name: 'Солодощі',
    words: [
      'цукерк', 'шоколад', 'мармелад', 'зефір', 'халва', 'карамель', 'льодяник',
      'чіпс', 'сухарик', 'поп-корн', 'попкорн', 'крекер', 'вафл', 'печив', 'пряник', 'батончик',
      'мед', 'варення', 'джем', 'повидло', 'нутелл', 'морозив', 'снек', 'мармел',
      // RU
      'конфет', 'шоколад', 'печень', 'пряник', 'зефир', 'халв', 'сухар', 'мёд', 'варень', 'мороженое', 'чипс',
      // EN
      'candy', 'chocolate', 'marshmallow', 'caramel', 'lollipop', 'halva',
      'chip', 'crisp', 'popcorn', 'cracker', 'wafer', 'waffle',
      'honey', 'jam', 'jelly', 'nutella', 'ice cream', 'gelato', 'sorbet', 'snack',
      // PL
      'cukierek', 'czekolada', 'żelki', 'pianka', 'karmel', 'lizak',
      'chipsy', 'chrupki', 'popcorn', 'krakersy', 'wafelek',
      'miód', 'dżem', 'marmolada', 'nutella', 'lody',
    ],
  },
  {
    name: 'Олії та жири',
    words: [
      'олія', 'соняшников', 'оливков', 'кокосов', 'маргарин', 'смалець', 'жир', 'масло вершкове',
      'масло подсолн', 'масло оливк', 'растительное масло', 'маргарин', 'жир',
      'oil', 'olive oil', 'sunflower oil', 'coconut oil', 'margarine', 'lard',
      'olej', 'oliwa', 'margaryna', 'smalec',
    ],
  },
  {
    name: 'Спеції та добавки',
    words: [
      'сіль', 'паприк', 'куркум', 'кориц', 'ванілін', 'ваніль', 'мускатн', 'цукор',
      'кардамон', 'лавров', 'приправ', 'спеці', 'орегано', 'розмарин', 'чебрец', 'кмин',
      'імбир сушен', 'сода', 'розпушув', 'желатин', 'дріжджі', 'насіння',
      // сушені трави = спеції (як у БД)
      'базилік сушен', 'петрушка сушен', 'кріп сушен', 'часник сушен', 'часник гранул',
      // RU
      'соль', 'паприк', 'куркум', 'корица', 'ваниль', 'приправ', 'специ', 'орегано', 'сахар', 'разрыхлит', 'дрожж', 'семечк', 'семен',
      // EN
      'salt', 'paprika', 'turmeric', 'cinnamon', 'vanilla', 'nutmeg', 'sugar',
      'cardamom', 'bay leaf', 'spice', 'seasoning', 'oregano', 'rosemary',
      'thyme', 'cumin', 'ginger', 'clove', 'baking soda', 'baking powder', 'yeast', 'gelatin', 'seed',
      // PL
      'sól', 'papryka', 'kurkuma', 'cynamon', 'wanilia', 'cukier',
      'kardamon', 'liść laurowy', 'przyprawa', 'zioła', 'oregano', 'rozmaryn',
      'tymianek', 'kminek', 'imbir', 'goździki', 'drożdż', 'żelatyn', 'soda',
    ],
  },
  {
    // Поза БД-категоріями — лишається лише для списку покупок (не їжа).
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

// Категорії в БД ієрархічні: products.category_id вказує на ПІД-категорію
// (напр. 401 "Свіжі" parent_id=4 "Фрукти"). Бакет списку покупок = назва
// ТОП-категорії БД напряму (Фрукти, Овочі, Яйця, ...) — 1:1 з базою.
// Embed products→categories через PostgREST не працює (немає FK у схемі),
// тож резолвимо category_id вручну через закешовану таблицю categories.

// category_id → name_ua топ-категорії. Завантажується один раз.
let _categoryIndex = null;
async function getCategoryIndex() {
  if (_categoryIndex) return _categoryIndex;
  const { data } = await supabase
    .from('categories')
    .select('id, name_ua, parent_id');
  const byId = new Map((data || []).map(c => [c.id, c]));
  const topNameOf = (id) => {
    let cur = byId.get(id);
    let guard = 0;
    while (cur && cur.parent_id != null && guard++ < 10) cur = byId.get(cur.parent_id);
    return cur?.name_ua || null;
  };
  _categoryIndex = { byId, topNameOf };
  return _categoryIndex;
}

// category_id (з products) → назва топ-категорії БД (= бакет списку), або null.
async function categoryIdToBucket(categoryId) {
  if (categoryId == null) return null;
  const { topNameOf } = await getCategoryIndex();
  return topNameOf(categoryId) || null;
}

// Резолвить довільну назву продукту до канонічного продукту в БД.
// Повертає { canonicalName, category }:
//   • canonicalName — products.name_ua (канон) або null, якщо в БД не знайдено;
//   • category — бакет списку (топ-категорія БД) або keyword-fallback.
// Порядок пошуку: точна/префіксна назва в products → аліаси → ключові слова.
// Канонічна назва потрібна для дедупу: "яблоко"/"apple"/"яблуко" → одна "Яблуко".
async function resolveProduct(name) {
  const term = name.trim().toLowerCase();
  if (term.length < 3) {
    return { canonicalName: null, category: guessCategory(name) };
  }

  // products за назвою-префіксом → найкоротша назва = найпряміший збіг
  const tryPrefix = async (prefix) => {
    const { data } = await supabase
      .from('products')
      .select('name_ua, category_id')
      .ilike('name_ua', `${prefix}%`)
      .not('category_id', 'is', null)
      .limit(5);
    if (!data?.length) return null;
    data.sort((a, b) => a.name_ua.length - b.name_ua.length);
    return data[0];
  };

  let prod = await tryPrefix(term);
  if (!prod && term.length > 5) prod = await tryPrefix(term.slice(0, 5));

  // Аліаси: люди пишуть по-різному ("яблоко"→"яблуко", "яйце"→"яйце куряче").
  if (!prod) prod = await resolveViaAlias(name);

  if (prod) {
    return {
      canonicalName: prod.name_ua || null,
      category: (await categoryIdToBucket(prod.category_id)) || guessCategory(name),
    };
  }

  // Невідомий продукт → keyword-fallback, без канонічної назви.
  return { canonicalName: null, category: guessCategory(name) };
}

// alias_normalized → product { name_ua, category_id }, або null.
async function resolveViaAlias(name) {
  const normalized = normalizeKey(name);
  if (normalized.length < 2) return null;
  try {
    const { data: aliasRows } = await supabase
      .from('product_aliases')
      .select('product_id')
      .ilike('alias_normalized', normalized)
      .limit(1);
    if (!aliasRows?.length) return null;

    const { data: prod } = await supabase
      .from('products')
      .select('name_ua, category_id')
      .eq('id', aliasRows[0].product_id)
      .maybeSingle();
    return prod || null;
  } catch {
    // alias search unavailable → хай спрацює keyword-fallback
    return null;
  }
}

// Тонка обгортка для місць, де потрібна лише категорія (імпорт тижневого меню).
async function lookupCategory(name) {
  return (await resolveProduct(name)).category;
}

// Тихо логуємо нерозпізнаний продукт у чергу для адміна (популярні → в БД).
// Не блокуємо UX: помилки/офлайн/RLS ігноруємо.
async function logUnmatched(rawName) {
  try {
    await supabase.rpc('log_unmatched_term', {
      p_raw: rawName,
      p_lang: localStorage.getItem('lang') || 'ua',
      p_source: 'shopping',
    });
  } catch { /* необов'язкове логування */ }
}
