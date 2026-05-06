// ============================================================
// admin-users.js — Секція 4: Користувачі (light)
// ============================================================

import { supabase } from './supabaseClient.js';
import {
  confirm, logAction, clearStatsCache,
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
    .select('id, full_name, email, is_admin, is_banned, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (_query) {
    query = query.or(`full_name.ilike.%${_query}%,email.ilike.%${_query}%`);
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

  // Отримуємо кількість рецептів для кожного
  const userIds = data.map(u => u.id);
  const { data: recipeCounts } = await supabase
    .from('recipes')
    .select('user_id')
    .in('user_id', userIds);

  const countMap = {};
  recipeCounts?.forEach(r => {
    countMap[r.user_id] = (countMap[r.user_id] || 0) + 1;
  });

  listEl.innerHTML = '';
  data.forEach((user) => {
    listEl.appendChild(_buildRow(user, countMap[user.id] || 0));
  });
}

function _buildRow(user, recipeCount) {
  const row = document.createElement('div');
  row.className = 'admin-user-row' + (user.is_banned ? ' admin-user-row--banned' : '');
  row.dataset.id = user.id;

  const name = user.full_name || user.email || user.id.slice(0, 8);

  row.innerHTML = `
    <div class="admin-user-row__info">
      <div class="admin-user-row__name">
        ${name}
        ${user.is_admin  ? '<span style="font-size:.7rem;background:var(--color-accent);color:#fff;border-radius:4px;padding:1px 5px;margin-left:4px">ADMIN</span>' : ''}
        ${user.is_banned ? '<span style="font-size:.7rem;background:#ef4444;color:#fff;border-radius:4px;padding:1px 5px;margin-left:4px">BANNED</span>' : ''}
      </div>
      <div class="admin-user-row__meta">
        <span>${user.email || '—'}</span>
        <span>Рецептів: ${recipeCount}</span>
        <span>З ${formatDate(user.created_at)}</span>
      </div>
    </div>
    <div class="admin-user-row__status"></div>
    <div class="admin-user-row__actions">
      ${user.is_banned
        ? `<button class="btn btn--sm btn--outline" data-action="unban">Розбан</button>`
        : `<button class="btn btn--sm btn--danger"  data-action="ban">Бан</button>`
      }
      <button class="btn btn--sm btn--ghost" data-action="toggle-admin" title="${user.is_admin ? 'Зняти права адміна' : 'Надати права адміна'}">
        ${user.is_admin ? '🔓 Admin' : '🔐 Admin'}
      </button>
      <button class="btn btn--sm btn--danger" data-action="delete" title="Видалити акаунт">🗑</button>
    </div>
  `;

  row.querySelector('[data-action="ban"]')?.addEventListener('click', () => _ban(user, row));
  row.querySelector('[data-action="unban"]')?.addEventListener('click', () => _unban(user, row));
  row.querySelector('[data-action="toggle-admin"]')?.addEventListener('click', () => _toggleAdmin(user, row));
  row.querySelector('[data-action="delete"]')?.addEventListener('click', () => _deleteUser(user, row));

  return row;
}

async function _ban(user, row) {
  const name = user.full_name || user.email || 'користувача';
  const ok = await confirm(
    'Забанити',
    `Акаунт "${name}" буде заблоковано. Всі published рецепти стануть draft.`,
    'Забанити'
  );
  if (!ok) return;

  await supabase.from('profiles').update({ is_banned: true }).eq('id', user.id);
  await supabase.from('recipes').update({ status: 'draft' }).eq('user_id', user.id).eq('status', 'published');
  await logAction('profiles', user.id, 'ban');

  clearStatsCache();
  await loadStats();
  await loadUsers();
}

async function _unban(user, row) {
  const ok = await confirm('Розбан', `Розблокувати "${user.full_name || user.email}"?`);
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
    `${action} права адміна для "${user.full_name || user.email}"?`
  );
  if (!ok) return;
  await supabase.from('profiles').update({ is_admin: newVal }).eq('id', user.id);
  await logAction('profiles', user.id, newVal ? 'grant_admin' : 'revoke_admin');
  await loadUsers();
}

async function _deleteUser(user, row) {
  const ok = await confirm(
    'Видалити акаунт',
    `Акаунт "${user.full_name || user.email}" та всі пов'язані дані будуть видалені. Цю дію не можна скасувати.`,
    'Видалити'
  );
  if (!ok) return;
  // Видаляємо профіль (каскадне видалення auth.user — через Supabase service role або тригер)
  await supabase.from('profiles').delete().eq('id', user.id);
  await logAction('profiles', user.id, 'delete_account');
  clearStatsCache();
  await loadStats();
  row.remove();
}
