// ============================================================
// admin-utils.js — спільні утиліти адмінки
// ============================================================

import { supabase } from './supabaseClient.js';

// ---- Admin guard ----

export async function requireAdmin() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return false;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (error || !data?.is_admin) {
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

// ---- Confirmation з причиною модерації ----

const MOD_REASONS = [
  { value: 'nsfw',                 label: 'NSFW' },
  { value: 'spam',                 label: 'Спам' },
  { value: 'scam',                 label: 'Шахрайство' },
  { value: 'hate_speech',          label: 'Мова ненависті' },
  { value: 'copyright',            label: 'Авторські права' },
  { value: 'misinformation',       label: 'Небезпечна дезінформація' },
  { value: 'inappropriate_content',label: 'Неприйнятний вміст' },
  { value: 'suspicious_links',     label: 'Підозрілі посилання' },
  { value: 'bot_activity',         label: 'Активність бота' },
  { value: 'other',                label: 'Інше' },
];

export function confirmWithReason(title, text, okLabel = 'Підтвердити') {
  return new Promise((resolve) => {
    const options = MOD_REASONS.map(r =>
      `<option value="${r.value}">${r.label}</option>`
    ).join('');

    const wrapper = document.createElement('div');
    wrapper.id = 'adminReasonModal';
    wrapper.style.cssText = 'position:fixed;inset:0;z-index:1100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)';
    wrapper.innerHTML = `
      <div style="background:var(--color-bg-primary);border-radius:16px;padding:28px;width:400px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,.2)">
        <h3 style="margin:0 0 8px;font-size:1rem">${title}</h3>
        <p style="margin:0 0 16px;font-size:.875rem;color:var(--color-text-secondary)">${text}</p>
        <label style="font-size:.8125rem;font-weight:600;display:block;margin-bottom:4px">Причина</label>
        <select id="adminReasonSelect" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-surface);color:var(--color-text-primary);font-size:.875rem;margin-bottom:16px">
          ${options}
        </select>
        <label style="font-size:.8125rem;font-weight:600;display:block;margin-bottom:4px">Коментар (необов'язково)</label>
        <textarea id="adminReasonComment" rows="2" placeholder="Додаткові деталі..." style="width:100%;box-sizing:border-box;padding:8px 12px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-surface);color:var(--color-text-primary);font-size:.875rem;resize:vertical;margin-bottom:20px"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="adminReasonCancel" class="btn btn--sm btn--ghost">Скасувати</button>
          <button id="adminReasonOk" class="btn btn--sm btn--danger">${okLabel}</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);

    const close = (confirmed) => {
      const reason = confirmed ? document.getElementById('adminReasonSelect')?.value : null;
      const comment = confirmed ? document.getElementById('adminReasonComment')?.value.trim() : null;
      wrapper.remove();
      resolve(confirmed ? { reason, comment } : null);
    };

    wrapper.querySelector('#adminReasonOk').addEventListener('click', () => close(true));
    wrapper.querySelector('#adminReasonCancel').addEventListener('click', () => close(false));
    wrapper.addEventListener('click', (e) => { if (e.target === wrapper) close(false); });
  });
}

// ---- Undo (відкладена дія) ----

export function withUndo(label, action, delay = 5000) {
  return new Promise((resolve) => {
    let cancelled = false;
    let timer = null;

    const toast = document.createElement('div');
    toast.className = 'admin-undo-toast';
    toast.innerHTML = `
      <span class="admin-undo-toast__text">${label}</span>
      <div class="admin-undo-toast__bar"><div class="admin-undo-toast__fill"></div></div>
      <button class="admin-undo-toast__btn">Скасувати</button>
    `;
    document.body.appendChild(toast);

    const fill = toast.querySelector('.admin-undo-toast__fill');
    fill.style.transition = `width ${delay}ms linear`;
    requestAnimationFrame(() => { fill.style.width = '0%'; });

    toast.querySelector('.admin-undo-toast__btn').addEventListener('click', () => {
      cancelled = true;
      clearTimeout(timer);
      toast.remove();
      resolve(false);
    });

    timer = setTimeout(async () => {
      toast.remove();
      if (!cancelled) {
        await action();
        resolve(true);
      }
    }, delay);
  });
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

  get selected() {
    return [...this._selected];
  }

  clear() {
    this._selected.clear();
    this._listEl?.querySelectorAll('input[type=checkbox]').forEach((cb) => (cb.checked = false));
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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  await supabase.from('admin_actions').insert({
    admin_id: session.user.id,
    target_table: targetTable,
    target_id: String(targetId),
    action_type: actionType,
    payload,
  });
}

// ---- Misc ----

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function reportTypeLabel(type) {
  const map = {
    copyright:             'Авторські права',
    spam:                  'Спам',
    inappropriate:         'Неприйнятний вміст',
    incorrect:             'Некоректна інформація',
    nsfw:                  'NSFW',
    scam:                  'Шахрайство',
    hate_speech:           'Мова ненависті',
    misinformation:        'Небезпечна дезінформація',
    inappropriate_content: 'Неприйнятний вміст',
    suspicious_links:      'Підозрілі посилання',
    bot_activity:          'Активність бота',
    other:                 'Інше',
  };
  return map[type] || type;
}

export function parseReason(raw = '') {
  const colonIdx = raw.indexOf(': ');
  if (colonIdx === -1) return { type: raw, comment: '' };
  return { type: raw.slice(0, colonIdx), comment: raw.slice(colonIdx + 2) };
}

export function typePillHTML(raw = '') {
  const { type } = parseReason(raw);
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
