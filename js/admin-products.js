// ============================================================
// admin-products.js — Секція 3: Юзерські продукти
// ============================================================

import { supabase } from './supabaseClient.js';
import {
  confirm, openDrawer, closeDrawer, logAction, clearStatsCache,
  formatDate, emptyState, skeletonList,
} from './admin-utils.js';
import { loadStats, updateSidebarBadge } from './admin-stats.js';

let _filters = { sort: 'date_desc', search: '', photo: '', lang: '', category: '' };
let _searchTimer = null;

export async function initProducts() {
  document.getElementById('filterProductsSort')?.addEventListener('change', (e) => {
    _filters.sort = e.target.value;
    loadProducts();
  });
  document.getElementById('filterProductsPhoto')?.addEventListener('change', (e) => {
    _filters.photo = e.target.value;
    loadProducts();
  });
  document.getElementById('filterProductsLang')?.addEventListener('change', (e) => {
    _filters.lang = e.target.value;
    loadProducts();
  });
  document.getElementById('filterProductsCategory')?.addEventListener('change', (e) => {
    _filters.category = e.target.value;
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
    .select('id, name_ua, name_en, category_id, kcal, protein, fat, carbs, created_at, user_id')
    .not('user_id', 'is', null);

  if (_filters.search) {
    query = query.or(`name_ua.ilike.%${_filters.search}%,name_en.ilike.%${_filters.search}%`);
  }
  if (_filters.photo === 'yes') query = query.not('image_url', 'is', null);
  if (_filters.photo === 'no')  query = query.is('image_url', null);
  if (_filters.lang === 'ua')   query = query.not('name_ua', 'is', null);
  if (_filters.lang === 'en')   query = query.is('name_ua', null).not('name_en', 'is', null);
  if (_filters.category)        query = query.eq('category_id', _filters.category);

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
        <span style="color:var(--color-text-muted)">${product.category_id || ''}</span>
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
      <button class="btn btn--sm btn--ghost" data-action="find-dupes" title="Знайти схожі продукти">Схожі</button>
      <button class="btn btn--sm btn--danger" data-action="delete" title="Видалити">×</button>
    </div>
  `;

  row.querySelector('[data-action="approve"]')?.addEventListener('click', () => _approve(product, row));
  row.querySelector('[data-action="delete"]')?.addEventListener('click', () => _delete(product, row));
  row.querySelector('[data-action="find-dupes"]')?.addEventListener('click', () => _findDupes(product, row));

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

  // Перевіряємо скільки рецептів використовують цей продукт
  const { count } = await supabase
    .from('product_recipe')
    .select('*', { count: 'exact', head: true })
    .eq('ingredient_id', product.id);

  const recipeWarning = count > 0
    ? ` Інгредієнт буде прибраний з ${count} рецепт${count === 1 ? 'у' : 'ів'} користувача.`
    : '';

  const ok = await confirm(
    'Видалити продукт',
    `Продукт "${name}" буде видалено назавжди.${recipeWarning}`,
    'Видалити'
  );
  if (!ok) return;

  // Soft delete — зберігаємо як evidence, не видаляємо назавжди
  await supabase.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', product.id);
  await logAction('products', product.id, 'soft_delete', { recipes_affected: count });
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

  const metaEl = row.querySelector('.admin-product-row__meta');
  if (metaEl) {
    metaEl.innerHTML = `${update.kcal ?? '—'} ккал · Б:${update.protein ?? '—'}г Ж:${update.fat ?? '—'}г В:${update.carbs ?? '—'}г`;
  }
  kcalEdit.hidden = true;
  editBtn.hidden = false;
}

async function _findDupes(product, row) {
  const name = product.name_ua || product.name_en || 'Без назви';
  openDrawer(`Схожі на: ${name}`, `<p style="color:var(--color-text-muted);font-size:13px">Пошук…</p>`);

  const { data, error } = await supabase.rpc('find_similar_products', {
    p_product_id: product.id,
    p_threshold: 0.25,
  });

  const drawerBody = document.getElementById('adminDrawerBody');
  if (!drawerBody) return;

  if (error) {
    drawerBody.innerHTML = `<p style="color:var(--color-danger);font-size:13px">Помилка: ${error.message}</p>`;
    return;
  }

  if (!data?.length) {
    drawerBody.innerHTML = `<p style="color:var(--color-text-muted);font-size:13px">Схожих продуктів не знайдено (поріг 25%)</p>`;
    return;
  }

  const items = data.map((sim) => {
    const simName = sim.name_ua || sim.name_en || '—';
    const pct = Math.round(sim.similarity * 100);
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--color-border)">
        <div>
          <div style="font-size:14px;font-weight:500">${simName}</div>
          <div style="font-size:12px;color:var(--color-text-muted)">${sim.kcal != null ? `${sim.kcal} ккал` : '—'} · Схожість: ${pct}%</div>
        </div>
        <button class="btn btn--sm btn--primary" data-merge-to="${sim.id}" data-merge-name="${simName}">Обʼєднати</button>
      </div>`;
  }).join('');

  drawerBody.innerHTML = `
    <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:12px">
      Юзерський продукт "<b>${name}</b>" буде замінено на обраний загальний продукт у всіх рецептах.
    </p>
    ${items}
  `;

  drawerBody.querySelectorAll('[data-merge-to]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const toId   = btn.dataset.mergeTo;
      const toName = btn.dataset.mergeName;
      const ok = await confirm('Обʼєднати продукти', `Замінити "${name}" → "${toName}" у всіх рецептах і видалити юзерський продукт?`, 'Обʼєднати');
      if (!ok) return;

      const { error: mergeErr } = await supabase.rpc('merge_product', {
        p_from_id: product.id,
        p_to_id: parseInt(toId, 10),
      });

      if (mergeErr) {
        alert(`Помилка: ${mergeErr.message}`);
        return;
      }

      await logAction('products', product.id, 'merge', { merged_into: toId, target_name: toName });
      closeDrawer();
      row.remove();
      clearStatsCache();
      await loadStats();
    });
  });
}
