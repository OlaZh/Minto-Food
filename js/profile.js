// =====================================
// PROFILE — SUPABASE + AUTH VERSION
// =====================================

import { supabase } from './supabaseClient.js';
import { initAuth, requireAuth, getCurrentUser, openAuthModal } from './auth.js';

const form = document.getElementById('profileForm');

const resultEl = document.getElementById('dailyCalories');
const normProteinEl = document.getElementById('normProtein');
const normFatEl = document.getElementById('normFat');
const normCarbsEl = document.getElementById('normCarbs');
const normWaterEl = document.getElementById('normWater');

const genderInput = document.getElementById('genderInput');
const activityInput = document.getElementById('activityInput');
const goalInput = document.getElementById('goalInput');

const bmiValueEl = document.getElementById('bmiValue');
const bmiStatusEl = document.getElementById('bmiStatus');
const bmiPointer = document.getElementById('bmiPointer');
const bmiAdviceEl = document.getElementById('bmiAdvice');

const targetWeightInput = document.getElementById('targetWeight');
const weightNowInput = document.getElementById('currentWeightInput');
const recordWeightBtn = document.getElementById('saveWeightBtn');

const WEIGHT_HISTORY_KEY = 'weightHistory';

let weightChart = null;

// =====================================
// CUSTOM SELECTS
// =====================================

function setupCustomSelect(selectId, inputId) {
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  if (!select || !input) return;

  const trigger = select.querySelector('.custom-select__trigger');
  const triggerText = trigger.querySelector('span');
  const options = select.querySelectorAll('.custom-select__option');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.custom-select').forEach((s) => {
      if (s !== select) s.classList.remove('open');
    });
    select.classList.toggle('open');
  });

  options.forEach((option) => {
    option.addEventListener('click', () => {
      options.forEach((o) => o.classList.remove('selected'));
      option.classList.add('selected');
      triggerText.textContent = option.textContent;
      input.value = option.dataset.value;
      select.classList.remove('open');
    });
  });
}

function updateSelectValue(selectId, inputId, value) {
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  if (!select || !input) return;

  input.value = value;
  const option = select.querySelector(`[data-value="${value}"]`);
  if (option) {
    select
      .querySelectorAll('.custom-select__option')
      .forEach((o) => o.classList.remove('selected'));
    option.classList.add('selected');
    select.querySelector('.custom-select__trigger span').textContent = option.textContent;
  }
}

// =====================================
// WEIGHT CHART
// =====================================

function initWeightChart() {
  const canvas = document.getElementById('weightChartCanvas');
  if (!canvas) return;

  let history = JSON.parse(localStorage.getItem(WEIGHT_HISTORY_KEY) || '[]');

  history = history
    .map((i) => ({
      date: i.date,
      weight: parseFloat(String(i.weight).replace(',', '.')),
    }))
    .filter((i) => !isNaN(i.weight));

  localStorage.setItem(WEIGHT_HISTORY_KEY, JSON.stringify(history));

  const labels = history.map((i) => i.date);
  const weights = history.map((i) => i.weight);

  if (weightChart) weightChart.destroy();

  weightChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: weights,
          borderColor: '#6fcfba',
          backgroundColor: 'rgba(111, 207, 186, 0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: (v) => v + ' кг' } },
        x: { grid: { display: false } },
      },
    },
  });
}

function recordNewWeight() {
  if (!weightNowInput.value) return;

  const weight = parseFloat(weightNowInput.value.replace(',', '.'));
  if (isNaN(weight)) return alert('Введіть коректну вагу');

  const history = JSON.parse(localStorage.getItem(WEIGHT_HISTORY_KEY) || '[]');
  const today = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });

  history.push({ date: today, weight });
  if (history.length > 10) history.shift();

  localStorage.setItem(WEIGHT_HISTORY_KEY, JSON.stringify(history));
  weightNowInput.value = '';
  initWeightChart();
}

// =====================================
// CALCULATIONS
// =====================================

function updateBMI(weight, height) {
  if (!weight || !height) return;

  const h = height / 100;
  const bmi = (weight / (h * h)).toFixed(1);

  bmiValueEl.textContent = bmi;

  let percent = ((bmi - 15) / 20) * 100;
  percent = Math.min(95, Math.max(5, percent));
  bmiPointer.style.left = percent + '%';

  bmiStatusEl.textContent =
    bmi < 18.5
      ? 'Недостатня вага'
      : bmi < 25
        ? 'Вага в нормі 🍃'
        : bmi < 30
          ? 'Надмірна вага'
          : 'Ожиріння';

  bmiAdviceEl.innerHTML = `Для твого зросту ідеальна вага <strong>${Math.round(20 * h * h)}–${Math.round(24 * h * h)} кг</strong>`;
}

function renderAll(data) {
  resultEl.textContent = `${data.calories} ккал`;
  normProteinEl.textContent = data.protein;
  normFatEl.textContent = data.fat;
  normCarbsEl.textContent = data.carbs;
  normWaterEl.textContent = data.water;

  updateBMI(data.weight, data.height);

  // Зберігаємо в localStorage для інших сторінок
  localStorage.setItem('dailyCaloriesNorm', data.calories);
  localStorage.setItem('userProtein', data.protein);
  localStorage.setItem('userFat', data.fat);
  localStorage.setItem('userCarbs', data.carbs);
  localStorage.setItem('userWater', data.water);
}

// =====================================
// SUPABASE — ЗАВАНТАЖЕННЯ ПРОФІЛЮ
// =====================================

async function loadProfileFromSupabase() {
  const user = getCurrentUser();
  if (!user) {
    // Якщо не залогінений — завантажуємо з localStorage
    loadFromLocalStorage();
    return;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    // Профіль ще не створений — завантажуємо з localStorage
    loadFromLocalStorage();
    return;
  }

  // Заповнюємо форму даними з Supabase
  fillForm(data);
  renderAll(data);

  // Оновлюємо ім'я і email в хедері профілю
  updateProfileHeader(user);
}

function loadFromLocalStorage() {
  const saved = JSON.parse(localStorage.getItem('userProfile') || 'null');
  if (saved) {
    fillForm(saved);
    renderAll(saved);
  }
}

function fillForm(data) {
  if (form.age) form.age.value = data.age || '';
  if (form.height) form.height.value = data.height || '';
  if (form.weight) form.weight.value = data.weight || '';

  if (data.gender) updateSelectValue('genderSelect', 'genderInput', data.gender);
  if (data.activity) updateSelectValue('activitySelect', 'activityInput', String(data.activity));
  if (data.goal) updateSelectValue('goalSelect', 'goalInput', data.goal);

  if (targetWeightInput && data.target_weight) {
    targetWeightInput.value = data.target_weight;
  }
}

// =====================================
// ОНОВЛЕННЯ ХЕДЕРА ПРОФІЛЮ
// =====================================

function updateProfileHeader(user) {
  if (!user) return;

  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Користувач';

  const email = user.email || '';
  const avatar = user.user_metadata?.avatar_url || '';

  // Хедер профілю на сторінці
  const profileNameEl = document.querySelector('.profile-header__name');
  const profileEmailEl = document.querySelector('.profile-header__email');
  const profileAvatarEl = document.querySelector('.profile-header__avatar');

  if (profileNameEl) profileNameEl.textContent = name;
  if (profileEmailEl) profileEmailEl.textContent = email;

  if (profileAvatarEl && avatar) {
    profileAvatarEl.style.backgroundImage = `url(${avatar})`;
    profileAvatarEl.style.backgroundSize = 'cover';
    profileAvatarEl.style.backgroundPosition = 'center';
  }
}

// =====================================
// SUPABASE — ЗБЕРЕЖЕННЯ ПРОФІЛЮ
// =====================================

async function saveProfileToSupabase(data) {
  const user = getCurrentUser();

  if (!user) {
    // Зберігаємо тільки в localStorage якщо не залогінений
    localStorage.setItem('userProfile', JSON.stringify(data));
    return;
  }

  const payload = {
    user_id: user.id,
    name: user.user_metadata?.full_name || user.user_metadata?.name || '',
    email: user.email || '',
    age: data.age,
    height: data.height,
    weight: data.weight,
    gender: data.gender,
    activity: data.activity,
    goal: data.goal,
    calories: data.calories,
    protein: data.protein,
    fat: data.fat,
    carbs: data.carbs,
    water: data.water,
    target_weight: data.target_weight || null,
    updated_at: new Date().toISOString(),
  };

  // Upsert — оновлює якщо є, створює якщо немає
  const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' });

  if (error) {
    console.error('Помилка збереження профілю:', error);
    showToast('Помилка збереження', 'error');
    return;
  }

  // Також зберігаємо в localStorage для інших сторінок
  localStorage.setItem('userProfile', JSON.stringify(data));
  showToast('Профіль збережено ✓');
}

// =====================================
// TOAST
// =====================================

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  const icon = type === 'error' ? '❌' : '✅';
  toast.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-text">${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// =====================================
// INIT
// =====================================
async function initProfile() {
  const user = await initAuth(async (event, user) => {
    if (event === 'SIGNED_IN') {
      await loadProfileFromSupabase();
      updateProfileHeader(user);
    }

    if (event === 'SIGNED_OUT') {
      loadFromLocalStorage();
    }
  });

  // 🔒 Захист сторінки
  if (!user) {
    openAuthModal();
    return;
  }

  setupCustomSelect('genderSelect', 'genderInput');
  setupCustomSelect('activitySelect', 'activityInput');
  setupCustomSelect('goalSelect', 'goalInput');

  recordWeightBtn.addEventListener('click', recordNewWeight);

  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select').forEach((s) => s.classList.remove('open'));
  });

  await loadProfileFromSupabase();

  initWeightChart();
}
// =====================================
// FORM SUBMIT
// =====================================

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const age = +form.age.value;
  const height = +form.height.value;
  const weight = +form.weight.value;

  const base =
    genderInput.value === 'male'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

  let calories = base * +activityInput.value;
  if (goalInput.value === 'lose') calories *= 0.9;
  if (goalInput.value === 'gain') calories *= 1.1;

  calories = Math.round(calories);

  const data = {
    gender: genderInput.value,
    activity: activityInput.value,
    goal: goalInput.value,
    age,
    height,
    weight,
    calories,
    protein: Math.round((calories * 0.3) / 4),
    fat: Math.round((calories * 0.3) / 9),
    carbs: Math.round((calories * 0.4) / 4),
    water: 2.5,
    target_weight: targetWeightInput ? +targetWeightInput.value || null : null,
  };

  renderAll(data);
  await saveProfileToSupabase(data);
});

document.addEventListener('DOMContentLoaded', initProfile);
