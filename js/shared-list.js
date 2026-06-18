/* ============================================================
   shared-list.js
   Публічна сторінка спільного списку.
   Доступ без авторизації через share_token.
   Оновлення кожні 4 секунди + оптимістичний UI.
   ============================================================ */

import { supabase } from './supabaseClient.js';
import { escapeHTML, showToast } from './utils.js';
import { t, formatText } from './i18n-apply.js';

const token = new URLSearchParams(location.search).get('token');

let items   = [];
let seenIds = new Set();

const loadingEl = document.getElementById('shared-loading');
const errorEl   = document.getElementById('shared-error');
const contentEl = document.getElementById('shared-content');
const titleEl   = document.getElementById('shared-title');
const countEl   = document.getElementById('shared-count');
const fillEl    = document.getElementById('shared-fill');
const itemsEl   = document.getElementById('shared-items');

document.addEventListener('DOMContentLoaded', async () => {
  if (!token) { showError(); return; }

  const { data: meta, error } = await supabase
    .rpc('get_shared_list_meta', { p_token: token });

  if (error || !meta?.length) { showError(); return; }

  document.title = `${meta[0].name} — Minto Food`;
  titleEl.textContent = meta[0].name;

  loadingEl.hidden = true;
  contentEl.hidden = false;

  await fetchItems(true);
  setInterval(() => fetchItems(false), 4000);
});

async function fetchItems(initial) {
  const { data, error } = await supabase
    .rpc('get_shared_list_items', { p_token: token });

  if (error || !data) return;

  const newIds = new Set();
  if (!initial) {
    data.forEach(i => { if (!seenIds.has(i.id)) newIds.add(i.id); });
  }

  items = data;
  items.forEach(i => seenIds.add(i.id));
  render(newIds);
}

async function toggleItem(id, checked) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  const prev = item.is_checked;
  // Оптимістичний UI: міняємо одразу, але запам'ятовуємо попередній стан.
  item.is_checked = checked;
  render(new Set());

  const { error } = await supabase.rpc('toggle_shared_item', {
    p_token:   token,
    p_item_id: Number(id),
    p_checked: checked,
  });

  if (error) {
    // RPC не пройшов → відкочуємо UI, щоб стан не брехав.
    item.is_checked = prev;
    render(new Set());
    showToast(t('sharedListUpdateError'), 'error');
  }
}

function render(newIds) {
  const total   = items.length;
  const checked = items.filter(i => i.is_checked).length;
  const pct     = total > 0 ? Math.round(checked / total * 100) : 0;

  countEl.textContent = total > 0 ? formatText('sharedBoughtCount', { checked, total }) : '';
  fillEl.style.width  = pct + '%';
  itemsEl.innerHTML   = '';

  if (!total) {
    itemsEl.innerHTML = `<p class="shared-list__empty">${t('sharedListEmpty')}</p>`;
    return;
  }

  const groups = {};
  items.forEach(i => {
    const cat = i.category || t('categoryOther');
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(i);
  });

  Object.entries(groups).forEach(([cat, catItems]) => {
    const section = document.createElement('div');
    section.className = 'shop-category';
    section.innerHTML =
      `<h3 class="shop-category__title">${escapeHTML(cat)}</h3>` +
      `<ul class="shop-category__list"></ul>`;
    const ul = section.querySelector('ul');

    catItems.forEach(item => {
      const isNew = newIds.has(item.id);
      const li = document.createElement('li');
      li.className =
        `shop-item${item.is_checked ? ' shop-item--checked' : ''}${isNew ? ' shop-item--new' : ''}`;
      li.dataset.id = item.id;

      const amountText = item.amount
        ? `${item.amount}${item.unit ? ' ' + item.unit : ''}`
        : '';

      li.innerHTML = `
        <label class="shop-item__check-label">
          <input type="checkbox" class="shop-item__checkbox"
            ${item.is_checked ? 'checked' : ''} aria-label="${t('boughtLabel')}">
          <span class="shop-item__custom-check"></span>
        </label>
        <span class="shop-item__name">${escapeHTML(item.name)}</span>
        ${amountText ? `<span class="shop-item__amount">${escapeHTML(amountText)}</span>` : ''}
      `;

      li.addEventListener('click', e => {
        const cb = li.querySelector('.shop-item__checkbox');
        const clickedLabel = e.target.closest('.shop-item__check-label');
        if (!clickedLabel) {
          cb.checked = !cb.checked;
        }
        toggleItem(item.id, cb.checked);
      });

      ul.appendChild(li);
    });

    itemsEl.appendChild(section);
  });
}

function showError() {
  loadingEl.hidden = true;
  errorEl.hidden   = false;
}
