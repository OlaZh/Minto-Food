// ===============================
// STATS — DAILY PROGRESS (CALORIES, MACROS & WATER)
// ===============================

import {
  getWaterNorm,
  getDailyCaloriesNorm,
  getProteinNorm,
  getFatNorm,
  getCarbsNorm,
} from './storage.js';

// Calories & Macros UI Elements
const kcalCurrentEl = document.getElementById('kcalCurrent');
const kcalCircleEl = document.getElementById('kcalCircle');
const kcalNormLabelEl = document.getElementById('kcalNormLabel');

const pCircleEl = document.getElementById('pCircle');
const fCircleEl = document.getElementById('fCircle');
const cCircleEl = document.getElementById('cCircle');

const pCurrentEl = document.getElementById('pCurrent');
const fCurrentEl = document.getElementById('fCurrent');
const cCurrentEl = document.getElementById('cCurrent');

// Progress bars (new layout)
const goalBarEl = document.getElementById('goalBar');
const goalValueEl = document.getElementById('goalValue');
const pBarEl = document.getElementById('pBar');
const fBarEl = document.getElementById('fBar');
const cBarEl = document.getElementById('cBar');

// Water UI Elements
const waterValueEl = document.getElementById('currentWaterText');
const waterFillEl = document.getElementById('waterFill');

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
  if (kcalNormLabelEl) kcalNormLabelEl.textContent = `з ${dailyCaloriesNorm} ккал`;
  if (goalValueEl) goalValueEl.textContent = `${dailyCaloriesNorm} ккал`;

  setCirclePercent(kcalCircleEl, kcal, dailyCaloriesNorm);

  // Goal bar
  if (goalBarEl) {
    const goalPct = dailyCaloriesNorm ? Math.min((kcal / dailyCaloriesNorm) * 100, 100) : 0;
    goalBarEl.style.width = `${goalPct}%`;
  }

  if (pCurrentEl) pCurrentEl.textContent = Math.round(protein);
  if (fCurrentEl) fCurrentEl.textContent = Math.round(fat);
  if (cCurrentEl) cCurrentEl.textContent = Math.round(carbs);

  setCirclePercent(pCircleEl, protein, proteinNorm);
  setCirclePercent(fCircleEl, fat, fatNorm);
  setCirclePercent(cCircleEl, carbs, carbsNorm);

  // Macro progress bars
  if (pBarEl) pBarEl.style.width = `${proteinNorm ? Math.min((protein / proteinNorm) * 100, 100) : 0}%`;
  if (fBarEl) fBarEl.style.width = `${fatNorm ? Math.min((fat / fatNorm) * 100, 100) : 0}%`;
  if (cBarEl) cBarEl.style.width = `${carbsNorm ? Math.min((carbs / carbsNorm) * 100, 100) : 0}%`;
}

// ===============================
// WATER TRACKER LOGIC
// ===============================

let currentWaterMl = 0;

// Експортована функція — приймає літри (викликається з meals.js через Supabase)
// Якщо викликається зсередини без аргументу — бере currentWaterMl
export function updateWaterUI(currentLiters) {
  const waterNorm = getWaterNorm();

  const liters = currentLiters !== undefined ? currentLiters : currentWaterMl / 1000;

  const visualPercent = Math.min((liters / waterNorm) * 100, 100);

  if (waterFillEl) {
    waterFillEl.style.setProperty('--level', `${visualPercent}%`);
  }

  if (waterValueEl) {
    waterValueEl.textContent = `${liters.toFixed(2)} / ${waterNorm.toFixed(1)} L`;
    waterValueEl.style.opacity = liters > 0 ? '1' : '0.5';
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
