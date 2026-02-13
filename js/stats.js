// ===============================
// STATS — DAILY PROGRESS (CALORIES, MACROS & WATER)
// ===============================

// Calories & Macros UI Elements
const kcalCurrentEl = document.getElementById('kcalCurrent');
const kcalCircleEl = document.getElementById('kcalCircle');

const pCircleEl = document.getElementById('pCircle');
const fCircleEl = document.getElementById('fCircle');
const cCircleEl = document.getElementById('cCircle');

const pCurrentEl = document.getElementById('pCurrent');
const fCurrentEl = document.getElementById('fCurrent');
const cCurrentEl = document.getElementById('cCurrent');

// Water UI Elements
const waterValueEl = document.getElementById('currentWaterText');
const waterFillEl = document.getElementById('waterFill');

// ===============================
// HELPERS — NORMS FROM PROFILE
// ===============================

function getWaterNorm() {
  const saved = localStorage.getItem('userWater');
  if (!saved) return 2.5;
  return Number(String(saved).replace(',', '.'));
}

function getDailyCaloriesNorm() {
  const saved = localStorage.getItem('dailyCaloriesNorm');
  return saved ? Number(saved) : 2000;
}

function getProteinNorm() {
  const saved = localStorage.getItem('userProtein');
  return saved ? Number(saved) : 100;
}

function getFatNorm() {
  const saved = localStorage.getItem('userFat');
  return saved ? Number(saved) : 70;
}

function getCarbsNorm() {
  const saved = localStorage.getItem('userCarbs');
  return saved ? Number(saved) : 250;
}

// ===============================
// CIRCULAR HELPERS (Твій робочий код)
// ===============================

function applyCircleState(circleEl, stateClass) {
  if (!circleEl) return;
  const wrapper = circleEl.parentElement;
  circleEl.classList.add(stateClass);
  if (wrapper) wrapper.classList.add(stateClass);
}

function resetCircleState(circleEl) {
  if (!circleEl) return;
  const wrapper = circleEl.parentElement;
  circleEl.classList.remove('circle-progress--warning', 'circle-progress--over');
  if (wrapper) wrapper.classList.remove('circle-progress--warning', 'circle-progress--over');
}

function setCirclePercent(circleEl, current, max) {
  if (!circleEl || !max) return;

  const percentRaw = (current / max) * 100;
  const percent = Math.min(percentRaw, 100);

  resetCircleState(circleEl);

  if (percentRaw >= 80 && percentRaw < 100) {
    applyCircleState(circleEl, 'circle-progress--warning');
  }
  if (percentRaw >= 100) {
    applyCircleState(circleEl, 'circle-progress--over');
  }

  circleEl.style.strokeDasharray = `${percent}, 100`;
}

// ===============================
// UPDATE STATS (CALORIES & MACROS)
// ===============================

export function updateStats(consumed) {
  const dailyCaloriesNorm = getDailyCaloriesNorm();
  const proteinNorm = getProteinNorm();
  const fatNorm = getFatNorm();
  const carbsNorm = getCarbsNorm();

  const kcal = consumed.kcal ?? 0;
  const protein = consumed.protein ?? 0;
  const fat = consumed.fat ?? 0;
  const carbs = consumed.carbs ?? 0;

  if (kcalCurrentEl) kcalCurrentEl.textContent = Math.round(kcal);

  setCirclePercent(kcalCircleEl, kcal, dailyCaloriesNorm);

  if (pCurrentEl) pCurrentEl.textContent = Math.round(protein);
  if (fCurrentEl) fCurrentEl.textContent = Math.round(fat);
  if (cCurrentEl) cCurrentEl.textContent = Math.round(carbs);

  setCirclePercent(pCircleEl, protein, proteinNorm);
  setCirclePercent(fCircleEl, fat, fatNorm);
  setCirclePercent(cCircleEl, carbs, carbsNorm);
}

// ===============================
// WATER TRACKER LOGIC
// ===============================

let currentWaterMl = 0;

function updateWaterUI() {
  const waterNorm = getWaterNorm();
  const normMl = waterNorm * 1000;
  const visualPercent = Math.min((currentWaterMl / normMl) * 100, 100);

  if (waterFillEl) {
    waterFillEl.style.setProperty('--level', `${visualPercent}%`);
  }

  if (waterValueEl) {
    // ТУТ ФІКС: 2 знаки після коми (0.75)
    const currentL = (currentWaterMl / 1000).toFixed(2);
    waterValueEl.textContent = `${currentL} / ${waterNorm.toFixed(1)} L`;
    waterValueEl.style.opacity = currentWaterMl > 0 ? '1' : '0.5';
  }
}

export function addWater(ml) {
  currentWaterMl += ml;
  localStorage.setItem('waterTodayMl', currentWaterMl);
  updateWaterUI();
}

export function resetWater() {
  currentWaterMl = 0;
  localStorage.setItem('waterTodayMl', 0);
  updateWaterUI();
}

function initWaterTracker() {
  const saved = localStorage.getItem('waterTodayMl');
  currentWaterMl = saved ? parseInt(saved, 10) : 0;

  // Використовуємо надійне слухання кліків
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.water-btn');
    if (btn) {
      const amount = parseFloat(btn.dataset.amount);
      if (!isNaN(amount)) {
        addWater(amount * 1000);
      }
    }
  });

  const resetBtn = document.getElementById('resetWater');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      resetWater();
    });
  }

  updateWaterUI();
}

// Запуск при завантаженні
document.addEventListener('DOMContentLoaded', initWaterTracker);
