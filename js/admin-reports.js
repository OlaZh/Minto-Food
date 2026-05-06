// ============================================================
// admin-reports.js — Секція 1: Скарги
// ============================================================

import { supabase } from './supabaseClient.js';
import {
  confirm, openDrawer, logAction, clearStatsCache,
  formatDate, typePillHTML, emptyState, skeletonList, BulkSelect,
} from './admin-utils.js';
import { loadStats } from './admin-stats.js';

let _bulk = null;
let _filters = { type: '', status: 'pending', sort: 'date_desc' };

export async function initReports() {
  _bulk = new BulkSelect({
    listId:  'reportsList',
    bulkId:  'reportsBulk',
    countId: 'reportsBulkCount',
  });

  document.getElementById('filterReportType')?.addEventListener('change', (e) => {
    _filters.type = e.target.value;
    loadReports();
  });
  document.getElementById('filterReportStatus')?.addEventListener('change', (e) => {
    _filters.status = e.target.value;
    loadReports();
  });
  document.getElementById('filterReportSort')?.addEventListener('change', (e) => {
    _filters.sort = e.target.value;
    loadReports();
  });

  document.getElementById('bulkDismiss')?.addEventListener('click', () => _bulkAction('dismissed'));
  document.getElementById('bulkResolve')?.addEventListener('click', () => _bulkAction('resolved'));
  document.getElementById('bulkClear')?.addEventListener('click', () => _bulk.clear());

  await loadReports();
}

export async function loadReports() {
  const listEl = document.getElementById('reportsList');
  if (!listEl) return;
  listEl.innerHTML = skeletonList(3);

  let query = supabase
    .from('recipe_reports')
    .select(`
      id, reason, comment, created_at, status,
      recipe:recipes (
        id, name_ua, name_en, photo_url, status, user_id,
        author:profiles!recipes_user_id_fkey (id, full_name, email, is_banned)
      ),
      reporter:profiles!recipe_reports_reporter_id_fkey (id, full_name, email)
    `);

  if (_filters.status) query = query.eq('status', _filters.status);
  if (_filters.type)   query = query.eq('reason', _filters.type);

  if (_filters.sort === 'date_asc')  query = query.order('created_at', { ascending: true });
  else if (_filters.sort === 'type') query = query.order('reason');
  else                               query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    listEl.innerHTML = `<p style="color:var(--color-danger)">Помилка завантаження: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = emptyState('Усе чисто 🌿');
    return;
  }

  // Групуємо по recipe_id — якщо кілька скарг на один рецепт
  const byRecipe = _groupByRecipe(data);

  listEl.innerHTML = '';
  _bulk.clear();

  byRecipe.forEach((group) => {
    const isGrouped = group.length > 1;
    group.forEach((report) => {
      listEl.appendChild(_buildCard(report, isGrouped));
    });
  });
}

function _groupByRecipe(reports) {
  const map = new Map();
  reports.forEach((r) => {
    const rid = r.recipe?.id ?? 'unknown';
    if (!map.has(rid)) map.set(rid, []);
    map.get(rid).push(r);
  });
  return [...map.values()];
}

function _buildCard(report, grouped) {
  const card = document.createElement('div');
  card.className = 'admin-report-card' + (grouped ? ' admin-report-card--grouped' : '');
  card.dataset.id = report.id;

  const recipe    = report.recipe;
  const reporter  = report.reporter;
  const author    = recipe?.author;
  const thumb     = recipe?.photo_url
    ? `<img class="admin-report-card__recipe-thumb" src="${recipe.photo_url}" alt="" loading="lazy">`
    : `<div class="admin-report-card__recipe-thumb"></div>`;
  const name = recipe?.name_ua || recipe?.name_en || 'Без назви';

  card.innerHTML = `
    <input type="checkbox" class="admin-report-card__checkbox" aria-label="Вибрати скаргу">
    <div class="admin-report-card__body">
      <div class="admin-report-card__recipe" data-recipe-id="${recipe?.id || ''}">
        ${thumb}
        <div>
          <div class="admin-report-card__recipe-name">${name}</div>
          <div class="admin-report-card__meta">
            ${typePillHTML(report.reason)}
            <span>Автор: <b>${author?.full_name || author?.email || '—'}</b>${author?.is_banned ? ' 🚫' : ''}</span>
            <span>Скаржник: ${reporter?.full_name || reporter?.email || '—'}</span>
            <span>${formatDate(report.created_at)}</span>
          </div>
          ${report.comment ? `<div class="admin-report-card__comment">"${report.comment}"</div>` : ''}
        </div>
      </div>
    </div>
    <div class="admin-report-card__actions">
      <button class="btn btn--sm btn--ghost" data-action="dismiss" title="Відхилити скаргу">Відхилити</button>
      <button class="btn btn--sm btn--outline" data-action="resolve" title="Прибрати рецепт з публіки">Прибрати</button>
      <button class="btn btn--sm btn--danger" data-action="delete" title="Видалити рецепт">Видалити</button>
      ${author && !author.is_banned
        ? `<button class="btn btn--sm btn--danger" data-action="ban" title="Забанити автора">Бан</button>`
        : ''}
    </div>
  `;

  // Checkbox для bulk
  const cb = card.querySelector('.admin-report-card__checkbox');
  _bulk.bind(cb, report.id);

  // Клік по рецепту — drawer
  card.querySelector('.admin-report-card__recipe')?.addEventListener('click', () => {
    if (recipe?.id) _openRecipeDrawer(recipe);
  });

  // Дії
  card.querySelector('[data-action="dismiss"]')?.addEventListener('click', () =>
    _handleAction('dismiss', report));
  card.querySelector('[data-action="resolve"]')?.addEventListener('click', () =>
    _handleAction('resolve', report));
  card.querySelector('[data-action="delete"]')?.addEventListener('click', () =>
    _handleAction('delete', report));
  card.querySelector('[data-action="ban"]')?.addEventListener('click', () =>
    _handleAction('ban', report));

  return card;
}

async function _handleAction(action, report) {
  const recipe = report.recipe;
  const name   = recipe?.name_ua || recipe?.name_en || 'Без назви';
  const author = report.author;

  if (action === 'dismiss') {
    const ok = await confirm('Відхилити скаргу', `Скаргу на "${name}" буде відхилено. Рецепт залишається опублікованим.`);
    if (!ok) return;
    await _resolveReport(report.id, 'dismissed');
    await logAction('recipe_reports', report.id, 'dismiss');
  }

  if (action === 'resolve') {
    const ok = await confirm('Прибрати рецепт з публіки', `Рецепт "${name}" буде переведено в draft. Скаргу буде вирішено.`);
    if (!ok) return;
    await supabase.from('recipes').update({ status: 'draft' }).eq('id', recipe.id);
    await _resolveReport(report.id, 'resolved');
    await logAction('recipes', recipe.id, 'set_draft', { from: 'admin_report' });
  }

  if (action === 'delete') {
    const ok = await confirm('Видалити рецепт', `Рецепт "${name}" та всі пов'язані скарги будуть видалені назавжди. Цю дію не можна скасувати.`, 'Видалити');
    if (!ok) return;
    await supabase.from('recipes').delete().eq('id', recipe.id);
    await logAction('recipes', recipe.id, 'delete', { reason: 'admin_moderation' });
  }

  if (action === 'ban') {
    const recipeAuthor = report.recipe?.author;
    if (!recipeAuthor) return;
    const ok = await confirm(
      'Забанити користувача',
      `Акаунт "${recipeAuthor.full_name || recipeAuthor.email}" буде заблоковано. Усі його опубліковані рецепти стануть draft. Усі pending скарги на нього будуть auto-resolved.`,
      'Забанити'
    );
    if (!ok) return;
    await _banUser(recipeAuthor.id);
    await logAction('profiles', recipeAuthor.id, 'ban', { reason: 'admin_moderation' });
  }

  clearStatsCache();
  await loadStats();
  await loadReports();
}

async function _resolveReport(reportId, status) {
  const { data: { session } } = await supabase.auth.getSession();
  await supabase.from('recipe_reports').update({
    status,
    resolved_by: session?.user?.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', reportId);
}

async function _banUser(userId) {
  // Баним юзера
  await supabase.from('profiles').update({ is_banned: true }).eq('id', userId);
  // Переводимо його published рецепти в draft
  await supabase.from('recipes').update({ status: 'draft' })
    .eq('user_id', userId).eq('status', 'published');
  // Auto-resolve всі pending скарги на його рецепти
  const { data: { session } } = await supabase.auth.getSession();
  const { data: userRecipes } = await supabase
    .from('recipes').select('id').eq('user_id', userId);
  if (userRecipes?.length) {
    const recipeIds = userRecipes.map(r => r.id);
    await supabase.from('recipe_reports').update({
      status:      'resolved',
      resolved_by: session?.user?.id,
      resolved_at: new Date().toISOString(),
    }).in('recipe_id', recipeIds).eq('status', 'pending');
  }
}

async function _bulkAction(status) {
  const ids = _bulk.selected;
  if (!ids.length) return;

  const label = status === 'dismissed' ? 'Відхилити' : 'Вирішити';
  const ok = await confirm(`${label} вибрані`, `${label} ${ids.length} скарг?`);
  if (!ok) return;

  const { data: { session } } = await supabase.auth.getSession();
  await supabase.from('recipe_reports').update({
    status,
    resolved_by: session?.user?.id,
    resolved_at: new Date().toISOString(),
  }).in('id', ids);

  await logAction('recipe_reports', ids.join(','), `bulk_${status}`, { count: ids.length });
  clearStatsCache();
  await loadStats();
  _bulk.clear();
  await loadReports();
}

function _openRecipeDrawer(recipe) {
  const name  = recipe.name_ua || recipe.name_en || 'Без назви';
  const thumb = recipe.photo_url
    ? `<img src="${recipe.photo_url}" alt="${name}" style="width:100%;border-radius:8px;margin-bottom:16px">`
    : '';
  openDrawer(name, `
    ${thumb}
    <p><b>ID:</b> ${recipe.id}</p>
    <p><b>Статус:</b> ${recipe.status}</p>
    <p><b>Назва:</b> ${recipe.name_ua || '—'} / ${recipe.name_en || '—'}</p>
  `);
}
