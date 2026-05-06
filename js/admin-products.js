// ============================================================
// admin-products.js — Секція 3: Юзерські продукти
// ============================================================

import { supabase } from './supabaseClient.js';
import {
  confirm, logAction, clearStatsCache,
  formatDate, emptyState, skeletonList,
} from './admin-utils.js';
import { loadStats, updateSidebarBadge } from './admin-stats.js';

let _filters = { sort: 'date_desc', search: '' };
let _searchTimer = null;

export async function initProducts() {
  document.getElementById('filterProductsSort')?.addEventListener('change', (e) => {
    _filters.sort = e.target.value;
    loadProducts();
  });
  document.getElementById('searchProducts')?.addEventListener('input', (e) => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      _filters.search = e.target.value.trim();
      loadProducts();
    }, 300);
  });

  await loadProducts();
}

export async function loadProducts() {
  const listEl = document.getElementById('productsList');
  if (!listEl) return;
  listEl.innerHTML = skeletonList(4);

  let query = supabase
    .from('products')
    .select('id, name_ua, name_en, category, kcal, protein, fat, carbs, created_at, user_id')
    .not('user_id', 'is', null);

  if (_filters.search) {
    query = query.ilike('name_ua', `%${_filters.search}%`);
  }

  if (_filters.sort === 'name') query = query.order('name_ua');
  else                          query = query.order('created_at', { ascending: false });

  const { data, error } = await query.limit(100);

  if (error) {
    listEl.innerHTML = `<p style="color:var(--color-danger)">Помилка: ${error.message}</p>`;
    return;
  }

  if (!data?.length) {
    listEl.innerHTML = emptyState('Юзерських продуктів немає');
    updateSidebarBadge('sidebarProductsCount', 0);
    return;
  }

  updateSidebarBadge('sidebarProductsCount', data.length);

  listEl.innerHTML = '';
  data.forEach((product) => {
    listEl.appendChild(_buildRow(product));
  });
}

function _buildRow(product) {
  const row = document.createElement('div');
  row.className = 'admin-product-row';
  row.dataset.id = product.id;

  const name = product.name_ua || product.name_en || 'Без назви';
  const kcal = product.kcal != null ? `${product.kcal} ккал` : '—';

  row.innerHTML = `
    <div class="admin-product-row__info">
      <div class="admin-product-row__name">${name}</div>
      <div class="admin-product-row__meta">
        ${kcal}
        ${product.protein != null ? ` · Б:${product.protein}г Ж:${product.fat}г В:${product.carbs}г` : ''}
        <span style="color:var(--color-text-muted)">${product.category || ''}</span>
        · ${formatDate(product.created_at)}
      </div>
    </div>
    <div class="admin-kcal-edit" id="kcalEdit_${product.id}" hidden>
      <div>
        <label>Ккал</label>
        <input type="number" value="${product.kcal ?? ''}" data-field="kcal" min="0" max="9999">
      </div>
      <div>
        <label>Б</label>
        <input type="number" value="${product.protein ?? ''}" data-field="protein" min="0" max="999">
      </div>
      <div>
        <label>Ж</label>
        <input type="number" value="${product.fat ?? ''}" data-field="fat" min="0" max="999">
      </div>
      <div>
        <label>В</label>
        <input type="number" value="${product.carbs ?? ''}" data-field="carbs" min="0" max="999">
      </div>
      <button class="btn btn--sm btn--primary" data-action="save-kcal">✓</button>
      <button class="btn btn--sm btn--ghost" data-action="cancel-kcal">✕</button>
    </div>
    <div class="admin-product-row__actions">
      <button class="btn btn--sm btn--primary" data-action="approve" title="Схвалити (стає загальним)">Схвалити</button>
      <button class="btn btn--sm btn--outline" data-action="edit-kcal" title="Редагувати КБЖУ">КБЖУ</button>
      <button class="btn btn--sm btn--danger" data-action="delete" title="Видалити">×</button>
    </div>
  `;

  row.querySelector('[data-action="approve"]')?.addEventListener('click', () => _approve(product, row));
  row.querySelector('[data-action="delete"]')?.addEventListener('click', () => _delete(product, row));

  const editBtn  = row.querySelector('[data-action="edit-kcal"]');
  const kcalEdit = row.querySelector(`#kcalEdit_${product.id}`);
  editBtn?.addEventListener('click', () => { kcalEdit.hidden = false; editBtn.hidden = true; });
  row.querySelector('[data-action="cancel-kcal"]')?.addEventListener('click', () => {
    kcalEdit.hidden = true; editBtn.hidden = false;
  });
  row.querySelector('[data-action="save-kcal"]')?.addEventListener('click', () =>
    _saveKcal(product, row, kcalEdit, editBtn));

  return row;
}

async function _approve(product, row) {
  const name = product.name_ua || product.name_en || 'Без назви';
  const ok = await confirm('Схвалити продукт', `Продукт "${name}" стане загальним (user_id → NULL).`);
  if (!ok) return;
  await supabase.from('products').update({ user_id: null }).eq('id', product.id);
  await logAction('products', product.id, 'approve');
  row.remove();
  clearStatsCache();
  await loadStats();
}

async function _delete(product, row) {
  const name = product.name_ua || product.name_en || 'Без назви';
  const ok = await confirm('Видалити продукт', `Продукт "${name}" буде видалено назавжди.`, 'Видалити');
  if (!ok) return;
  await supabase.from('products').delete().eq('id', product.id);
  await logAction('products', product.id, 'delete');
  row.remove();
  clearStatsCache();
  await loadStats();
}

async function _saveKcal(product, row, kcalEdit, editBtn) {
  const inputs = kcalEdit.querySelectorAll('input[data-field]');
  const update = {};
  inputs.forEach((input) => {
    const val = parseFloat(input.value);
    update[input.dataset.field] = isNaN(val) ? null : val;
  });

  await supabase.from('products').update(update).eq('id', product.id);
  await logAction('products', product.id, 'edit_kcal', update);

  // Оновлюємо мета-текст у рядку
  const metaEl = row.querySelector('.admin-product-row__meta');
  if (metaEl) {
    metaEl.innerHTML = `${update.kcal ?? '—'} ккал · Б:${update.protein ?? '—'}г Ж:${update.fat ?? '—'}г В:${update.carbs ?? '—'}г`;
  }
  kcalEdit.hidden = true;
  editBtn.hidden = false;
}
