// ============================================================
// admin-users.js — Секція 4: Користувачі (light)
// ============================================================

import { supabase } from './supabaseClient.js';
import {
  confirm, confirmWithReason, withUndo, logAction, clearStatsCache,
  formatDate, emptyState, skeletonList,
} from './admin-utils.js';
import { loadStats } from './admin-stats.js';

let _searchTimer = null;
let _query = '';

export async function initUsers() {
  document.getElementById('searchUsers')?.addEventListener('input', (e) => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      _query = e.target.value.trim();
      loadUsers();
    }, 300);
  });

  await loadUsers();
}

export async function loadUsers() {
  const listEl = document.getElementById('usersList');
  if (!listEl) return;
  listEl.innerHTML = skeletonList(3);

  let query = supabase
    .from('profiles')
    .select('id, full_name, is_admin, is_banned, is_shadow_banned, strikes, freeze_until, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (_query) {
    query = query.ilike('full_name', `%${_query}%`);
  }

  const { data, error } = await query;

  if (error) {
    listEl.innerHTML = `<p style="color:var(--color-danger)">Помилка: ${error.message}</p>`;
    return;
  }

  if (!data?.length) {
    listEl.innerHTML = emptyState('Юзерів не знайдено');
    return;
  }

  const userIds = data.map(u => u.id);

  const [{ data: recipeCounts }, { data: mealRows }] = await Promise.all([
    supabase.from('recipes').select('user_id').in('user_id', userIds),
    supabase.from('meals').select('user_id, created_at').in('user_id', userIds).order('created_at', { ascending: false }),
  ]);

  const countMap = {};
  recipeCounts?.forEach(r => {
    countMap[r.user_id] = (countMap[r.user_id] || 0) + 1;
  });

  const lastActiveMap = {};
  mealRows?.forEach(m => {
    if (!lastActiveMap[m.user_id]) lastActiveMap[m.user_id] = m.created_at;
  });

  listEl.innerHTML = '';
  data.forEach((user) => {
    listEl.appendChild(_buildRow(user, countMap[user.id] || 0, lastActiveMap[user.id] || null));
  });
}

function _buildRow(user, recipeCount, lastActive) {
  const row = document.createElement('div');
  const isFrozen = user.freeze_until && new Date(user.freeze_until) > new Date();
  row.className = 'admin-user-row'
    + (user.is_banned        ? ' admin-user-row--banned' : '')
    + (user.is_shadow_banned ? ' admin-user-row--shadow' : '')
    + (isFrozen              ? ' admin-user-row--frozen'  : '');
  row.dataset.id = user.id;

  const name = user.full_name || user.id.slice(0, 8);
  const strikesHtml = (user.strikes || 0) > 0
    ? `<span class="admin-strike-badge" title="Страйки">${'⚡'.repeat(Math.min(user.strikes, 3))} ${user.strikes} страйк${user.strikes > 1 ? 'и' : ''}</span>`
    : '';

  row.innerHTML = `
    <div class="admin-user-row__info">
      <div class="admin-user-row__name">
        ${name}
        ${user.is_admin        ? '<span class="admin-user-badge admin-user-badge--admin">ADMIN</span>' : ''}
        ${user.is_banned       ? '<span class="admin-user-badge admin-user-badge--banned">BANNED</span>' : ''}
        ${user.is_shadow_banned? '<span class="admin-user-badge admin-user-badge--shadow">SHADOW</span>' : ''}
        ${isFrozen             ? '<span class="admin-user-badge admin-user-badge--frozen">FREEZE</span>' : ''}
        ${strikesHtml}
      </div>
      <div class="admin-user-row__meta">
        <span>Рецептів: ${recipeCount}</span>
        <span>З ${formatDate(user.created_at)}</span>
        <span>Остання активність: ${lastActive ? formatDate(lastActive) : '—'}</span>
        ${isFrozen ? `<span style="color:#f59e0b">Заморожений до ${formatDate(user.freeze_until)}</span>` : ''}
      </div>
    </div>
    <div class="admin-user-row__actions">
      ${user.is_banned
        ? `<button class="btn btn--sm btn--outline" data-action="unban">Розбан</button>`
        : `<button class="btn btn--sm btn--danger"  data-action="ban">Бан</button>`
      }
      <button class="btn btn--sm btn--outline" data-action="strike" title="Видати страйк (+1)">⚡ Страйк</button>
      <button class="btn btn--sm btn--ghost" data-action="shadow-ban"
        title="${user.is_shadow_banned ? 'Зняти shadow ban' : 'Shadow ban — нові рецепти авто-на модерацію'}">
        ${user.is_shadow_banned ? '👁 Зняти тінь' : '👁 Shadow'}
      </button>
      <button class="btn btn--sm btn--ghost" data-action="toggle-admin"
        title="${user.is_admin ? 'Зняти права адміна' : 'Надати права адміна'}">
        ${user.is_admin ? '🔓 Admin' : '🔐 Admin'}
      </button>
      <button class="btn btn--sm btn--danger" data-action="delete" title="Видалити акаунт">🗑</button>
    </div>
  `;

  row.querySelector('[data-action="ban"]')?.addEventListener('click', () => _ban(user, row));
  row.querySelector('[data-action="unban"]')?.addEventListener('click', () => _unban(user, row));
  row.querySelector('[data-action="strike"]')?.addEventListener('click', () => _addStrike(user, row));
  row.querySelector('[data-action="shadow-ban"]')?.addEventListener('click', () => _toggleShadowBan(user, row));
  row.querySelector('[data-action="toggle-admin"]')?.addEventListener('click', () => _toggleAdmin(user, row));
  row.querySelector('[data-action="delete"]')?.addEventListener('click', () => _deleteUser(user, row));

  return row;
}

async function _ban(user, row) {
  const name = user.full_name || user.id.slice(0, 8) || 'користувача';
  const result = await confirmWithReason(
    'Забанити',
    `Акаунт "${name}" буде заблоковано. Всі published рецепти стануть draft.`,
    'Забанити'
  );
  if (!result) return;
  await withUndo(`Юзера "${name}" забанено`, async () => {
    await supabase.from('profiles').update({ is_banned: true }).eq('id', user.id);
    await supabase.from('recipes').update({ status: 'draft' }).eq('user_id', user.id).eq('status', 'published');
    await logAction('profiles', user.id, 'ban', { reason: result.reason, comment: result.comment });
    clearStatsCache(); await loadStats(); await loadUsers();
  });
}
async function _unban(user, row) {
  const ok = await confirm('Розбан', `Розблокувати "${user.full_name || user.id.slice(0, 8)}"?`);
  if (!ok) return;
  await supabase.from('profiles').update({ is_banned: false }).eq('id', user.id);
  await logAction('profiles', user.id, 'unban');
  await loadUsers();
}

async function _toggleAdmin(user, row) {
  const newVal = !user.is_admin;
  const action = newVal ? 'надати' : 'зняти';
  const ok = await confirm(
    `${newVal ? 'Надати' : 'Зняти'} права адміна`,
    `${action} права адміна для "${user.full_name || user.id.slice(0, 8)}"?`
  );
  if (!ok) return;
  await supabase.from('profiles').update({ is_admin: newVal }).eq('id', user.id);
  await logAction('profiles', user.id, newVal ? 'grant_admin' : 'revoke_admin');
  await loadUsers();
}

async function _deleteUser(user, row) {
  const result = await confirmWithReason(
    'Видалити акаунт',
    `Акаунт "${user.full_name || user.id.slice(0, 8)}" та всі пов'язані дані будуть видалені назавжди.`,
    'Видалити'
  );
  if (!result) return;
  await withUndo(`Акаунт "${user.full_name || user.id.slice(0, 8)}" видалено`, async () => {
    await supabase.from('profiles').delete().eq('id', user.id);
    await logAction('profiles', user.id, 'delete_account', { reason: result.reason, comment: result.comment });
    clearStatsCache(); await loadStats(); row.remove();
  });
}

async function _addStrike(user, row) {
  const name = user.full_name || user.id.slice(0, 8);
  const newStrikes = (user.strikes || 0) + 1;

  const effects = newStrikes === 1
    ? 'Перший страйк — попередження.'
    : newStrikes === 2
      ? 'Другий страйк — акаунт буде заморожений на 24 год.'
      : `Третій страйк — акаунт буде автоматично забанений.`;

  const ok = await confirm('Видати страйк', `${name}: ${effects}`, 'Видати страйк');
  if (!ok) return;

  const update = { strikes: newStrikes };
  if (newStrikes === 2) {
    update.freeze_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }
  if (newStrikes >= 3) {
    update.is_banned = true;
    await supabase.from('recipes').update({ status: 'draft' }).eq('user_id', user.id).eq('status', 'published');
  }

  await supabase.from('profiles').update(update).eq('id', user.id);
  await logAction('profiles', user.id, 'strike', { strikes: newStrikes, auto_ban: newStrikes >= 3 });
  clearStatsCache();
  await loadStats();
  await loadUsers();
}

async function _toggleShadowBan(user, row) {
  const name = user.full_name || user.id.slice(0, 8);
  const newVal = !user.is_shadow_banned;
  const action = newVal
    ? 'Shadow ban — нові рецепти автоматично йтимуть на модерацію. Юзер не знає.'
    : `Зняти shadow ban з "${name}".`;

  const ok = await confirm(newVal ? 'Shadow ban' : 'Зняти shadow ban', action, newVal ? 'Shadow ban' : 'Зняти');
  if (!ok) return;

  await supabase.from('profiles').update({ is_shadow_banned: newVal }).eq('id', user.id);
  await logAction('profiles', user.id, newVal ? 'shadow_ban' : 'shadow_unban');
  await loadUsers();
}
