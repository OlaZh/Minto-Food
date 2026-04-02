// =====================================
// PROFILE — SUPABASE + AUTH VERSION
// =====================================

import { supabase } from './supabaseClient.js';
import { initAuth, requireAuth, getCurrentUser, openAuthModal, signOut } from './auth.js';
import { showToast } from './utils.js';
import {
  getWeightHistory,
  addWeightRecord,
  getActivityHistory,
  saveActivity,
  deleteActivity as deleteActivityFromStorage,
} from './storage.js';
import { initCustomSelect, setSelectValue, initSelectsGlobalListener } from './ui-components.js';

// =====================================
// DOM ELEMENTS
// =====================================

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

// =====================================
// CONSTANTS
// =====================================

const WEIGHT_HISTORY_KEY = 'weightHistory';
const ACTIVITY_HISTORY_KEY = 'activityHistory';

// ✅ ВИПРАВЛЕНО: Об'єкт активностей з name та caloriesPerMinute
const ACTIVITIES = {
  walking: { name: '🚶 Ходьба', caloriesPerMinute: 4 },
  running: { name: '🏃 Біг', caloriesPerMinute: 10 },
  cycling: { name: '🚴 Велосипед', caloriesPerMinute: 8 },
  swimming: { name: '🏊 Плавання', caloriesPerMinute: 9 },
  yoga: { name: '🧘 Йога', caloriesPerMinute: 3 },
  fitness: { name: '💪 Фітнес', caloriesPerMinute: 7 },
  dancing: { name: '💃 Танці', caloriesPerMinute: 6 },
  hiking: { name: '🥾 Похід', caloriesPerMinute: 6 },
  tennis: { name: '🎾 Теніс', caloriesPerMinute: 8 },
  basketball: { name: '🏀 Баскетбол', caloriesPerMinute: 9 },
  football: { name: '⚽ Футбол', caloriesPerMinute: 9 },
  stretching: { name: '🤸 Розтяжка', caloriesPerMinute: 2 },
  cleaning: { name: '🧹 Прибирання', caloriesPerMinute: 3 },
  gardening: { name: '🌱 Садівництво', caloriesPerMinute: 4 },
  gym: { name: '🏋️ Тренування в залі', caloriesPerMinute: 7 },
  pilates: { name: '🧘 Пілатес', caloriesPerMinute: 3 },
  elliptical: { name: '🔄 Орбітрек', caloriesPerMinute: 7 },
  other: { name: '➕ Інша активність', caloriesPerMinute: 5 },
};

// =====================================
// CHART INSTANCES
// =====================================

let weightChart = null;
let weightChart2 = null;
let activityChart = null;
let currentPeriod = 'week'; // ✅ ДОДАНО: змінна для періоду

let statisticsCharts = {
  balancePieChart: null,
  kbjuLineChart: null,
  usefulnessBarChart: null,
  lastWeekChart: null,
  thisWeekChart: null,
};

// =====================================
// WEIGHT CHART
// =====================================

function initWeightChart() {
  const canvas = document.getElementById('weightChartCanvas');
  if (!canvas) return;

  let history = getWeightHistory();

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

function initWeightChart2() {
  const canvas = document.getElementById('weightChartCanvas2');
  if (!canvas) return;

  let history = getWeightHistory();

  history = history
    .map((i) => ({
      date: i.date,
      weight: parseFloat(String(i.weight).replace(',', '.')),
    }))
    .filter((i) => !isNaN(i.weight));

  const labels = history.map((i) => i.date);
  const weights = history.map((i) => i.weight);

  if (weightChart2) weightChart2.destroy();

  weightChart2 = new Chart(canvas, {
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

  addWeightRecord(weight);
  weightNowInput.value = '';

  initWeightChart();
}

// =====================================
// STATISTICS CHARTS
// =====================================

function initStatisticsCharts() {
  console.log('Запускаємо initStatisticsCharts');

  Object.values(statisticsCharts).forEach((chart) => {
    if (chart) chart.destroy();
  });

  const balanceCanvas = document.getElementById('balancePieChart');
  const kbjuCanvas = document.getElementById('kbjuLineChart');
  const usefulnessCanvas = document.getElementById('usefulnessBarChart');
  const lastWeekCanvas = document.getElementById('lastWeekChart');
  const thisWeekCanvas = document.getElementById('thisWeekChart');

  if (balanceCanvas) {
    statisticsCharts.balancePieChart = new Chart(balanceCanvas, {
      type: 'pie',
      data: {
        labels: ['Білки', 'Жири', 'Вуглеводи'],
        datasets: [{ data: [30, 30, 40], backgroundColor: ['#6fcfba', '#f2994a', '#56ccf2'] }],
      },
      options: { responsive: true, maintainAspectRatio: true },
    });
  }

  if (kbjuCanvas) {
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
        plugins: { legend: { display: true } },
      },
    });
  }

  if (usefulnessCanvas) {
    statisticsCharts.usefulnessBarChart = new Chart(usefulnessCanvas, {
      type: 'bar',
      data: {
        labels: ['Легкі', 'Середні', 'Важкі'],
        datasets: [{ label: 'Кількість', data: [12, 8, 4], backgroundColor: '#6fcfba' }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
      },
    });
  }

  if (lastWeekCanvas) {
    statisticsCharts.lastWeekChart = new Chart(lastWeekCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Білки', 'Жири', 'Вуглеводи'],
        datasets: [{ data: [25, 35, 40], backgroundColor: ['#6fcfba', '#f2994a', '#56ccf2'] }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: true } },
      },
    });
  }

  if (thisWeekCanvas) {
    statisticsCharts.thisWeekChart = new Chart(thisWeekCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Білки', 'Жири', 'Вуглеводи'],
        datasets: [{ data: [30, 30, 40], backgroundColor: ['#6fcfba', '#f2994a', '#56ccf2'] }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: true } },
      },
    });
  }

  console.log('initStatisticsCharts завершена успішно');
}

// =====================================
// BMI CALCULATIONS
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
  localStorage.setItem('userWeight', data.weight);
  localStorage.setItem('userHeight', data.height);
  localStorage.setItem('userGoal', data.goal);
}

// =====================================
// SUPABASE — LOAD PROFILE
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

  if (data.gender) setSelectValue('genderSelect', 'genderInput', data.gender);
  if (data.activity) setSelectValue('activitySelect', 'activityInput', String(data.activity));
  if (data.goal) setSelectValue('goalSelect', 'goalInput', data.goal);

  if (targetWeightInput && data.target_weight) {
    targetWeightInput.value = data.target_weight;
  }
}

// =====================================
// PROFILE HEADER
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
    profileAvatarEl.style.backgroundSize = 'cover';
    profileAvatarEl.style.backgroundPosition = 'center';
    profileAvatarEl.style.backgroundRepeat = 'no-repeat';
  } else if (profileAvatarEl && !avatar) {
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
// SUPABASE — SAVE PROFILE
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
// WEIGHT ADVICE — ПЕРСОНАЛЬНІ ПОРАДИ
// =====================================

function generateWeightAdvice() {
  const adviceContainer = document.getElementById('weightAdviceContent');
  const progressContainer = document.getElementById('weightProgressContent');

  if (!adviceContainer) return;

  const weight = parseFloat(
    localStorage.getItem('userWeight') || document.getElementById('weight')?.value || 0,
  );
  const height = parseFloat(
    localStorage.getItem('userHeight') || document.getElementById('height')?.value || 0,
  );
  const goal =
    localStorage.getItem('userGoal') || document.getElementById('goalInput')?.value || 'maintain';
  const targetWeight = parseFloat(
    document.getElementById('targetWeight')?.value ||
      document.getElementById('targetWeight2')?.value ||
      0,
  );

  const h = height / 100;
  const bmi = h > 0 ? (weight / (h * h)).toFixed(1) : 0;
  const idealWeightMin = Math.round(18.5 * h * h);
  const idealWeightMax = Math.round(24.9 * h * h);
  const weightDiff = targetWeight > 0 ? (weight - targetWeight).toFixed(1) : 0;

  let adviceHTML = '';
  let progressHTML = '';

  // ІМТ статус
  if (bmi < 18.5) {
    adviceHTML += `<div class="advice-item advice-item--info"><span class="advice-icon">📊</span><div class="advice-text"><strong>Ваш ІМТ: ${bmi}</strong> — недостатня вага. Рекомендована вага: ${idealWeightMin}–${idealWeightMax} кг.</div></div>`;
  } else if (bmi >= 18.5 && bmi < 25) {
    adviceHTML += `<div class="advice-item advice-item--success"><span class="advice-icon">✅</span><div class="advice-text"><strong>Ваш ІМТ: ${bmi}</strong> — вага в нормі! Чудово!</div></div>`;
  } else if (bmi >= 25 && bmi < 30) {
    adviceHTML += `<div class="advice-item advice-item--warning"><span class="advice-icon">⚠️</span><div class="advice-text"><strong>Ваш ІМТ: ${bmi}</strong> — надмірна вага. Рекомендована: ${idealWeightMin}–${idealWeightMax} кг.</div></div>`;
  } else if (bmi >= 30) {
    adviceHTML += `<div class="advice-item advice-item--alert"><span class="advice-icon">🔴</span><div class="advice-text"><strong>Ваш ІМТ: ${bmi}</strong> — ожиріння. Рекомендуємо консультацію лікаря.</div></div>`;
  }

  // Поради по цілі
  if (goal === 'lose') {
    adviceHTML += `<div class="advice-item"><span class="advice-icon">🥗</span><div class="advice-text"><strong>Ціль — схуднути.</strong> Дефіцит 300-500 ккал/день = 0.5-1 кг/тиждень.</div></div>`;
    adviceHTML += `<div class="advice-item"><span class="advice-icon">🚶‍♀️</span><div class="advice-text">30 хвилин ходьби = 150-200 ккал додатково.</div></div>`;
  } else if (goal === 'gain') {
    adviceHTML += `<div class="advice-item"><span class="advice-icon">🍳</span><div class="advice-text"><strong>Ціль — набрати.</strong> +300-500 ккал, акцент на білок.</div></div>`;
  } else {
    adviceHTML += `<div class="advice-item"><span class="advice-icon">⚖️</span><div class="advice-text"><strong>Ціль — підтримка.</strong> Дотримуйтесь норми калорій.</div></div>`;
  }

  // Прогрес
  if (targetWeight > 0 && weight > 0) {
    const diff = Math.abs(weightDiff);
    const direction = weightDiff > 0 ? 'скинути' : 'набрати';
    const startWeight = parseFloat(localStorage.getItem('startWeight') || weight);
    const totalToLose = Math.abs(startWeight - targetWeight);
    const alreadyLost = Math.abs(startWeight - weight);
    const progressPercent =
      totalToLose > 0 ? Math.min(100, Math.round((alreadyLost / totalToLose) * 100)) : 0;

    progressHTML = `
      <div class="progress-status">
        <div class="progress-header"><span>Поточна: <strong>${weight} кг</strong></span><span>Ціль: <strong>${targetWeight} кг</strong></span></div>
        <div class="progress-bar-container"><div class="progress-bar" style="width: ${progressPercent}%"></div></div>
        <div class="progress-footer"><span>Залишилось ${direction}: <strong>${diff} кг</strong></span><span class="progress-percent">${progressPercent}%</span></div>
      </div>
      <div class="progress-estimate"><span class="progress-icon">📅</span><div class="progress-text">При 0.5 кг/тиждень — ціль за <strong>${Math.ceil(diff / 0.5)} тижнів</strong>.</div></div>
    `;
  } else {
    progressHTML = `<div class="progress-status progress-status--empty"><span class="progress-icon">🎯</span><div class="progress-text">Встановіть бажану вагу для відстеження прогресу.</div></div>`;
  }

  adviceContainer.innerHTML = adviceHTML;
  if (progressContainer) progressContainer.innerHTML = progressHTML;
}

// =====================================
// SYNC WEIGHT INPUTS BETWEEN TABS
// =====================================

function syncWeightInputs() {
  const targetWeight1 = document.getElementById('targetWeight');
  const targetWeight2 = document.getElementById('targetWeight2');
  const currentWeight1 = document.getElementById('currentWeightInput');
  const currentWeight2 = document.getElementById('currentWeightInput2');

  if (targetWeight1 && targetWeight2) {
    targetWeight1.addEventListener('input', () => {
      targetWeight2.value = targetWeight1.value;
      generateWeightAdvice();
    });
    targetWeight2.addEventListener('input', () => {
      targetWeight1.value = targetWeight2.value;
      generateWeightAdvice();
    });
  }

  if (currentWeight1 && currentWeight2) {
    currentWeight1.addEventListener('input', () => {
      currentWeight2.value = currentWeight1.value;
    });
    currentWeight2.addEventListener('input', () => {
      currentWeight1.value = currentWeight2.value;
    });
  }

  const saveBtn2 = document.getElementById('saveWeightBtn2');
  if (saveBtn2) {
    saveBtn2.addEventListener('click', () => {
      if (currentWeight2 && currentWeight1) currentWeight1.value = currentWeight2.value;
      recordNewWeight();
      initWeightChart2();
      generateWeightAdvice();
    });
  }
}

// =====================================
// ACTIVITY TRACKER
// =====================================

let activityTrackerInitialized = false;

function initActivityTracker() {
  if (activityTrackerInitialized) {
    updateTodayStats();
    renderActivityHistory(currentPeriod);
    initActivityChart();
    return;
  }

  setupActivitySelect();
  setupActivityForm();
  setupPeriodFilter();
  updateTodayStats();
  renderActivityHistory('week');
  initActivityChart();

  activityTrackerInitialized = true;
}

function setupActivitySelect() {
  const select = document.getElementById('activityTypeSelect');
  const input = document.getElementById('activityTypeInput');
  const durationInput = document.getElementById('activityDuration');

  if (!select || !input) {
    console.warn('Activity select not found');
    return;
  }

  const trigger = select.querySelector('.custom-select__trigger');
  const options = select.querySelectorAll('.custom-select__option');

  // Видаляємо старі listeners
  const newTrigger = trigger.cloneNode(true);
  trigger.parentNode.replaceChild(newTrigger, trigger);

  newTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    document.querySelectorAll('.custom-select').forEach((s) => {
      if (s !== select) s.classList.remove('open');
    });

    select.classList.toggle('open');
  });

  options.forEach((option) => {
    const newOption = option.cloneNode(true);
    option.parentNode.replaceChild(newOption, option);

    newOption.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      select
        .querySelectorAll('.custom-select__option')
        .forEach((o) => o.classList.remove('selected'));
      newOption.classList.add('selected');
      select.querySelector('.custom-select__trigger span').textContent = newOption.textContent;
      input.value = newOption.dataset.value;
      select.classList.remove('open');
      const otherInput = document.getElementById('otherActivityInput');

      if (newOption.dataset.value === 'other') {
        otherInput.style.display = 'block';
      } else {
        otherInput.style.display = 'none';
      }

      updateCaloriesPreview();
    });
  });

  if (durationInput) {
    const newDurationInput = durationInput.cloneNode(true);
    durationInput.parentNode.replaceChild(newDurationInput, durationInput);
    newDurationInput.addEventListener('input', updateCaloriesPreview);
  }
}

function updateCaloriesPreview() {
  const activityType = document.getElementById('activityTypeInput')?.value;
  const duration = parseInt(document.getElementById('activityDuration')?.value || 0);
  const previewEl = document.getElementById('previewCalories');

  if (!previewEl) return;

  if (activityType && duration > 0) {
    // ✅ ВИПРАВЛЕНО: Використовуємо ACTIVITIES
    const activity = ACTIVITIES[activityType];
    const caloriesPerMin = activity ? activity.caloriesPerMinute : 5;
    const totalCalories = Math.round(caloriesPerMin * duration);
    previewEl.textContent = `${totalCalories} ккал`;
    previewEl.classList.add('has-value');
  } else {
    previewEl.textContent = '— ккал';
    previewEl.classList.remove('has-value');
  }
}

function setupActivityForm() {
  const addBtn = document.getElementById('addActivityBtn');

  if (!addBtn) return;

  // Видаляємо старі listeners
  const newBtn = addBtn.cloneNode(true);
  addBtn.parentNode.replaceChild(newBtn, addBtn);

  newBtn.addEventListener('click', () => {
    const activityType = document.getElementById('activityTypeInput')?.value;
    const durationEl = document.getElementById('activityDuration');
    const duration = parseInt(durationEl?.value || 0);

    if (!activityType) return showToast('Оберіть вид активності', 'error');
    if (!duration || duration < 1) return showToast('Введіть тривалість', 'error');

    // ✅ ВИПРАВЛЕНО: Використовуємо ACTIVITIES
    const activityData = ACTIVITIES[activityType];
    const caloriesPerMin = activityData ? activityData.caloriesPerMinute : 5;
    const activityName = activityData ? activityData.name : 'Активність';
    const caloriesBurned = Math.round(caloriesPerMin * duration);

    const activity = {
      id: Date.now(),
      type: activityType,
      name: activityName,
      duration,
      calories: caloriesBurned,
      date: new Date().toISOString(),
      dateFormatted: new Date().toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      time: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
    };

    saveActivity(activity);

    // Clear form
    if (durationEl) durationEl.value = '';
    document.getElementById('activityTypeInput').value = '';
    const triggerSpan = document.querySelector('#activityTypeSelect .custom-select__trigger span');
    if (triggerSpan) triggerSpan.textContent = 'Оберіть активність...';
    document
      .querySelectorAll('#activityTypeSelect .custom-select__option')
      .forEach((o) => o.classList.remove('selected'));
    updateCaloriesPreview();

    updateTodayStats();
    renderActivityHistory(currentPeriod);
    initActivityChart();

    showToast(`${activity.name}: ${caloriesBurned} ккал спалено! 🔥`);
  });
}

function deleteActivity(activityId) {
  deleteActivityFromStorage(activityId);

  updateTodayStats();
  renderActivityHistory(currentPeriod);
  initActivityChart();
}

window.deleteActivity = deleteActivity;

function updateTodayStats() {
  const history = getActivityHistory();
  const today = new Date().toDateString();

  const todayActivities = history.filter((a) => new Date(a.date).toDateString() === today);

  const totalCalories = todayActivities.reduce((sum, a) => sum + a.calories, 0);
  const totalMinutes = todayActivities.reduce((sum, a) => sum + a.duration, 0);
  const totalCount = todayActivities.length;

  const caloriesEl = document.getElementById('todayCaloriesBurned');
  const minutesEl = document.getElementById('todayActiveMinutes');
  const countEl = document.getElementById('todayActivitiesCount');

  if (caloriesEl) caloriesEl.textContent = totalCalories;
  if (minutesEl) minutesEl.textContent = totalMinutes;
  if (countEl) countEl.textContent = totalCount;

  updateCalorieImpact(totalCalories);
  localStorage.setItem('todayBurnedCalories', totalCalories);
}

function updateCalorieImpact(burnedCalories) {
  const baseCalories = parseInt(localStorage.getItem('dailyCaloriesNorm') || 0);
  const totalCalories = baseCalories + burnedCalories;

  const baseEl = document.getElementById('impactBaseCalories');
  const burnedEl = document.getElementById('impactBurnedCalories');
  const totalEl = document.getElementById('impactTotalCalories');

  if (baseEl) baseEl.textContent = baseCalories ? `${baseCalories} ккал` : '—';
  if (burnedEl) burnedEl.textContent = `${burnedCalories} ккал`;
  if (totalEl) totalEl.textContent = baseCalories ? `${totalCalories} ккал` : '—';
}

function setupPeriodFilter() {
  const buttons = document.querySelectorAll('.period-btn');

  buttons.forEach((btn) => {
    // Видаляємо старі listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
      newBtn.classList.add('active');
      currentPeriod = newBtn.dataset.period;
      renderActivityHistory(currentPeriod);
    });
  });
}

function renderActivityHistory(period) {
  const container = document.getElementById('activityHistoryList');
  if (!container) return;

  let history = getActivityHistory();
  const now = new Date();

  if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    history = history.filter((a) => new Date(a.date) >= weekAgo);
  } else if (period === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    history = history.filter((a) => new Date(a.date) >= monthAgo);
  }

  if (history.length === 0) {
    container.innerHTML = `<div class="activity-history-empty"><span class="empty-icon">🏃‍♀️</span><p>Немає записів за цей період.</p></div>`;
    return;
  }

  const grouped = {};
  history.forEach((activity) => {
    const dateKey = activity.dateFormatted;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(activity);
  });

  let html = '';
  for (const [date, activities] of Object.entries(grouped)) {
    const dayTotal = activities.reduce((sum, a) => sum + a.calories, 0);
    const dayMinutes = activities.reduce((sum, a) => sum + a.duration, 0);

    html += `<div class="activity-day-group"><div class="activity-day-header"><span class="activity-day-date">${date}</span><span class="activity-day-total">${dayTotal} ккал • ${dayMinutes} хв</span></div><div class="activity-day-items">`;

    activities.forEach((activity) => {
      html += `
        <div class="activity-item" data-id="${activity.id}">
          <div class="activity-item__icon">${activity.name.split(' ')[0]}</div>
          <div class="activity-item__info">
            <span class="activity-item__name">${activity.name.split(' ').slice(1).join(' ')}</span>
            <span class="activity-item__details">${activity.duration} хв • ${activity.time}</span>
          </div>
          <div class="activity-item__calories">
            <span class="activity-item__calories-value">-${activity.calories}</span>
            <span class="activity-item__calories-label">ккал</span>
          </div>
          <button class="activity-item__delete" onclick="deleteActivity(${activity.id})" title="Видалити">✕</button>
        </div>
      `;
    });

    html += `</div></div>`;
  }

  container.innerHTML = html;
}

// Замінити функцію initActivityChart() в profile.js на цю:

function initActivityChart() {
  const canvas = document.getElementById('activityChartCanvas');
  if (!canvas) return;

  const history = getActivityHistory();
  const now = new Date();

  const days = [];
  const caloriesData = [];

  // 30 днів замість 14
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toDateString();
    const dateLabel = date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });

    days.push(dateLabel);

    const dayActivities = history.filter((a) => new Date(a.date).toDateString() === dateStr);
    const dayCalories = dayActivities.reduce((sum, a) => sum + a.calories, 0);
    caloriesData.push(dayCalories);
  }

  if (activityChart) activityChart.destroy();

  activityChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        {
          label: 'Спалено ккал',
          data: caloriesData,
          backgroundColor: 'rgba(111, 207, 186, 0.6)',
          borderColor: '#6fcfba',
          borderWidth: 1,
          borderRadius: 4,
          barThickness: 'flex',
          maxBarThickness: 20,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function (context) {
              return context[0].label;
            },
            label: function (context) {
              return context.raw + ' ккал';
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => v + ' ккал',
            maxTicksLimit: 5,
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
        },
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            font: { size: 10 },
          },
        },
      },
    },
  });
}
// =====================================
// PROFILE TABS
// =====================================

function initProfileTabs() {
  const buttons = document.querySelectorAll('.profile-sidebar__item');
  const sections = document.querySelectorAll('[data-profile-section]');

  if (!buttons.length || !sections.length) {
    console.warn('initProfileTabs: не знайдено кнопок або секцій');
    return;
  }

  sections.forEach((section, index) => {
    if (index === 0) {
      section.removeAttribute('hidden');
      section.style.display = 'block';
    } else {
      section.setAttribute('hidden', '');
      section.style.display = 'none';
    }
  });

  buttons[0]?.classList.add('active');
  buttons[0]?.setAttribute('aria-selected', 'true');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const tab = btn.dataset.tab;

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

      if (tab === 'weightControl') {
        setTimeout(() => {
          initWeightChart2();
          generateWeightAdvice();
        }, 150);
      }

      if (tab === 'activity') {
        setTimeout(initActivityTracker, 150);
      }

      if (tab === 'statistics') {
        setTimeout(initStatisticsCharts, 150);
      }
    });
  });

  syncWeightInputs();
}

// =====================================
// INIT
// =====================================

async function initProfile() {
  const user = await initAuth(async (event, user) => {
    if (event === 'SIGNED_IN') {
      await loadProfileFromSupabase();
      updateProfileHeader(user);
      initProfileTabs();
    }

    if (event === 'SIGNED_OUT') {
      loadFromLocalStorage();
    }
  });

  document.getElementById('signOutBtn')?.addEventListener('click', async () => {
    Object.values(statisticsCharts).forEach((chart) => {
      if (chart) chart.destroy();
    });
    if (weightChart) weightChart.destroy();
    if (weightChart2) weightChart2.destroy();
    if (activityChart) activityChart.destroy();

    await signOut();
    window.location.href = 'index.html';
  });

  if (!user) {
    openAuthModal();
    return;
  }

  initCustomSelect('genderSelect', 'genderInput');
  initCustomSelect('activitySelect', 'activityInput');
  initCustomSelect('goalSelect', 'goalInput');

  recordWeightBtn?.addEventListener('click', recordNewWeight);

  initSelectsGlobalListener();
  await loadProfileFromSupabase();

  initWeightChart();
  initProfileTabs();
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

    let calories = base * parseFloat(activityInput.value);

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
