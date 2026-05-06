// ============================================================
// admin-utils.js — спільні утиліти адмінки
// ============================================================

import { supabase } from './supabaseClient.js';
import { isAdmin } from './auth.js';

// ---- Admin guard ----

export async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return false;
  }
  const admin = await isAdmin();
  if (!admin) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ---- Confirmation modal ----

let _confirmResolve = null;

export function initConfirmModal() {
  document.getElementById('adminConfirmCancel')?.addEventListener('click', () => {
    _closeConfirm(false);
  });
  document.getElementById('adminConfirmOk')?.addEventListener('click', () => {
    _closeConfirm(true);
  });
  document.getElementById('adminConfirmOverlay')?.addEventListener('click', () => {
    _closeConfirm(false);
  });
}

export function confirm(title, text, okLabel = 'Підтвердити') {
  return new Promise((resolve) => {
    _confirmResolve = resolve;
    document.getElementById('adminConfirmTitle').textContent = title;
    document.getElementById('adminConfirmText').textContent = text;
    document.getElementById('adminConfirmOk').textContent = okLabel;
    document.getElementById('adminConfirmModal').hidden = false;
  });
}

function _closeConfirm(result) {
  document.getElementById('adminConfirmModal').hidden = true;
  if (_confirmResolve) {
    _confirmResolve(result);
    _confirmResolve = null;
  }
}

// ---- Drawer ----

export function openDrawer(title, bodyHTML) {
  document.getElementById('adminDrawerTitle').textContent = title;
  document.getElementById('adminDrawerBody').innerHTML = bodyHTML;
  document.getElementById('adminDrawer').hidden = false;
}

export function closeDrawer() {
  document.getElementById('adminDrawer').hidden = true;
}

export function initDrawer() {
  document.getElementById('adminDrawerClose')?.addEventListener('click', closeDrawer);
  document.getElementById('adminDrawerOverlay')?.addEventListener('click', closeDrawer);
}

// ---- Bulk select helper ----

export class BulkSelect {
  constructor({ listId, bulkId, countId }) {
    this._selected = new Set();
    this._listEl = document.getElementById(listId);
    this._bulkEl = document.getElementById(bulkId);
    this._countEl = document.getElementById(countId);
  }

  bind(checkbox, id) {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) this._selected.add(id);
      else this._selected.delete(id);
      this._update();
    });
  }

  get selected() { return [...this._selected]; }

  clear() {
    this._selected.clear();
    this._listEl?.querySelectorAll('input[type=checkbox]').forEach(cb => (cb.checked = false));
    this._update();
  }

  _update() {
    const n = this._selected.size;
    if (this._countEl) this._countEl.textContent = `${n} вибрано`;
    if (this._bulkEl) this._bulkEl.hidden = n === 0;
  }
}

// ---- Action logger ----

export async function logAction(targetTable, targetId, actionType, payload = null) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await supabase.from('admin_actions').insert({
    admin_id:     session.user.id,
    target_table: targetTable,
    target_id:    String(targetId),
    action_type:  actionType,
    payload,
  });
}

// ---- Misc ----

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function reportTypeLabel(type) {
  const map = {
    copyright:     'Авторські права',
    spam:          'Спам',
    inappropriate: 'Неприйнятний',
    incorrect:     'Некоректно',
    other:         'Інше',
  };
  return map[type] || type;
}

export function typePillHTML(type) {
  return `<span class="admin-type-pill admin-type-pill--${type}">${reportTypeLabel(type)}</span>`;
}

export function emptyState(message = 'Нічого немає') {
  return `<div class="admin-empty"><div class="admin-empty__icon">🌿</div><p>${message}</p></div>`;
}

export function skeletonList(count = 3) {
  return `<div class="admin-skeleton-list">${'<div class="admin-skeleton-card"></div>'.repeat(count)}</div>`;
}

// ---- Stats cache (5 хв у localStorage) ----

const STATS_CACHE_KEY = 'minto_admin_stats';
const STATS_TTL = 5 * 60 * 1000;

export function getCachedStats() {
  try {
    const raw = localStorage.getItem(STATS_CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > STATS_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

export function setCachedStats(data) {
  localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
}

export function clearStatsCache() {
  localStorage.removeItem(STATS_CACHE_KEY);
}
