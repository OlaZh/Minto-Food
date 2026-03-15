// =====================================
// PROFILE — SUPABASE + AUTH VERSION
// =====================================

import { supabase } from './supabaseClient.js';
import { initAuth, requireAuth, getCurrentUser, openAuthModal, signOut } from './auth.js';

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

// ✅ ВИПРАВА: Об'єкт для зберігання статистичних графіків
let statisticsCharts = {
  balancePieChart: null,
  kbjuLineChart: null,
  usefulnessBarChart: null,
  lastWeekChart: null,
  thisWeekChart: null,
};

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
  if (!weightNowInput || !weightNowInput.value) return;

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
// STATISTICS CHARTS — ✅ ВИПРАВЛЕНО
// =====================================

function initStatisticsCharts() {
  console.log('Запускаємо initStatisticsCharts');

  // 1. ЗНИЩУЄМО СТАРІ ГРАФІКИ перед тим, як малювати нові
  Object.values(statisticsCharts).forEach((chart) => {
    if (chart) {
      chart.destroy();
    }
  });

  const balanceCanvas = document.getElementById('balancePieChart');
  const kbjuCanvas = document.getElementById('kbjuLineChart');
  const usefulnessCanvas = document.getElementById('usefulnessBarChart');
  const lastWeekCanvas = document.getElementById('lastWeekChart');
  const thisWeekCanvas = document.getElementById('thisWeekChart');

  // ========================
  // 1. БАЛАНС СТРАВ (PIE)
  // ========================
  if (balanceCanvas) {
    console.log('Малюємо balancePieChart');
    statisticsCharts.balancePieChart = new Chart(balanceCanvas, {
      type: 'pie',
      data: {
        labels: ['Білки', 'Жири', 'Вуглеводи'],
        datasets: [
          {
            data: [30, 30, 40],
            backgroundColor: ['#6fcfba', '#f2994a', '#56ccf2'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
      },
    });
  } else {
    console.warn('Не знайдено #balancePieChart');
  }

  // ========================
  // 2. ДИНАМІКА КБЖУ (LINE)
  // ========================
  if (kbjuCanvas) {
    console.log('Малюємо kbjuLineChart');
    statisticsCharts.kbjuLineChart = new Chart(kbjuCanvas, {
      type: 'line',
      data: {
        labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
        datasets: [
          {
            label: 'Калорії',
            data: [1800, 1700, 2000, 1900, 1750, 2100, 1950],
            borderColor: '#6fcfba',
            backgroundColor: 'rgba(111, 207, 186, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: true },
        },
      },
    });
  } else {
    console.warn('Не знайдено #kbjuLineChart');
  }

  // ========================
  // 3. КОРИСНІСТЬ (BAR)
  // ========================
  if (usefulnessCanvas) {
    console.log('Малюємо usefulnessBarChart');
    statisticsCharts.usefulnessBarChart = new Chart(usefulnessCanvas, {
      type: 'bar',
      data: {
        labels: ['Легкі', 'Середні', 'Важкі'],
        datasets: [
          {
            label: 'Кількість',
            data: [12, 8, 4],
            backgroundColor: '#6fcfba',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
        },
      },
    });
  } else {
    console.warn('Не знайдено #usefulnessBarChart');
  }

  // ========================
  // 4. МИНУЛИЙ ТИЖДЕНЬ (DOUGHNUT)
  // ========================
  if (lastWeekCanvas) {
    console.log('Малюємо lastWeekChart');
    statisticsCharts.lastWeekChart = new Chart(lastWeekCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Білки', 'Жири', 'Вуглеводи'],
        datasets: [
          {
            data: [25, 35, 40],
            backgroundColor: ['#6fcfba', '#f2994a', '#56ccf2'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: true },
        },
      },
    });
  } else {
    console.warn('Не знайдено #lastWeekChart');
  }

  // ========================
  // 5. ЦЕЙ ТИЖДЕНЬ (DOUGHNUT)
  // ========================
  if (thisWeekCanvas) {
    console.log('Малюємо thisWeekChart');
    statisticsCharts.thisWeekChart = new Chart(thisWeekCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Білки', 'Жири', 'Вуглеводи'],
        datasets: [
          {
            data: [30, 30, 40],
            backgroundColor: ['#6fcfba', '#f2994a', '#56ccf2'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: true },
        },
      },
    });
  } else {
    console.warn('Не знайдено #thisWeekChart');
  }

  console.log('initStatisticsCharts завершена успішно');
}

// =====================================
// CALCULATIONS
// =====================================

function updateBMI(weight, height) {
  if (!weight || !height || !bmiValueEl) return;

  const h = height / 100;
  const bmi = (weight / (h * h)).toFixed(1);

  if (bmiValueEl) bmiValueEl.textContent = bmi;

  let percent = ((bmi - 15) / 20) * 100;
  percent = Math.min(95, Math.max(5, percent));

  if (bmiPointer) bmiPointer.style.left = percent + '%';

  if (bmiStatusEl) {
    bmiStatusEl.textContent =
      bmi < 18.5
        ? 'Недостатня вага'
        : bmi < 25
          ? 'Вага в нормі 🍃'
          : bmi < 30
            ? 'Надмірна вага'
            : 'Ожиріння';
  }

  if (bmiAdviceEl) {
    bmiAdviceEl.innerHTML = `Для твого зросту ідеальна вага <strong>${Math.round(20 * h * h)}–${Math.round(24 * h * h)} кг</strong>`;
  }
}

function renderAll(data) {
  if (resultEl) resultEl.textContent = `${data.calories} ккал`;
  if (normProteinEl) normProteinEl.textContent = data.protein;
  if (normFatEl) normFatEl.textContent = data.fat;
  if (normCarbsEl) normCarbsEl.textContent = data.carbs;
  if (normWaterEl) normWaterEl.textContent = data.water;

  updateBMI(data.weight, data.height);

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
    loadFromLocalStorage();
    return;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    loadFromLocalStorage();
    return;
  }

  fillForm(data);
  renderAll(data);

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
  if (!form) return;

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

  const profileNameEl = document.querySelector('.profile-header__name');
  const profileEmailEl = document.querySelector('.profile-header__email');
  const profileAvatarEl = document.querySelector('.profile-header__avatar');

  if (profileNameEl) profileNameEl.textContent = name;
  if (profileEmailEl) profileEmailEl.textContent = email;

  if (profileAvatarEl && avatar) {
    profileAvatarEl.style.backgroundImage = `url(${avatar})`;
    profileAvatarEl.style.backgroundSize = 'cover'; // ← ЦЕ ВАЖЛИВО
    profileAvatarEl.style.backgroundPosition = 'center'; // ← ЦЕ ВАЖЛИВО
    profileAvatarEl.style.backgroundRepeat = 'no-repeat'; // ← ДОДАЙ ЦЕ
  } else if (profileAvatarEl && !avatar) {
    // Якщо немає аватара — показуємо ініціали
    const initials = name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    profileAvatarEl.textContent = initials;
    profileAvatarEl.style.display = 'flex';
    profileAvatarEl.style.alignItems = 'center';
    profileAvatarEl.style.justifyContent = 'center';
    profileAvatarEl.style.fontSize = '24px';
    profileAvatarEl.style.fontWeight = '700';
  }
}

// =====================================
// SUPABASE — ЗБЕРЕЖЕННЯ ПРОФІЛЮ
// =====================================

async function saveProfileToSupabase(data) {
  const user = getCurrentUser();

  if (!user) {
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

  const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' });

  if (error) {
    console.error('Помилка збереження профілю:', error);
    showToast('Помилка збереження', 'error');
    return;
  }

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

  toast.innerHTML = `<span class="toast-icon">${icon}</span>
     <span class="toast-text">${message}</span>`;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// =====================================
// PROFILE SIDEBAR TABS — ✅ ВИПРАВЛЕНО
// =====================================
function initProfileTabs() {
  const buttons = document.querySelectorAll('.profile-sidebar__item');
  const sections = document.querySelectorAll('[data-profile-section]');

  if (!buttons.length || !sections.length) {
    console.warn('initProfileTabs: не знайдено кнопок або секцій');
    return;
  }

  // Показуємо першу секцію за замовчуванням
  sections.forEach((section, index) => {
    if (index === 0) {
      section.removeAttribute('hidden');
      section.style.display = 'block';
    } else {
      section.setAttribute('hidden', '');
      section.style.display = 'none';
    }
  });

  // Перший таб активний за замовчуванням
  buttons[0]?.classList.add('active');
  buttons[0]?.setAttribute('aria-selected', 'true');

  // Обробка кліків
  buttons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      // Деактивуємо всі кнопки
      buttons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });

      // Активуємо поточну кнопку
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const tab = btn.dataset.tab;

      // Ховаємо/показуємо секції
      sections.forEach((section) => {
        const isActive = section.dataset.profileSection === tab;

        if (isActive) {
          section.removeAttribute('hidden');
          section.style.display = 'block';
        } else {
          section.setAttribute('hidden', '');
          section.style.display = 'none';
        }
      });

      // Якщо це таб статистики — малюємо графіки з затримкою
      if (tab === 'statistics') {
        setTimeout(initStatisticsCharts, 150);
      }
    });
  });
}

// =====================================
// INIT
// =====================================

async function initProfile() {
  const user = await initAuth(async (event, user) => {
    if (event === 'SIGNED_IN') {
      await loadProfileFromSupabase();
      updateProfileHeader(user);
      initProfileTabs(); // ← ✅ ДОДАНО
    }

    if (event === 'SIGNED_OUT') {
      loadFromLocalStorage();
    }
  });

  document.getElementById('signOutBtn')?.addEventListener('click', async () => {
    // ✅ ВИПРАВА: Знищуємо всі графіки перед вихідом
    Object.values(statisticsCharts).forEach((chart) => {
      if (chart) {
        chart.destroy();
      }
    });

    await signOut();
    window.location.href = 'index.html';
  });

  if (!user) {
    openAuthModal();
    return;
  }

  setupCustomSelect('genderSelect', 'genderInput');
  setupCustomSelect('activitySelect', 'activityInput');
  setupCustomSelect('goalSelect', 'goalInput');

  recordWeightBtn?.addEventListener('click', recordNewWeight);

  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select').forEach((s) => s.classList.remove('open'));
  });

  await loadProfileFromSupabase();

  initWeightChart();
  initProfileTabs(); // ← ✅ ДОДАНО
  // initStatisticsCharts(); — ПЕРЕНЕСЕНО В ТАБ, НЕ ВИКЛИКАЄМО ОДРАЗУ
}

// =====================================
// FORM SUBMIT
// =====================================

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const age = +form.age.value;
    const height = +form.height.value;
    const weight = +form.weight.value;

    const base =
      genderInput.value === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;

    let calories = base * parseFloat(activityInput.value); // ← вже було виправлено

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
}

document.addEventListener('DOMContentLoaded', initProfile);
