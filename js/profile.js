// =====================================
// PROFILE — FULL FINAL VERSION (CALORIES + CHART FIXED)
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

const STORAGE_KEY = 'userProfile';
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
          borderColor: '#2ecc71',
          backgroundColor: 'rgba(46,204,113,.15)',
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
}

// =====================================
// INIT
// =====================================

function initProfile() {
  setupCustomSelect('genderSelect', 'genderInput');
  setupCustomSelect('activitySelect', 'activityInput');
  setupCustomSelect('goalSelect', 'goalInput');

  recordWeightBtn.addEventListener('click', recordNewWeight);

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved) {
    form.age.value = saved.age;
    form.height.value = saved.height;
    form.weight.value = saved.weight;

    updateSelectValue('genderSelect', 'genderInput', saved.gender);
    updateSelectValue('activitySelect', 'activityInput', saved.activity);
    updateSelectValue('goalSelect', 'goalInput', saved.goal);

    renderAll(saved);
  }

  initWeightChart();
}

// =====================================
// FORM SUBMIT — КБЖВ ПРАЦЮЄ ЗНОВУ
// =====================================

form.addEventListener('submit', (e) => {
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
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  renderAll(data);
});

document.addEventListener('DOMContentLoaded', initProfile);
