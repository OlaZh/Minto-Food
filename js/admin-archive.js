// ============================================================
// admin-archive.js — Секція: Архів порушень (soft-deleted)
// ============================================================

import { supabase } from './supabaseClient.js';
import {
  confirm, confirmWithReason, logAction, clearStatsCache,
  formatDate, emptyState, skeletonList,
} from './admin-utils.js';
import { loadStats } from './admin-stats.js';

let _activeTab = 'recipes'; // 'recipes' | 'products'

export async function initArchive() {
  document.getElementById('archiveTabRecipes')?.addEventListener('click', () => {
    _activeTab = 'recipes';
    _syncTabs();
    loadArchivedRecipes();
  });
  document.getElementById('archiveTabProducts')?.addEventListener('click', () => {
    _activeTab = 'products';
    _syncTabs();
    loadArchivedProducts();
  });

  _syncTabs();
  await loadArchivedRecipes();
}

function _syncTabs() {
  document.getElementById('archiveTabRecipes')?.classList.toggle('admin-tab--active', _activeTab === 'recipes');
  document.getElementById('archiveTabProducts')?.classList.toggle('admin-tab--active', _activeTab === 'products');
}

// ── Рецепти ──────────────────────────────────────────────────

async function loadArchivedRecipes() {
  const listEl = document.getElementById('archiveList');
  if (!listEl) return;
  listEl.innerHTML = skeletonList(4);

  const { data, error } = await supabase
    .from('recipes')
    .select('id, name_ua, name_en, image, deleted_at, user_id, category')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(100);

  if (error) {
    listEl.innerHTML = `<p style="color:var(--color-danger)">Помилка: ${error.message}</p>`;
    return;
  }

  if (!data?.length) {
    listEl.innerHTML = emptyState('Архів рецептів порожній 🌿');
    return;
  }

  const authorIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
  const recipeIds = data.map(r => r.id);

  let authorsMap = {};
  let actionsMap = {};

  await Promise.all([
    authorIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', authorIds)
          .then(({ data: p }) => {
            authorsMap = Object.fromEntries((p || []).map(x => [x.id, x]));
          })
      : Promise.resolve(),
    supabase.from('admin_actions')
      .select('target_id, payload, created_at')
      .eq('action_type', 'soft_delete')
      .in('target_id', recipeIds)
      .order('created_at', { ascending: false })
      .then(({ data: acts }) => {
        (acts || []).forEach(a => {
          if (!actionsMap[a.target_id]) actionsMap[a.target_id] = a;
        });
      }),
  ]);

  listEl.innerHTML = '';
  data.forEach(recipe => {
    const author = authorsMap[recipe.user_id] || null;
    const action = actionsMap[recipe.id] || null;
    listEl.appendChild(_buildRecipeRow(recipe, author, action));
  });
}

function _buildRecipeRow(recipe, author, action) {
  const row = document.createElement('div');
  row.className = 'admin-recipe-row';
  row.dataset.id = recipe.id;

  const name = recipe.name_ua || recipe.name_en || 'Без назви';
  const thumb = recipe.image
    ? `<img class="admin-recipe-row__thumb" src="${recipe.image}" alt="" loading="lazy" style="opacity:.55">`
    : `<div class="admin-recipe-row__thumb"></div>`;

  const reason = action?.payload?.reason || action?.payload?.comment || '—';

  row.innerHTML = `
    ${thumb}
    <div class="admin-recipe-row__info">
      <div class="admin-recipe-row__name" style="opacity:.7">${name}</div>
      <div class="admin-recipe-row__meta">
        <span class="admin-recipe-row__author">${author?.full_name || '—'}</span>
        <span style="color:var(--color-danger);font-size:11px">🗑 ${formatDate(recipe.deleted_at)}</span>
        <span style="font-size:11px;color:var(--color-text-muted)">Причина: ${reason}</span>
        ${recipe.category ? `<span style="font-size:11px">${recipe.category}</span>` : ''}
      </div>
    </div>
    <div class="admin-recipe-row__actions">
      <button class="btn btn--sm btn--outline" data-action="restore" title="Відновити як чернетку автора">Відновити</button>
      <button class="btn btn--sm btn--danger"  data-action="purge"   title="Видалити з БД назавжди">Видалити назавжди</button>
    </div>
  `;

  row.querySelector('[data-action="restore"]')?.addEventListener('click', () => _restoreRecipe(recipe, row));
  row.querySelector('[data-action="purge"]')?.addEventListener('click',   () => _purgeRecipe(recipe, row));

  return row;
}

async function _restoreRecipe(recipe, row) {
  const name = recipe.name_ua || recipe.name_en || 'Без назви';
  const ok = await confirm('Відновити рецепт', `Рецепт «${name}» буде відновлено як чернетку автора.`, 'Відновити');
  if (!ok) return;
  await supabase.from('recipes').update({ deleted_at: null }).eq('id', recipe.id);
  await logAction('recipes', recipe.id, 'restore');
  row.remove();
  if (!document.getElementById('archiveList')?.children.length) {
    document.getElementById('archiveList').innerHTML = emptyState('Архів рецептів порожній 🌿');
  }
}

async function _purgeRecipe(recipe, row) {
  const name = recipe.name_ua || recipe.name_en || 'Без назви';
  const result = await confirmWithReason(
    'Видалити назавжди',
    `Рецепт «${name}» та всі пов'язані дані будуть видалені з бази. Цю дію не можна скасувати.`,
    'Видалити'
  );
  if (!result) return;
  await supabase.from('recipes').delete().eq('id', recipe.id);
  await logAction('recipes', recipe.id, 'purge', result);
  clearStatsCache();
  await loadStats();
  row.remove();
  if (!document.getElementById('archiveList')?.children.length) {
    document.getElementById('archiveList').innerHTML = emptyState('Архів рецептів порожній 🌿');
  }
}

// ── Продукти ─────────────────────────────────────────────────

async function loadArchivedProducts() {
  const listEl = document.getElementById('archiveList');
  if (!listEl) return;
  listEl.innerHTML = skeletonList(4);

  const { data, error } = await supabase
    .from('products')
    .select('id, name_ua, name_en, kcal, protein, fat, carbs, deleted_at, user_id')
    .not('deleted_at', 'is', null)
    .not('user_id', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(100);

  if (error) {
    listEl.innerHTML = `<p style="color:var(--color-danger)">Помилка: ${error.message}</p>`;
    return;
  }

  if (!data?.length) {
    listEl.innerHTML = emptyState('Архів продуктів порожній 🌿');
    return;
  }

  const authorIds = [...new Set(data.map(p => p.user_id).filter(Boolean))];
  const productIds = data.map(p => String(p.id));

  let authorsMap = {};
  let actionsMap = {};

  await Promise.all([
    authorIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', authorIds)
          .then(({ data: profiles }) => {
            authorsMap = Object.fromEntries((profiles || []).map(x => [x.id, x]));
          })
      : Promise.resolve(),
    supabase.from('admin_actions')
      .select('target_id, payload, created_at')
      .eq('action_type', 'soft_delete')
      .in('target_id', productIds)
      .order('created_at', { ascending: false })
      .then(({ data: acts }) => {
        (acts || []).forEach(a => {
          if (!actionsMap[a.target_id]) actionsMap[a.target_id] = a;
        });
      }),
  ]);

  listEl.innerHTML = '';
  data.forEach(product => {
    const author = authorsMap[product.user_id] || null;
    const action = actionsMap[String(product.id)] || null;
    listEl.appendChild(_buildProductRow(product, author, action));
  });
}

function _buildProductRow(product, author, action) {
  const row = document.createElement('div');
  row.className = 'admin-recipe-row';
  row.dataset.id = product.id;

  const name = product.name_ua || product.name_en || 'Без назви';
  const kcal = product.kcal != null ? `${product.kcal} ккал` : '—';
  const reason = action?.payload?.reason || '—';

  row.innerHTML = `
    <div class="admin-recipe-row__thumb" style="background:var(--color-bg-secondary);display:flex;align-items:center;justify-content:center;font-size:18px;opacity:.55">🏷</div>
    <div class="admin-recipe-row__info">
      <div class="admin-recipe-row__name" style="opacity:.7">${name}</div>
      <div class="admin-recipe-row__meta">
        <span class="admin-recipe-row__author">${author?.full_name || '—'}</span>
        <span>${kcal}</span>
        ${product.protein != null ? `<span style="font-size:11px">Б:${product.protein}г Ж:${product.fat}г В:${product.carbs}г</span>` : ''}
        <span style="color:var(--color-danger);font-size:11px">🗑 ${formatDate(product.deleted_at)}</span>
        <span style="font-size:11px;color:var(--color-text-muted)">Причина: ${reason}</span>
      </div>
    </div>
    <div class="admin-recipe-row__actions">
      <button class="btn btn--sm btn--outline" data-action="restore" title="Відновити продукт до активних">Відновити</button>
      <button class="btn btn--sm btn--danger"  data-action="purge"   title="Видалити з БД назавжди">Видалити назавжди</button>
    </div>
  `;

  row.querySelector('[data-action="restore"]')?.addEventListener('click', () => _restoreProduct(product, row));
  row.querySelector('[data-action="purge"]')?.addEventListener('click',   () => _purgeProduct(product, row));

  return row;
}

async function _restoreProduct(product, row) {
  const name = product.name_ua || product.name_en || 'Без назви';
  const ok = await confirm('Відновити продукт', `Продукт «${name}» буде відновлено до списку активних.`, 'Відновити');
  if (!ok) return;
  await supabase.from('products').update({ deleted_at: null }).eq('id', product.id);
  await logAction('products', product.id, 'restore');
  row.remove();
  if (!document.getElementById('archiveList')?.children.length) {
    document.getElementById('archiveList').innerHTML = emptyState('Архів продуктів порожній 🌿');
  }
}

async function _purgeProduct(product, row) {
  const name = product.name_ua || product.name_en || 'Без назви';
  const result = await confirmWithReason(
    'Видалити назавжди',
    `Продукт «${name}» буде видалено з бази. Цю дію не можна скасувати.`,
    'Видалити'
  );
  if (!result) return;
  await supabase.from('products').delete().eq('id', product.id);
  await logAction('products', product.id, 'purge', result);
  row.remove();
  if (!document.getElementById('archiveList')?.children.length) {
    document.getElementById('archiveList').innerHTML = emptyState('Архів продуктів порожній 🌿');
  }
}
