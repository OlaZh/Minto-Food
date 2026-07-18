// ============================================================
// onboarding-wizard.js — goal-setup wizard (3 кроки) для нового юзера
// ============================================================
//
// Показується ОДИН РАЗ після вибору нікнейму, якщо профіль ще не
// заповнений. 3 кроки: ціль → параметри тіла → рівень активності →
// авто-розрахунок норми + збереження в user_profiles.
//
// КРИТИЧНО: розрахунок норми йде через спільний health-core
// (calcDailyNorm) — той самий, що в profile.js. Жодного дубля формули
// (див. docs/minto-food-fit-shared-health-plan.md, Ризик 3).
//
// Значення data-value СУМІСНІ з селектами профілю:
//   goal: lose | maintain | gain
//   activity: 1.2 | 1.375 | 1.55 | 1.725   (числовий множник)
//   gender: female | male

import { supabase } from './supabaseClient.js';
import { t, formatText } from './i18n-apply.js';
import { calcDailyNorm } from './health-core.js';
import { saveProfileFields } from './profile-flags.js';
import { setButtonLoading } from './utils.js';

// Кроки wizard. Значення дзеркалять профіль, лейбли беруться з i18n.
const GOALS = [
  { value: 'lose', emoji: '🔻', key: 'goalLose' },
  { value: 'maintain', emoji: '⚖️', key: 'goalMaintain' },
  { value: 'gain', emoji: '🔺', key: 'goalGain' },
];

const ACTIVITIES = [
  { value: '1.2', key: 'activityNoneFull' },
  { value: '1.375', key: 'activityLight' },
  { value: '1.55', key: 'activityMedium' },
  { value: '1.725', key: 'activityHard' },
];

// Накопичений стан wizard.
const _state = { goal: null, gender: 'female', age: null, height: null, weight: null, activity: null };
let _resolveFn = null;
let _userId = null;

// ── Чи треба показувати wizard ────────────────────────────────
// Профіль вважаємо заповненим, якщо є базові параметри (age+height+weight).
// Пропуск зберігається в profiles.goal_wizard_skipped (в акаунті, не в
// localStorage) — як welcome_intro_seen, щоб не залежати від пристрою
// і чистки кешу. Заповнити параметри можна будь-коли в профілі.
export async function needsGoalSetup(userId) {
  const { data: flags } = await supabase
    .from('profiles')
    .select('goal_wizard_skipped')
    .eq('id', userId)
    .maybeSingle();
  if (flags?.goal_wizard_skipped) return false;

  const { data } = await supabase
    .from('user_profiles')
    .select('age, height, weight')
    .eq('user_id', userId)
    .maybeSingle();
  return !(data && data.age && data.height && data.weight);
}

// ── Публічний вхід ────────────────────────────────────────────
export function startGoalWizard(userId) {
  return new Promise((resolve) => {
    _resolveFn = resolve;
    _userId = userId;
    _mount();
    _renderStep(1);
  });
}

// ── Монтування overlay ────────────────────────────────────────
function _mount() {
  if (document.getElementById('onbw-overlay')) return;

  const style = document.createElement('style');
  style.id = 'onbw-style';
  style.textContent = `
    #onbw-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(166,214,184,.88); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center; padding: 20px;
      animation: onbw-fade .3s ease;
    }
    @keyframes onbw-fade { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
    .onbw-card {
      background: var(--color-surface); border-radius: 20px;
      padding: 30px 28px 26px; max-width: 420px; width: 100%;
      box-shadow: 0 12px 48px rgba(15,40,24,.18);
    }
    .onbw-progress { display:flex; gap:6px; justify-content:center; margin-bottom:22px; }
    .onbw-dot { width:28px; height:4px; border-radius:2px; background:var(--color-border); transition:background .25s; }
    .onbw-dot--active { background:var(--color-accent); }
    .onbw-title { font-family: var(--font-heading); font-size:19px; font-weight:600; color:var(--color-text-primary); text-align:center; margin:0 0 6px; }
    .onbw-sub { font-size:13px; color:var(--color-text-secondary); text-align:center; margin:0 0 22px; line-height:1.5; }
    .onbw-options { display:flex; flex-direction:column; gap:10px; margin-bottom:22px; }
    .onbw-option {
      display:flex; align-items:center; gap:12px; width:100%; padding:14px 16px;
      background:var(--color-bg-secondary); border:2px solid var(--color-border);
      border-radius:12px; cursor:pointer; font-family:var(--font-body); font-size:15px;
      color:var(--color-text-primary); text-align:left; transition:border-color .2s, background .2s;
    }
    .onbw-option:hover { border-color:var(--color-accent); }
    .onbw-option--active { border-color:var(--color-accent); background:var(--color-accent-soft); }
    .onbw-option__emoji { font-size:22px; }
    .onbw-fields { display:flex; flex-direction:column; gap:14px; margin-bottom:22px; }
    .onbw-field { display:flex; flex-direction:column; gap:5px; }
    .onbw-field__label { font-size:12px; color:var(--color-text-secondary); }
    .onbw-input {
      width:100%; padding:12px 16px; font-size:16px; font-family:var(--font-body);
      background:var(--color-bg-secondary); border:2px solid var(--color-border);
      border-radius:12px; outline:none; color:var(--color-text-primary); box-sizing:border-box;
      transition:border-color .2s;
    }
    .onbw-input:focus { border-color:var(--color-accent); }
    .onbw-gender { display:flex; gap:8px; }
    .onbw-gender__btn {
      flex:1; padding:11px; font-family:var(--font-body); font-size:14px; cursor:pointer;
      background:var(--color-bg-secondary); border:2px solid var(--color-border);
      border-radius:12px; color:var(--color-text-primary); transition:border-color .2s, background .2s;
    }
    .onbw-gender__btn--active { border-color:var(--color-accent); background:var(--color-accent-soft); }
    .onbw-actions { display:flex; gap:8px; }
    .onbw-btn-primary {
      flex:1; padding:13px; font-size:15px; font-weight:600; font-family:var(--font-body);
      background:var(--color-accent); color:var(--color-text-inverse);
      border:none; border-radius:12px; cursor:pointer; transition:background .2s;
    }
    .onbw-btn-primary:hover:not(:disabled) { background:var(--color-accent-hover); }
    .onbw-btn-primary:disabled { background:var(--color-border); cursor:not-allowed; }
    .onbw-btn-back {
      padding:13px 18px; font-size:14px; font-family:var(--font-body);
      background:transparent; color:var(--color-text-secondary);
      border:2px solid var(--color-border); border-radius:12px; cursor:pointer; transition:border-color .2s;
    }
    .onbw-btn-back:hover { border-color:var(--color-accent); }
    .onbw-skip {
      width:100%; margin-top:12px; padding:8px; font-size:13px; font-family:var(--font-body);
      background:transparent; border:none; color:var(--color-text-secondary); cursor:pointer; transition:color .2s;
    }
    .onbw-skip:hover { color:var(--color-text-primary); }
    /* Підсумок норми */
    .onbw-norm { display:flex; flex-direction:column; gap:10px; margin-bottom:22px; }
    .onbw-norm__cal {
      text-align:center; padding:18px; background:var(--color-accent-soft);
      border-radius:14px;
    }
    .onbw-norm__cal-num { font-family:var(--font-heading); font-size:34px; font-weight:700; color:var(--color-text-primary); }
    .onbw-norm__cal-label { font-size:12px; color:var(--color-text-secondary); text-transform:uppercase; letter-spacing:.05em; }
    .onbw-norm__macros { display:flex; gap:8px; }
    .onbw-norm__macro { flex:1; text-align:center; padding:12px 6px; background:var(--color-bg-secondary); border-radius:12px; }
    .onbw-norm__macro-num { font-family:var(--font-heading); font-size:18px; font-weight:600; color:var(--color-text-primary); }
    .onbw-norm__macro-label { font-size:11px; color:var(--color-text-secondary); }
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.id = 'onbw-overlay';
  wrap.innerHTML = `<div class="onbw-card" id="onbw-card"></div>`;
  document.body.appendChild(wrap);
}

function _progressHTML(step) {
  return `<div class="onbw-progress">
    ${[1, 2, 3].map((n) => `<div class="onbw-dot ${n <= step ? 'onbw-dot--active' : ''}"></div>`).join('')}
  </div>`;
}

// ── Рендер кроків ─────────────────────────────────────────────
function _renderStep(step) {
  const card = document.getElementById('onbw-card');
  if (!card) return;
  if (step === 1) _renderGoal(card);
  else if (step === 2) _renderParams(card);
  else if (step === 3) _renderActivity(card);

  card.insertAdjacentHTML('beforeend', `<button class="onbw-skip" id="onbw-skip">${t('onbwSkip')}</button>`);
  card.querySelector('#onbw-skip').addEventListener('click', _skip);
}

async function _skip() {
  // Спершу закриваємо (пропуск має бути миттєвим), потім пишемо прапор.
  const userId = _userId;
  _close();
  if (userId) await saveProfileFields(userId, { goal_wizard_skipped: true });
}

// Крок 1 — ціль
function _renderGoal(card) {
  card.innerHTML = `
    ${_progressHTML(1)}
    <h2 class="onbw-title">${t('onbwGoalTitle')}</h2>
    <p class="onbw-sub">${t('onbwGoalSub')}</p>
    <div class="onbw-options">
      ${GOALS.map((g) => `
        <button class="onbw-option ${_state.goal === g.value ? 'onbw-option--active' : ''}" data-goal="${g.value}">
          <span class="onbw-option__emoji">${g.emoji}</span><span>${t(g.key)}</span>
        </button>`).join('')}
    </div>
  `;
  card.querySelectorAll('[data-goal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _state.goal = btn.dataset.goal;
      _renderStep(2);
    });
  });
}

// Крок 2 — параметри тіла
function _renderParams(card) {
  card.innerHTML = `
    ${_progressHTML(2)}
    <h2 class="onbw-title">${t('onbwParamsTitle')}</h2>
    <p class="onbw-sub">${t('onbwParamsSub')}</p>
    <div class="onbw-gender">
      <button class="onbw-gender__btn ${_state.gender === 'female' ? 'onbw-gender__btn--active' : ''}" data-gender="female">${t('female')}</button>
      <button class="onbw-gender__btn ${_state.gender === 'male' ? 'onbw-gender__btn--active' : ''}" data-gender="male">${t('male')}</button>
    </div>
    <div class="onbw-fields" style="margin-top:14px;">
      <div class="onbw-field">
        <label class="onbw-field__label">${t('age')}</label>
        <input class="onbw-input" id="onbw-age" type="number" inputmode="numeric" min="10" max="120" value="${_state.age ?? ''}" />
      </div>
      <div class="onbw-field">
        <label class="onbw-field__label">${t('height')} (${t('cmUnit')})</label>
        <input class="onbw-input" id="onbw-height" type="number" inputmode="numeric" min="100" max="250" value="${_state.height ?? ''}" />
      </div>
      <div class="onbw-field">
        <label class="onbw-field__label">${t('weight')} (${t('kgUnit')})</label>
        <input class="onbw-input" id="onbw-weight" type="number" inputmode="decimal" min="30" max="400" value="${_state.weight ?? ''}" />
      </div>
    </div>
    <div class="onbw-actions">
      <button class="onbw-btn-back" id="onbw-back">${t('onbwBack')}</button>
      <button class="onbw-btn-primary" id="onbw-next" disabled>${t('onbwNext')}</button>
    </div>
  `;

  card.querySelectorAll('[data-gender]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _state.gender = btn.dataset.gender;
      card.querySelectorAll('[data-gender]').forEach((b) =>
        b.classList.toggle('onbw-gender__btn--active', b === btn));
    });
  });

  const ageEl = card.querySelector('#onbw-age');
  const heightEl = card.querySelector('#onbw-height');
  const weightEl = card.querySelector('#onbw-weight');
  const nextBtn = card.querySelector('#onbw-next');

  const validate = () => {
    const age = +ageEl.value, height = +heightEl.value, weight = +weightEl.value;
    const ok = age >= 10 && age <= 120 && height >= 100 && height <= 250 && weight >= 30 && weight <= 400;
    nextBtn.disabled = !ok;
    return ok;
  };
  [ageEl, heightEl, weightEl].forEach((el) => el.addEventListener('input', validate));
  validate();

  card.querySelector('#onbw-back').addEventListener('click', () => _renderStep(1));
  nextBtn.addEventListener('click', () => {
    if (!validate()) return;
    _state.age = +ageEl.value;
    _state.height = +heightEl.value;
    _state.weight = +weightEl.value;
    _renderStep(3);
  });
}

// Крок 3 — активність + підсумок норми + збереження
function _renderActivity(card) {
  card.innerHTML = `
    ${_progressHTML(3)}
    <h2 class="onbw-title">${t('onbwActivityTitle')}</h2>
    <p class="onbw-sub">${t('onbwActivitySub')}</p>
    <div class="onbw-options" id="onbw-act-options">
      ${ACTIVITIES.map((a) => `
        <button class="onbw-option ${_state.activity === a.value ? 'onbw-option--active' : ''}" data-activity="${a.value}">
          <span>${t(a.key)}</span>
        </button>`).join('')}
    </div>
    <div id="onbw-norm-wrap"></div>
    <div class="onbw-actions">
      <button class="onbw-btn-back" id="onbw-back">${t('onbwBack')}</button>
      <button class="onbw-btn-primary" id="onbw-finish" disabled>${t('onbwFinish')}</button>
    </div>
  `;

  const finishBtn = card.querySelector('#onbw-finish');
  const normWrap = card.querySelector('#onbw-norm-wrap');

  card.querySelectorAll('[data-activity]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _state.activity = btn.dataset.activity;
      card.querySelectorAll('[data-activity]').forEach((b) =>
        b.classList.toggle('onbw-option--active', b === btn));
      // Живий перерахунок норми при виборі активності.
      const norm = calcDailyNorm(_state);
      normWrap.innerHTML = `
        <div class="onbw-norm">
          <div class="onbw-norm__cal">
            <div class="onbw-norm__cal-num">${norm.calories}</div>
            <div class="onbw-norm__cal-label">${t('dailyNorm')} · ${t('kcalShort')}</div>
          </div>
          <div class="onbw-norm__macros">
            <div class="onbw-norm__macro"><div class="onbw-norm__macro-num">${norm.protein}</div><div class="onbw-norm__macro-label">${t('proteins')}</div></div>
            <div class="onbw-norm__macro"><div class="onbw-norm__macro-num">${norm.fat}</div><div class="onbw-norm__macro-label">${t('fats')}</div></div>
            <div class="onbw-norm__macro"><div class="onbw-norm__macro-num">${norm.carbs}</div><div class="onbw-norm__macro-label">${t('carbsFull')}</div></div>
          </div>
        </div>`;
      finishBtn.disabled = false;
    });
  });

  card.querySelector('#onbw-back').addEventListener('click', () => _renderStep(2));
  finishBtn.addEventListener('click', () => _finish(finishBtn));
}

// ── Збереження ────────────────────────────────────────────────
async function _finish(btn) {
  if (!_state.activity) return;
  setButtonLoading(btn, true, t('nickSaving')); // «Збереження…» — переюз наявного ключа

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { _close(); return; }

  const norm = calcDailyNorm(_state);
  const payload = {
    user_id: user.id,
    name: user.user_metadata?.full_name || user.user_metadata?.name || '',
    email: user.email || '',
    age: _state.age,
    height: _state.height,
    weight: _state.weight,
    gender: _state.gender,
    activity: _state.activity,
    goal: _state.goal,
    calories: norm.calories,
    protein: norm.protein,
    fat: norm.fat,
    carbs: norm.carbs,
    water: norm.water,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
  if (error) console.error('[onboarding-wizard] save failed:', error);

  _close();
}

function _close() {
  document.getElementById('onbw-overlay')?.remove();
  document.getElementById('onbw-style')?.remove();
  _resolveFn?.();
}
