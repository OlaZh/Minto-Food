import {
  getWaterNorm,
  getDailyCaloriesNorm,
  getProteinNorm,
  getFatNorm,
  getCarbsNorm,
} from './storage.js';

const kcalCurrentEl = document.getElementById('kcalCurrent');
const kcalCircleEl = document.getElementById('kcalCircle');
const kcalNormLabelEl = document.getElementById('kcalNormLabel');

const pCircleEl = document.getElementById('pCircle');
const fCircleEl = document.getElementById('fCircle');
const cCircleEl = document.getElementById('cCircle');

const pCurrentEl = document.getElementById('pCurrent');
const fCurrentEl = document.getElementById('fCurrent');
const cCurrentEl = document.getElementById('cCurrent');

const currentWaterMobileEl = document.getElementById('currentWaterMobile');
const waterNormMobileEl = document.getElementById('waterNormMobile');

const kcalCurrentMobileEl = document.getElementById('kcalCurrentMobile');
const kcalNormMobileEl = document.getElementById('kcalNormMobile');
const kcalCircleMobileEl = document.getElementById('kcalCircleMobile');
const pCurrentMobileEl = document.getElementById('pCurrentMobile');
const fCurrentMobileEl = document.getElementById('fCurrentMobile');
const cCurrentMobileEl = document.getElementById('cCurrentMobile');

const goalBarEl = document.getElementById('goalBar');
const goalValueEl = document.getElementById('goalValue');
const pBarEl = document.getElementById('pBar');
const fBarEl = document.getElementById('fBar');
const cBarEl = document.getElementById('cBar');

const waterValueEl = document.getElementById('currentWaterText');
const waterNormEl = document.getElementById('waterNormText');
const waterFillEl = document.getElementById('waterFill');

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

  if (kcalCurrentMobileEl) kcalCurrentMobileEl.textContent = Math.round(kcal);
  if (kcalNormMobileEl) kcalNormMobileEl.textContent = `з ${dailyCaloriesNorm} ккал`;
  if (pCurrentMobileEl) pCurrentMobileEl.textContent = Math.round(protein);
  if (fCurrentMobileEl) fCurrentMobileEl.textContent = Math.round(fat);
  if (cCurrentMobileEl) cCurrentMobileEl.textContent = Math.round(carbs);
  setCirclePercent(kcalCircleMobileEl, kcal, dailyCaloriesNorm);

  if (pBarEl) {
    pBarEl.style.width = `${proteinNorm ? Math.min((protein / proteinNorm) * 100, 100) : 0}%`;
  }
  if (fBarEl) {
    fBarEl.style.width = `${fatNorm ? Math.min((fat / fatNorm) * 100, 100) : 0}%`;
  }
  if (cBarEl) {
    cBarEl.style.width = `${carbsNorm ? Math.min((carbs / carbsNorm) * 100, 100) : 0}%`;
  }
}

export function updateWaterUI(currentLiters) {
  const waterNorm = getWaterNorm();
  const liters = Number(currentLiters) || 0;
  const visualPercent = Math.min((liters / waterNorm) * 100, 100);

  if (waterFillEl) {
    waterFillEl.style.setProperty('--level', `${visualPercent}%`);
  }

  if (waterValueEl) {
    waterValueEl.textContent = liters.toFixed(2);
    waterValueEl.style.opacity = liters > 0 ? '1' : '0.5';
  }
  if (waterNormEl) {
    waterNormEl.textContent = `з ${waterNorm.toFixed(1)} л`;
  }

  if (currentWaterMobileEl) currentWaterMobileEl.textContent = liters.toFixed(2);
  if (waterNormMobileEl) waterNormMobileEl.textContent = `${waterNorm.toFixed(1)} л`;
}

document.addEventListener('DOMContentLoaded', () => {
  updateWaterUI(0);
});
