// ============================================================
// admin-reports.js — Секція 1: Скарги
// ============================================================

import { supabase } from './supabaseClient.js';
import {
  confirm, confirmWithReason, withUndo, openDrawer, logAction, clearStatsCache,
  formatDate, typePillHTML, parseReason, emptyState, skeletonList, BulkSelect,
} from './admin-utils.js';
import { loadStats } from './admin-stats.js';

let _bulk = null;
let _filters = { type: '', status: 'pending', sort: 'date_desc', dateFrom: '', dateTo: '' };
let _realtimeChannel = null;

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

  document.getElementById('filterReportDateFrom')?.addEventListener('change', (e) => {
    _filters.dateFrom = e.target.value;
    loadReports();
  });
  document.getElementById('filterReportDateTo')?.addEventListener('change', (e) => {
    _filters.dateTo = e.target.value;
    loadReports();
  });

  document.getElementById('bulkDismiss')?.addEventListener('click', () => _bulkAction('dismissed'));
  document.getElementById('bulkResolve')?.addEventListener('click', () => _bulkAction('resolved'));
  document.getElementById('bulkClear')?.addEventListener('click', () => _bulk.clear());

  await loadReports();
  _subscribeRealtime();
}

function _subscribeRealtime() {
  if (_realtimeChannel) return;
  _realtimeChannel = supabase
    .channel('admin-reports-watch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recipe_reports' }, () => {
      clearStatsCache();
      loadStats();
      loadReports();
    })
    .subscribe();
}

export async function loadReports() {
  const listEl = document.getElementById('reportsList');
  if (!listEl) return;
  listEl.innerHTML = skeletonList(3);

  let query = supabase
    .from('recipe_reports')
    .select('id, reason, admin_notes, created_at, status, recipe_id, reporter_id, recipe:recipes (id, name_ua, name_en, image, status, user_id, kcal, protein, fat, carbs, steps, category)');

  if (_filters.status)   query = query.eq('status', _filters.status);
  if (_filters.type)     query = query.ilike('reason', `${_filters.type}%`);
  if (_filters.dateFrom) query = query.gte('created_at', _filters.dateFrom);
  if (_filters.dateTo)   query = query.lte('created_at', _filters.dateTo + 'T23:59:59');

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

  // Збираємо унікальні id для batch-завантаження profiles
  const authorIds   = [...new Set(data.map(r => r.recipe?.user_id).filter(Boolean))];
  const reporterIds = [...new Set(data.map(r => r.reporter_id).filter(Boolean))];
  const allIds      = [...new Set([...authorIds, ...reporterIds])];

  let profilesMap = {};
  if (allIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, is_banned')
      .in('id', allIds);
    profilesMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  }

  // Збагачуємо дані
  const enriched = data.map(r => ({
    ...r,
    recipe: r.recipe ? { ...r.recipe, author: profilesMap[r.recipe.user_id] || null } : null,
    reporter: profilesMap[r.reporter_id] || null,
  }));

  // Групуємо по recipe_id — якщо кілька скарг на один рецепт
  const byRecipe = _groupByRecipe(enriched);

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
  const thumb     = recipe?.image
    ? `<img class="admin-report-card__recipe-thumb" src="${recipe.image}" alt="" loading="lazy">`
    : `<div class="admin-report-card__recipe-thumb"></div>`;
  const name = recipe?.name_ua || recipe?.name_en || 'Без назви';
  const { comment: reportComment } = parseReason(report.reason);

  card.innerHTML = `
    <input type="checkbox" class="admin-report-card__checkbox" aria-label="Вибрати скаргу">
    <div class="admin-report-card__body">
      <div class="admin-report-card__recipe" data-recipe-id="${recipe?.id || ''}">
        ${thumb}
        <div>
          <div class="admin-report-card__recipe-name">${name}</div>
          <div class="admin-report-card__meta">
            ${typePillHTML(report.reason)}
            <span>Автор: <b>${author?.full_name || '—'}</b>${author?.is_banned ? ' 🚫' : ''}</span>
            <span>Скаржник: ${reporter?.full_name || '—'}</span>
            <span>${formatDate(report.created_at)}</span>
          </div>
          ${reportComment ? `<div class="admin-report-card__reporter-comment">💬 ${reportComment}</div>` : ''}
          ${report.admin_notes ? `<div class="admin-report-card__comment">"${report.admin_notes}"</div>` : ''}
        </div>
      </div>
    </div>
    <div class="admin-report-card__actions">
      <button class="btn btn--sm btn--ghost" data-action="dismiss"
        title="Скарга безпідставна — рецепт лишається, скарга закривається">
        Скарга безпідставна
      </button>
      <button class="btn btn--sm btn--outline" data-action="resolve"
        title="Рецепт прихований зі спільноти, але не видалений">
        Приховати рецепт
      </button>
      <button class="btn btn--sm btn--danger" data-action="delete"
        title="Рецепт видаляється назавжди">
        Видалити рецепт
      </button>
      ${author?.is_banned
        ? `<button class="btn btn--sm btn--ghost" disabled title="Вже забанений">🚫 Вже бан</button>`
        : `<button class="btn btn--sm btn--danger" data-action="ban"
            title="Забанити автора — всі рецепти приховуються">
            Бан автора
           </button>`
      }
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
    await withUndo(`Скаргу на "${name}" відхилено`, async () => {
      await _resolveReport(report.id, 'dismissed');
      await logAction('recipe_reports', report.id, 'dismiss');
      clearStatsCache(); await loadStats(); await loadReports();
    });
    return;
  }

  if (action === 'resolve') {
    const result = await confirmWithReason('Прибрати рецепт з публіки', `Рецепт "${name}" буде переведено в draft.`, 'Прибрати');
    if (!result) return;
    await withUndo(`Рецепт "${name}" переведено в draft`, async () => {
      await supabase.from('recipes').update({ status: 'draft' }).eq('id', recipe.id);
      await _resolveReport(report.id, 'resolved');
      await logAction('recipes', recipe.id, 'set_draft', { from: 'admin_report', ...result });
      clearStatsCache(); await loadStats(); await loadReports();
    });
    return;
  }

  if (action === 'delete') {
    const result = await confirmWithReason('Видалити рецепт', `Рецепт "${name}" буде видалено назавжди.`, 'Видалити');
    if (!result) return;
    await withUndo(`Рецепт "${name}" видалено`, async () => {
      await supabase.from('recipes').update({ deleted_at: new Date().toISOString(), status: 'draft' }).eq('id', recipe.id);
      await logAction('recipes', recipe.id, 'soft_delete', { reason: result.reason, comment: result.comment });
      clearStatsCache(); await loadStats(); await loadReports();
    });
    return;
  }

  if (action === 'ban') {
    const recipeAuthor = report.recipe?.author;
    if (!recipeAuthor) return;
    const result = await confirmWithReason(
      'Забанити користувача',
      `Акаунт "${recipeAuthor.full_name || '—'}" буде заблоковано. Усі його рецепти стануть draft.`,
      'Забанити'
    );
    if (!result) return;
    await withUndo(`Юзера "${recipeAuthor.full_name || '—'}" забанено`, async () => {
      await _banUser(recipeAuthor.id);
      await logAction('profiles', recipeAuthor.id, 'ban', { reason: result.reason, comment: result.comment });
      clearStatsCache(); await loadStats(); await loadReports();
    });
    return;
  }
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

async function _openRecipeDrawer(recipe) {
  const name  = recipe.name_ua || recipe.name_en || 'Без назви';
  const thumb = recipe.image
    ? `<img src="${recipe.image}" alt="${name}" style="width:100%;border-radius:8px;margin-bottom:16px">`
    : `<div style="width:100%;height:160px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:16px;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:13px">Без фото</div>`;

  const kcalBlock = (recipe.kcal != null)
    ? `<div style="display:flex;gap:16px;margin:12px 0;padding:10px 14px;background:var(--color-bg-secondary);border-radius:8px;font-size:13px">
        <span><b>${recipe.kcal}</b> ккал</span>
        <span>Б: <b>${recipe.protein ?? '—'}</b>г</span>
        <span>Ж: <b>${recipe.fat ?? '—'}</b>г</span>
        <span>В: <b>${recipe.carbs ?? '—'}</b>г</span>
      </div>`
    : '';

  // Підгружаємо інгредієнти
  let ingredientsBlock = '';
  const { data: ingRows } = await supabase
    .from('product_recipe')
    .select('amount, unit, ingredient:products(name_ua, name_en)')
    .eq('recipe_id', recipe.id);

  if (ingRows?.length) {
    const items = ingRows.map(r => {
      const ingName = r.ingredient?.name_ua || r.ingredient?.name_en || '—';
      return `<li style="padding:2px 0">${ingName} — ${r.amount}${r.unit || 'г'}</li>`;
    }).join('');
    ingredientsBlock = `<p style="margin:12px 0 4px"><b>Інгредієнти:</b></p><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">${items}</ul>`;
  }

  const stepsBlock = recipe.steps
    ? `<p style="margin:12px 0 4px"><b>Приготування:</b></p><p style="font-size:13px;line-height:1.7;white-space:pre-wrap">${recipe.steps}</p>`
    : '';

  // Mini-history автора
  let authorHistoryBlock = '';
  if (recipe.user_id) {
    const [{ count: recipeCount }, { count: reportCount }, { data: actionRows }] = await Promise.all([
      supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('user_id', recipe.user_id),
      supabase.from('recipe_reports').select('*', { count: 'exact', head: true }).eq('recipe_id', recipe.id),
      supabase.from('admin_actions').select('created_at').eq('target_id', recipe.user_id).eq('action_type', 'ban').order('created_at', { ascending: false }).limit(3),
    ]);
    const banHistory = actionRows?.length
      ? `<span style="color:#ef4444">🚫 Банів: ${actionRows.length}</span>`
      : '<span style="color:var(--color-text-muted)">Банів не було</span>';
    authorHistoryBlock = `
      <div style="background:var(--color-bg-secondary);border-radius:8px;padding:10px 14px;margin:10px 0;font-size:12px;display:flex;gap:16px;flex-wrap:wrap">
        <span>📄 Рецептів: <b>${recipeCount ?? '—'}</b></span>
        <span>🚩 Скарг на цей рецепт: <b>${reportCount ?? '—'}</b></span>
        ${banHistory}
      </div>`;
  }

  openDrawer(name, `
    ${thumb}
    <a href="recipes.html?recipe=${recipe.id}" target="_blank" class="btn btn--sm btn--ghost" style="margin-bottom:8px;display:inline-flex">👁 Відкрити як користувач</a>
    ${kcalBlock}
    <p style="font-size:12px;color:var(--color-text-muted)">ID: ${recipe.id} · Статус: ${recipe.status}${recipe.category ? ` · ${recipe.category}` : ''}</p>
    ${authorHistoryBlock}
    ${ingredientsBlock}
    ${stepsBlock}
  `);
}
