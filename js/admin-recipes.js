// ============================================================
// admin-recipes.js — Секція 2: Нові рецепти (proactive moderation)
// ============================================================

import { supabase } from './supabaseClient.js';
import {
  confirm, openDrawer, logAction, clearStatsCache,
  formatDate, emptyState, skeletonList,
} from './admin-utils.js';
import { loadStats } from './admin-stats.js';

let _filters = { days: '7', sort: 'date_desc', search: '' };
let _searchTimer = null;

export async function initRecipes() {
  document.getElementById('filterRecipesDays')?.addEventListener('change', (e) => {
    _filters.days = e.target.value;
    loadRecipes();
  });
  document.getElementById('filterRecipesSort')?.addEventListener('change', (e) => {
    _filters.sort = e.target.value;
    loadRecipes();
  });
  document.getElementById('searchRecipes')?.addEventListener('input', (e) => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      _filters.search = e.target.value.trim();
      loadRecipes();
    }, 300);
  });

  await loadRecipes();
}

export async function loadRecipes() {
  const listEl = document.getElementById('recipesList');
  if (!listEl) return;
  listEl.innerHTML = skeletonList(4);

  let query = supabase
    .from('recipes')
    .select(`
      id, name_ua, name_en, image_url, status, created_at, user_id,
      author:profiles!recipes_user_id_fkey (id, full_name, email, is_banned)
    `)
    .eq('status', 'published');

  if (_filters.days !== '0') {
    const from = new Date(Date.now() - parseInt(_filters.days) * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', from);
  }

  if (_filters.search) {
    query = query.ilike('name_ua', `%${_filters.search}%`);
  }

  if (_filters.sort === 'date_asc')  query = query.order('created_at', { ascending: true });
  else if (_filters.sort === 'author') query = query.order('user_id');
  else                                 query = query.order('created_at', { ascending: false });

  const { data, error } = await query.limit(100);

  if (error) {
    listEl.innerHTML = `<p style="color:var(--color-danger)">Помилка: ${error.message}</p>`;
    return;
  }

  if (!data?.length) {
    listEl.innerHTML = emptyState('Нових рецептів не знайдено');
    return;
  }

  // Підраховуємо рецепти автора за день (spam detection)
  const authorDayCount = {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  data.forEach((r) => {
    if (new Date(r.created_at) >= today) {
      authorDayCount[r.user_id] = (authorDayCount[r.user_id] || 0) + 1;
    }
  });

  listEl.innerHTML = '';
  data.forEach((recipe) => {
    const isSpam = (authorDayCount[recipe.user_id] || 0) > 10;
    listEl.appendChild(_buildRow(recipe, isSpam));
  });
}

function _buildRow(recipe, isSpam) {
  const row = document.createElement('div');
  row.className = 'admin-recipe-row' + (isSpam ? ' admin-recipe-row--spam-author' : '');
  row.dataset.id = recipe.id;

  const name   = recipe.name_ua || recipe.name_en || 'Без назви';
  const author = recipe.author;
  const thumb  = recipe.image_url
    ? `<img class="admin-recipe-row__thumb" src="${recipe.image_url}" alt="" loading="lazy">`
    : `<div class="admin-recipe-row__thumb"></div>`;

  row.innerHTML = `
    ${thumb}
    <div class="admin-recipe-row__info">
      <div class="admin-recipe-row__name">${name}</div>
      <div class="admin-recipe-row__meta">
        <span class="admin-recipe-row__author">${author?.full_name || author?.email || '—'}${isSpam ? ' ⚠️ >10 за день' : ''}</span>
        <span>${formatDate(recipe.created_at)}</span>
        ${recipe.status !== 'published' ? `<span style="color:var(--color-text-muted)">(${recipe.status})</span>` : ''}
      </div>
    </div>
    <div class="admin-recipe-row__actions">
      <button class="btn btn--sm btn--ghost" data-action="preview" title="Переглянути">👁</button>
      <button class="btn btn--sm btn--outline" data-action="draft" title="Перевести в draft">Draft</button>
      <button class="btn btn--sm btn--danger" data-action="delete" title="Видалити">×</button>
    </div>
  `;

  row.querySelector('.admin-recipe-row__name')?.addEventListener('click', () =>
    _openDrawer(recipe));
  row.querySelector('.admin-recipe-row__thumb')?.addEventListener('click', () =>
    _openDrawer(recipe));
  row.querySelector('[data-action="preview"]')?.addEventListener('click', () =>
    _openDrawer(recipe));
  row.querySelector('[data-action="draft"]')?.addEventListener('click', () =>
    _setDraft(recipe));
  row.querySelector('[data-action="delete"]')?.addEventListener('click', () =>
    _delete(recipe));

  return row;
}

async function _setDraft(recipe) {
  const name = recipe.name_ua || recipe.name_en || 'Без назви';
  const ok = await confirm('Перевести в draft', `Рецепт "${name}" буде прихований з публічного доступу.`);
  if (!ok) return;
  await supabase.from('recipes').update({ status: 'draft' }).eq('id', recipe.id);
  await logAction('recipes', recipe.id, 'set_draft', { from: 'admin_recipes' });
  clearStatsCache();
  await loadStats();
  await loadRecipes();
}

async function _delete(recipe) {
  const name = recipe.name_ua || recipe.name_en || 'Без назви';
  const ok = await confirm('Видалити рецепт', `Рецепт "${name}" буде видалено назавжди.`, 'Видалити');
  if (!ok) return;
  await supabase.from('recipes').delete().eq('id', recipe.id);
  await logAction('recipes', recipe.id, 'delete', { from: 'admin_recipes' });
  clearStatsCache();
  await loadStats();
  await loadRecipes();
}

function _openDrawer(recipe) {
  const name  = recipe.name_ua || recipe.name_en || 'Без назви';
  const thumb = recipe.image_url
    ? `<img src="${recipe.image_url}" alt="${name}" style="width:100%;border-radius:8px;margin-bottom:16px">`
    : '';
  openDrawer(name, `
    ${thumb}
    <p><b>ID:</b> ${recipe.id}</p>
    <p><b>Статус:</b> ${recipe.status}</p>
    <p><b>Назва UA:</b> ${recipe.name_ua || '—'}</p>
    <p><b>Назва EN:</b> ${recipe.name_en || '—'}</p>
    <p><b>Автор:</b> ${recipe.author?.full_name || recipe.author?.email || '—'}</p>
    <p><b>Дата:</b> ${formatDate(recipe.created_at)}</p>
  `);
}
