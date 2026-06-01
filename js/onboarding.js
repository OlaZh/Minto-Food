// ============================================================
// onboarding.js — вибір нікнейму при першому вході
// ============================================================

import { supabase } from './supabaseClient.js';
import { iconVeg, iconCheck } from './icons.js';
import { showToast } from './utils.js';

const MIN = 2;
const MAX = 25;
const ALLOWED = /^[\p{L}\p{N} \-_.]{2,25}$/u;

let _resolveFn = null;
let _debounceTimer = null;
let _isValid = false;
let _suggested = '';

// ── Публічний метод ───────────────────────────────────────────

export async function checkOnboarding(user) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('display_name, welcome_seen_on')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('[onboarding] failed to load profile:', error.message);
    return;
  }

  if (profile?.welcome_seen_on || profile?.display_name) {
    return;
  }

  _suggested = await _generateNickname(user);

  return new Promise(resolve => {
    _resolveFn = resolve;
    _mount(_suggested);
  });
}

// ── Генерація нікнейму ────────────────────────────────────────

async function _generateNickname(user) {
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
  let base = fullName.split(/\s+/)[0] || ''; // перше слово імені

  // Якщо з Google прийшло "Прізвище Ім'я" (деякі провайдери) — берем перше слово
  if (!base || base.length < 2) {
    base = user.email?.split('@')[0]?.replace(/[^a-zA-Zа-яА-ЯїЇіІєЄ]/g, '') || '';
  }

  if (!base || base.length < 2) {
    base = 'Кухар';
  }

  // Перевіряємо чи вільне базове ім'я
  const candidate = await _firstFree(base);
  return candidate;
}

async function _firstFree(base) {
  // Спробуємо base, потім base2, base3 … base99
  const { count: c0 } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .ilike('display_name', base);

  if (!c0) return base;

  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}${i}`;
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .ilike('display_name', candidate);
    if (!count) return candidate;
  }

  return `${base}_${Math.floor(Math.random() * 9000 + 1000)}`;
}

// ── Монтування overlay ────────────────────────────────────────

function _mount(suggested) {
  if (document.getElementById('onboarding-overlay')) return;

  const style = document.createElement('style');
  style.textContent = `
    #onboarding-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(166,214,184,.88);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      animation: onb-fade .3s ease;
    }
    @keyframes onb-fade { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
    .onb-card {
      background: var(--color-surface); border-radius: 20px;
      padding: 36px 28px 28px; max-width: 400px; width: 100%;
      text-align: center; box-shadow: 0 12px 48px rgba(15,40,24,.18);
    }
    .onb-logo { font-size: 38px; margin-bottom: 2px; }
    .onb-brand { font-family: var(--font-logo); font-size: 20px; color: var(--color-text-primary); margin: 0 0 18px; }
    .onb-title { font-family: var(--font-heading); font-size: 18px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 6px; }
    .onb-sub { font-size: 13px; color: var(--color-text-secondary); margin: 0 0 22px; line-height: 1.5; }

    /* Пропозиція нікнейму */
    .onb-suggestion {
      background: var(--color-bg-secondary); border: 2px solid var(--color-accent); border-radius: 12px;
      padding: 14px 20px; margin-bottom: 20px;
    }
    .onb-suggestion__label { font-size: 11px; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
    .onb-suggestion__name { font-family: var(--font-heading); font-size: 22px; font-weight: 600; color: var(--color-text-primary); }

    .onb-actions { display: flex; gap: 8px; flex-direction: column; }
    .onb-btn-primary {
      width: 100%; padding: 13px; font-size: 15px; font-weight: 600;
      font-family: var(--font-body);
      background: var(--color-accent); color: var(--color-text-inverse);
      border: none; border-radius: 12px; cursor: pointer; transition: background .2s;
    }
    .onb-btn-primary:hover { background: var(--color-accent-hover); }
    .onb-btn-outline {
      width: 100%; padding: 11px; font-size: 14px; font-weight: 500;
      font-family: var(--font-body);
      background: transparent; color: var(--color-text-primary);
      border: 2px solid var(--color-border); border-radius: 12px; cursor: pointer; transition: border-color .2s;
    }
    .onb-btn-outline:hover { border-color: var(--color-accent); }
    .onb-btn-ghost {
      width: 100%; padding: 8px; font-size: 13px;
      font-family: var(--font-body);
      background: transparent; color: var(--color-text-secondary);
      border: none; cursor: pointer; transition: color .2s;
    }
    .onb-btn-ghost:hover { color: var(--color-text-primary); }

    /* Режим редагування */
    .onb-edit { display: none; }
    .onb-edit.onb-edit--visible { display: block; }
    .onb-input {
      width: 100%; padding: 12px 16px; font-size: 17px;
      font-family: var(--font-body); font-weight: 500;
      background: var(--color-bg-secondary);
      border: 2px solid var(--color-border); border-radius: 12px; outline: none;
      text-align: center; color: var(--color-text-primary); box-sizing: border-box;
      transition: border-color .2s; margin-bottom: 6px;
    }
    .onb-input:focus { border-color: var(--color-accent); }
    .onb-input--error { border-color: #e74c3c !important; }
    .onb-input--ok    { border-color: var(--color-accent) !important; }
    .onb-hint { font-size: 12px; min-height: 16px; margin-bottom: 14px; color: var(--color-text-secondary); }
    .onb-hint--error { color: #e74c3c; }
    .onb-hint--ok    { color: var(--color-accent); }
    .onb-save-btn {
      width: 100%; padding: 13px; font-size: 15px; font-weight: 600;
      font-family: var(--font-body);
      background: var(--color-accent); color: var(--color-text-inverse);
      border: none; border-radius: 12px; cursor: pointer; transition: background .2s;
    }
    .onb-save-btn:hover:not(:disabled) { background: var(--color-accent-hover); }
    .onb-save-btn:disabled { background: var(--color-border); cursor: not-allowed; }
    .onb-back { margin-top: 8px; font-size: 12px; color: var(--color-text-secondary); cursor: pointer; background: none; border: none; }
    .onb-back:hover { color: var(--color-text-primary); }
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.id = 'onboarding-overlay';
  wrap.innerHTML = `
    <div class="onb-card">
      <div class="onb-logo">${iconVeg}</div>
      <p class="onb-brand">Minto</p>

      <!-- Режим пропозиції -->
      <div id="onbSuggestView">
        <h2 class="onb-title">Ласкаво просимо!</h2>
        <p class="onb-sub">Ми підібрали тобі нікнейм.<br>Він буде видно під рецептами і в профілі.</p>
        <div class="onb-suggestion">
          <div class="onb-suggestion__label">Твій нікнейм</div>
          <div class="onb-suggestion__name" id="onbSuggestedName">${suggested}</div>
        </div>
        <div class="onb-actions">
          <button class="onb-btn-primary" id="onbAcceptBtn">Залишити</button>
          <button class="onb-btn-outline" id="onbEditBtn">Змінити зараз</button>
          <button class="onb-btn-ghost" id="onbLaterBtn">Пізніше</button>
        </div>
      </div>

      <!-- Режим редагування -->
      <div class="onb-edit" id="onbEditView">
        <h2 class="onb-title">Обери свій нікнейм</h2>
        <p class="onb-sub">Кирилиця, латиниця, цифри, пробіл, . - _</p>
        <input class="onb-input" id="onbInput" type="text"
          maxlength="${MAX}" autocomplete="off" autocorrect="off" spellcheck="false" />
        <p class="onb-hint" id="onbHint">від ${MIN} до ${MAX} символів</p>
        <button class="onb-save-btn" id="onbSaveBtn" disabled>Зберегти</button>
        <button class="onb-back" id="onbBackBtn">← Назад до пропозиції</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  _bindSuggestView();
}

// ── Кнопки першого екрану ─────────────────────────────────────

function _bindSuggestView() {
  document.getElementById('onbAcceptBtn')?.addEventListener('click', () => _save(_suggested));
  document.getElementById('onbLaterBtn')?.addEventListener('click', () => _dismiss());
  document.getElementById('onbEditBtn')?.addEventListener('click', _showEditView);
}

function _showEditView() {
  document.getElementById('onbSuggestView').style.display = 'none';
  const editView = document.getElementById('onbEditView');
  editView.classList.add('onb-edit--visible');

  const input = document.getElementById('onbInput');
  input.value = _suggested;
  input.select();
  input.focus();

  _bindEditView();
}

// ── Режим редагування ─────────────────────────────────────────

function _bindEditView() {
  const input = document.getElementById('onbInput');
  const hint  = document.getElementById('onbHint');
  const btn   = document.getElementById('onbSaveBtn');

  // Відразу перевіряємо suggested як початкове значення
  _checkUnique(_suggested, true);

  input.addEventListener('input', () => {
    const val = input.value.trim();
    _isValid = false;
    btn.disabled = true;
    input.classList.remove('onb-input--error', 'onb-input--ok');

    if (!val) { _hint(hint, `від ${MIN} до ${MAX} символів`, ''); return; }
    if (val.length < MIN) { _hint(hint, `Мінімум ${MIN} символи`, 'error'); input.classList.add('onb-input--error'); return; }
    if (!ALLOWED.test(val)) { _hint(hint, 'Тільки літери, цифри, пробіл, . - _', 'error'); input.classList.add('onb-input--error'); return; }

    _hint(hint, 'Перевіряємо…', '');
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => _checkUnique(val), 450);
  });

  btn.addEventListener('click', () => {
    const val = document.getElementById('onbInput')?.value.trim();
    if (_isValid && val) _save(val);
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !btn.disabled) btn.click(); });

  document.getElementById('onbBackBtn')?.addEventListener('click', () => {
    document.getElementById('onbEditView').classList.remove('onb-edit--visible');
    document.getElementById('onbSuggestView').style.display = '';
  });
}

async function _checkUnique(val, silent = false) {
  const input = document.getElementById('onbInput');
  const hint  = document.getElementById('onbHint');
  const btn   = document.getElementById('onbSaveBtn');
  if (!input) return;

  const { data: { user } } = await supabase.auth.getUser();

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .ilike('display_name', val)
    .neq('id', user?.id ?? '');

  if (input.value.trim() !== val && !silent) return;

  if (count > 0) {
    if (!silent) {
      _hint(hint, 'Це ім\'я вже зайняте, спробуй інше', 'error');
      input.classList.add('onb-input--error');
    }
    _isValid = false;
    if (btn) btn.disabled = true;
  } else {
    if (!silent) {
      _hint(hint, 'Це ім\'я вільне', 'ok');
      input.classList.add('onb-input--ok');
    }
    _isValid = true;
    if (btn) btn.disabled = false;
  }
}

// ── Збереження ────────────────────────────────────────────────

async function _save(displayName) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const payload = {
    id: user.id,
    display_name: displayName,
    welcome_seen_on: new Date().toISOString().slice(0, 10),
  };

  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('[onboarding] failed to save nickname:', error);
    showToast('Не вдалося зберегти нікнейм. Спробуйте ще раз.', 'error');
    return;
  }

  document.getElementById('onboarding-overlay')?.remove();
  _resolveFn?.();
}

async function _dismiss() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      welcome_seen_on: new Date().toISOString().slice(0, 10),
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.error('[onboarding] failed to dismiss welcome:', error);
    showToast('Не вдалося закрити вітання. Спробуйте ще раз.', 'error');
    return;
  }

  document.getElementById('onboarding-overlay')?.remove();
  _resolveFn?.();
}

function _hint(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = 'onb-hint' + (type ? ` onb-hint--${type}` : '');
}
