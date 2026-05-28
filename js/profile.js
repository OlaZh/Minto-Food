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
  setTheme,
  getLang,
  setLang,
} from './storage.js';
import { initCustomSelect, setSelectValue, initSelectsGlobalListener, showConfirmModal } from './ui-components.js';

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

// =====================================
// WEIGHT — SUPABASE HELPERS
// =====================================

async function saveWeightToSupabase(userId, weight) {
  const date = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from('weight_records')
    .upsert({ user_id: userId, date, weight }, { onConflict: 'user_id,date' });
  if (error) console.warn('weight_records upsert:', error.message);
  return !error;
}

async function loadWeightFromSupabase(userId) {
  const { data, error } = await supabase
    .from('weight_records')
    .select('date, weight')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  if (error) {
    console.warn('weight_records fetch:', error.message);
    return null;
  }
  return data || [];
}

function buildWeightChart(canvasId, history, chartRef) {
  const container = document.getElementById(canvasId);
  if (!container) return null;
  if (chartRef) chartRef.destroy();

  const labels = history.map((r) => {
    const [, m, d] = r.date.split('-');
    return `${d}.${m}`;
  });
  const weights = history.map((r) => Number(r.weight));
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const chart = new ApexCharts(container, {
    series: [{ name: 'Вага', data: weights }],
    chart: {
      type: 'area',
      height: 220,
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'inherit',
      animations: { enabled: true, speed: 500, easing: 'easeinout' },
      dropShadow: { enabled: true, top: 5, left: 0, blur: 10, opacity: 0.2, color: '#4ab584' },
    },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.02, stops: [0, 100] },
    },
    stroke: { curve: 'smooth', width: 2.5, colors: ['#4ab584'] },
    colors: ['#4ab584'],
    dataLabels: { enabled: false },
    xaxis: {
      categories: labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#9ca3af', fontSize: '11px' } },
    },
    yaxis: {
      labels: {
        formatter: (v) => v + ' кг',
        style: { colors: '#9ca3af', fontSize: '11px' },
      },
    },
    grid: { borderColor: 'rgba(156,163,175,0.12)', strokeDashArray: 3 },
    markers: { size: 4, colors: ['#4ab584'], strokeColors: '#fff', strokeWidth: 2 },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: (v) => v + ' кг' } },
    noData: { text: 'Немає даних', style: { color: '#9ca3af', fontSize: '14px' } },
  });
  chart.render();
  return chart;
}

async function initWeightChart() {
  const user = await getCurrentUser();
  if (!user) return;

  const history = await loadWeightFromSupabase(user.id);
  if (history === null) return;

  weightChart = buildWeightChart('weightChartCanvas', history, weightChart);
}

async function initWeightChart2() {
  const user = await getCurrentUser();
  if (!user) return;

  const history = await loadWeightFromSupabase(user.id);
  if (history === null) return;

  weightChart2 = buildWeightChart('weightChartCanvas2', history, weightChart2);
  generateWeightProgress(history);
}

async function recordNewWeight() {
  if (!weightNowInput || !weightNowInput.value) return;

  const weight = parseFloat(weightNowInput.value.replace(',', '.'));
  if (isNaN(weight) || weight < 20 || weight > 400) {
    showToast('Введіть коректну вагу', 'error');
    return;
  }

  const user = await getCurrentUser();
  if (!user) {
    showToast('Увійдіть в акаунт', 'error');
    return;
  }

  const ok = await saveWeightToSupabase(user.id, weight);
  if (!ok) {
    showToast('Помилка збереження', 'error');
    return;
  }

  weightNowInput.value = '';
  showToast(`Вага ${weight} кг збережена ✓`);

  await initWeightChart();
}

function generateWeightProgress(history) {
  const progressContainer = document.getElementById('weightProgressContent');
  if (!progressContainer || history.length === 0) return;

  const latest = history[history.length - 1]?.weight;
  const targetEl = document.getElementById('targetWeight2');
  const target = targetEl ? parseFloat(targetEl.value) : null;

  if (!latest) return;

  let html = `
    <div class="progress-status progress-status--success">
      <span style="font-size:1.8rem">⚖️</span>
      <div>
        <div style="font-weight:700;font-size:1.1rem;color:var(--color-text-primary)">${latest} кг</div>
        <div style="font-size:12px;color:var(--color-text-secondary)">Останній запис</div>
      </div>
    </div>`;

  if (target && latest) {
    const diff = Math.abs(latest - target).toFixed(1);
    const pct = Math.min(
      100,
      Math.round((1 - Math.abs(latest - target) / Math.max(Math.abs(latest), 1)) * 100),
    );
    html += `
      <div>
        <div class="progress-header">
          <span>Ціль: <strong>${target} кг</strong></span>
          <span class="progress-percent">${pct}%</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width:${pct}%"></div>
        </div>
        <div class="progress-footer">
          <span>Зараз: <strong>${latest} кг</strong></span>
          <span>Залишилось: <strong>${diff} кг</strong></span>
        </div>
      </div>`;
  }

  progressContainer.innerHTML = html;
}

// =====================================
// STATISTICS CHARTS
// =====================================

async function initStatisticsCharts() {
  Object.values(statisticsCharts).forEach((chart) => {
    if (chart) chart.destroy();
  });

  const user = await getCurrentUser();
  if (!user) return;

  // Діапазон: сьогодні - 13 днів (2 тижні)
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const dateFrom = fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13));
  const dateTo = fmt(today);

  const { data: meals } = await supabase
    .from('meals')
    .select('date, meal_type, kcal, protein, fat, carbs, name')
    .eq('user_id', user.id)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: true });

  const rows = meals || [];

  // ─── Розбивка по тижнях ──────────────────────────────────
  const thisWeekStart = fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));
  const thisWeek = rows.filter((r) => r.date >= thisWeekStart);
  const lastWeek = rows.filter((r) => r.date < thisWeekStart);

  // ─── Підсумок макро ──────────────────────────────────────
  function sumMacros(list) {
    return list.reduce(
      (a, r) => ({
        kcal: a.kcal + (Number(r.kcal) || 0),
        protein: a.protein + (Number(r.protein) || 0),
        fat: a.fat + (Number(r.fat) || 0),
        carbs: a.carbs + (Number(r.carbs) || 0),
      }),
      { kcal: 0, protein: 0, fat: 0, carbs: 0 },
    );
  }

  const thisTotals = sumMacros(thisWeek);
  const lastTotals = sumMacros(lastWeek);

  // ─── Калорії по днях (останні 7 днів) ────────────────────
  const dayLabels = [];
  const dayKcal = [];
  const DAY_UA = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    dayLabels.push(DAY_UA[d.getDay()]);
    const dateStr = fmt(d);
    const dayTotal = rows
      .filter((r) => r.date === dateStr)
      .reduce((s, r) => s + (Number(r.kcal) || 0), 0);
    dayKcal.push(Math.round(dayTotal));
  }

  // ─── Прийоми їжі по типах (цей тиждень) ─────────────────
  const mealTypeLabels = {
    breakfast: 'Сніданок',
    lunch: 'Обід',
    dinner: 'Вечеря',
    snack: 'Перекус',
  };
  const mealTypeCounts = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  thisWeek.forEach((r) => {
    if (r.meal_type in mealTypeCounts) mealTypeCounts[r.meal_type]++;
  });

  // ─── Топи тижня ──────────────────────────────────────────
  const nameCounts = {};
  thisWeek.forEach((r) => {
    if (r.name) nameCounts[r.name] = (nameCounts[r.name] || 0) + 1;
  });
  const topCooked = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const topCaloric =
    thisWeek.reduce((best, r) => (Number(r.kcal) > Number(best?.kcal || 0) ? r : best), null)
      ?.name || '—';
  const topHealthy =
    thisWeek
      .filter((r) => r.kcal > 0)
      .reduce((best, r) => {
        const ratio = Number(r.protein) / Number(r.kcal);
        return ratio > (best.ratio || 0) ? { name: r.name, ratio } : best;
      }, {})?.name || '—';

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setEl('topCooked', topCooked);
  setEl('topCaloric', topCaloric);
  setEl('topHealthy', topHealthy);

  // ─── Рекомендації ────────────────────────────────────────
  const tipsList = document.getElementById('statsTipsList');
  if (tipsList && thisWeek.length > 0) {
    const tips = [];
    const { protein: tp, fat: tf, carbs: tc, kcal: tk } = thisTotals;
    const total = tp + tf + tc;
    if (total > 0) {
      const protPct = tp / total;
      const fatPct = tf / total;
      if (protPct < 0.2) tips.push('Додай більше білкових страв — їх частка менше 20%');
      if (fatPct > 0.4) tips.push('Жири займають понад 40% — спробуй легші вечері');
      if (protPct >= 0.25 && fatPct <= 0.35) tips.push('Чудовий баланс БЖВ цього тижня 🌿');
    }
    const avgKcal = tk / 7;
    if (avgKcal > 0 && avgKcal < 1200)
      tips.push('Середня калорійність дуже низька — стеж за нормою');
    if (mealTypeCounts.breakfast < 3)
      tips.push('Сніданок — найважливіший прийом: цього тижня лише ' + mealTypeCounts.breakfast);
    if (tips.length === 0) tips.push('Все виглядає збалансовано, продовжуй у тому ж дусі 🎯');
    tipsList.innerHTML = tips.map((t) => `<li>${t}</li>`).join('');
  } else if (tipsList) {
    tipsList.innerHTML = "<li>Залоговані страви за останні 7 днів — з'являться рекомендації</li>";
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const COLORS = ['#6fcfba', '#f5a623', '#7b9cda', '#a78bfa'];
  const LABELS = ['Білки', 'Жири', 'Вуглеводи'];
  const APEX_GRID = { borderColor: 'rgba(156,163,175,0.12)', strokeDashArray: 3 };
  const APEX_TEXT = { colors: '#9ca3af', fontSize: '11px' };

  // ─── 1. Баланс макро (цей тиждень) ───────────────────────
  const balanceEl = document.getElementById('balancePieChart');
  if (balanceEl) {
    const { protein: p, fat: f, carbs: c } = thisTotals;
    statisticsCharts.balancePieChart = new ApexCharts(balanceEl, {
      series: p + f + c > 0 ? [Math.round(p), Math.round(f), Math.round(c)] : [],
      chart: {
        type: 'donut',
        height: 280,
        toolbar: { show: false },
        background: 'transparent',
        animations: { speed: 500 },
      },
      labels: LABELS,
      colors: COLORS,
      plotOptions: {
        pie: {
          donut: {
            size: '52%',
            labels: {
              show: true,
              name: { show: true, offsetY: -8, fontSize: '12px', color: '#9ca3af' },
              value: {
                show: true,
                offsetY: 6,
                fontSize: '22px',
                fontWeight: '700',
                color: '#4ab584',
                formatter: (v, opts) => {
                  const total = opts.w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                  return total > 0 ? Math.round((v / total) * 100) + '%' : '0%';
                },
              },
              total: {
                show: true,
                label: 'БЖВ',
                color: '#9ca3af',
                fontSize: '12px',
                formatter: (w) =>
                  Math.round(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) + ' г',
              },
            },
          },
        },
      },
      stroke: { width: 0 },
      dataLabels: { enabled: false },
      legend: { show: false },
      tooltip: { y: { formatter: (v) => v + ' г' } },
      noData: { text: 'Немає даних', style: { color: '#9ca3af', fontSize: '14px' } },
    });
    statisticsCharts.balancePieChart.render();
  }

  // ─── 2. Динаміка калорій (7 днів) ────────────────────────
  const kbjuEl = document.getElementById('kbjuLineChart');
  if (kbjuEl) {
    statisticsCharts.kbjuLineChart = new ApexCharts(kbjuEl, {
      series: [{ name: 'Калорії', data: dayKcal }],
      chart: {
        type: 'area',
        height: 280,
        toolbar: { show: false },
        background: 'transparent',
        fontFamily: 'inherit',
        animations: { speed: 500 },
        dropShadow: { enabled: true, top: 6, left: 0, blur: 12, opacity: 0.2, color: '#4ab584' },
      },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02 },
      },
      stroke: { curve: 'smooth', width: 2.5, colors: ['#4ab584'] },
      colors: ['#4ab584'],
      dataLabels: { enabled: false },
      xaxis: {
        categories: dayLabels,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: APEX_TEXT },
      },
      yaxis: { min: 0, labels: { formatter: (v) => Math.round(v), style: APEX_TEXT } },
      grid: APEX_GRID,
      markers: { size: 4, colors: ['#4ab584'], strokeColors: '#fff', strokeWidth: 2 },
      tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: (v) => v + ' ккал' } },
    });
    statisticsCharts.kbjuLineChart.render();
  }

  // ─── 3. Прийоми їжі по типах ─────────────────────────────
  const usefulnessEl = document.getElementById('usefulnessBarChart');
  if (usefulnessEl) {
    const counts = Object.values(mealTypeCounts);
    statisticsCharts.usefulnessBarChart = new ApexCharts(usefulnessEl, {
      series: [{ name: 'Разів', data: counts }],
      chart: {
        type: 'bar',
        height: 280,
        toolbar: { show: false },
        background: 'transparent',
        fontFamily: 'inherit',
        animations: { speed: 500 },
        dropShadow: { enabled: true, top: 4, blur: 8, opacity: 0.12 },
      },
      plotOptions: { bar: { borderRadius: 8, distributed: true, columnWidth: '55%' } },
      fill: {
        type: 'gradient',
        gradient: { shade: 'light', type: 'vertical', shadeIntensity: 0.15, opacityFrom: 1, opacityTo: 0.72, stops: [0, 100] },
      },
      colors: COLORS,
      dataLabels: { enabled: false },
      xaxis: {
        categories: Object.values(mealTypeLabels),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: APEX_TEXT },
      },
      yaxis: {
        min: 0,
        tickAmount: Math.max(1, Math.max(...counts)),
        labels: { formatter: (v) => Math.round(v), style: APEX_TEXT },
      },
      grid: APEX_GRID,
      legend: { show: false },
      tooltip: { y: { formatter: (v) => v + ' разів' } },
      noData: { text: 'Немає даних', style: { color: '#9ca3af', fontSize: '14px' } },
    });
    statisticsCharts.usefulnessBarChart.render();
  }

  // ─── 4. Минулий тиждень ───────────────────────────────────
  const lastWeekEl = document.getElementById('lastWeekChart');
  if (lastWeekEl) {
    const { protein: p, fat: f, carbs: c } = lastTotals;
    statisticsCharts.lastWeekChart = new ApexCharts(lastWeekEl, {
      series: p + f + c > 0 ? [Math.round(p), Math.round(f), Math.round(c)] : [],
      chart: {
        type: 'donut',
        height: 200,
        toolbar: { show: false },
        background: 'transparent',
        animations: { speed: 500 },
      },
      labels: LABELS,
      colors: COLORS,
      stroke: { width: 0 },
      dataLabels: { enabled: false },
      legend: { show: false },
      plotOptions: {
        pie: {
          donut: {
            size: '52%',
            labels: {
              show: true,
              name: { show: true, offsetY: -6, fontSize: '11px', color: '#9ca3af' },
              value: {
                show: true,
                offsetY: 4,
                fontSize: '18px',
                fontWeight: '700',
                color: '#6fcfba',
                formatter: (v, opts) => {
                  const total = opts.w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                  return total > 0 ? Math.round((v / total) * 100) + '%' : '0%';
                },
              },
              total: {
                show: true,
                label: 'БЖВ',
                color: '#9ca3af',
                fontSize: '10px',
                formatter: (w) =>
                  Math.round(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) + ' г',
              },
            },
          },
        },
      },
      tooltip: { y: { formatter: (v) => v + ' г' } },
      noData: { text: 'Немає даних', style: { color: '#9ca3af', fontSize: '14px' } },
    });
    statisticsCharts.lastWeekChart.render();
  }

  // ─── 5. Цей тиждень ──────────────────────────────────────
  const thisWeekEl = document.getElementById('thisWeekChart');
  if (thisWeekEl) {
    const { protein: p, fat: f, carbs: c } = thisTotals;
    statisticsCharts.thisWeekChart = new ApexCharts(thisWeekEl, {
      series: p + f + c > 0 ? [Math.round(p), Math.round(f), Math.round(c)] : [],
      chart: {
        type: 'donut',
        height: 200,
        toolbar: { show: false },
        background: 'transparent',
        animations: { speed: 500 },
      },
      labels: LABELS,
      colors: COLORS,
      stroke: { width: 0 },
      dataLabels: { enabled: false },
      legend: { show: false },
      plotOptions: {
        pie: {
          donut: {
            size: '52%',
            labels: {
              show: true,
              name: { show: true, offsetY: -6, fontSize: '11px', color: '#9ca3af' },
              value: {
                show: true,
                offsetY: 4,
                fontSize: '18px',
                fontWeight: '700',
                color: '#6fcfba',
                formatter: (v, opts) => {
                  const total = opts.w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                  return total > 0 ? Math.round((v / total) * 100) + '%' : '0%';
                },
              },
              total: {
                show: true,
                label: 'БЖВ',
                color: '#9ca3af',
                fontSize: '10px',
                formatter: (w) =>
                  Math.round(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) + ' г',
              },
            },
          },
        },
      },
      tooltip: { y: { formatter: (v) => v + ' г' } },
      noData: { text: 'Немає даних', style: { color: '#9ca3af', fontSize: '14px' } },
    });
    statisticsCharts.thisWeekChart.render();
  }
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
    const idealMin = Math.round(20 * h * h);
    const idealMax = Math.round(24 * h * h);
    let html = `Для твого зросту ідеальна вага <strong>${idealMin}–${idealMax} кг</strong>`;
    if (bmi < 18.5) {
      html += `<div class="weight-goal-warning weight-goal-warning--bmi">
        ІМТ нижче 18.5 відповідає <strong>недостатній вазі</strong>. Будь ласка, <a href="https://www.who.int/news-room/fact-sheets/detail/malnutrition" target="_blank" rel="noopener">зверніться до лікаря або дієтолога</a> для персонального плану харчування.
      </div>`;
    }
    bmiAdviceEl.innerHTML = html;
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
    checkTargetWeightWarning(data.target_weight);
  }
}

// =====================================
// PROFILE HEADER
// =====================================

async function updateProfileHeader(user) {
  if (!user) return;

  const { data: profileData } = await supabase
    .from('profiles')
    .select('display_name, full_name')
    .eq('id', user.id)
    .single();

  const name =
    profileData?.display_name ||
    profileData?.full_name ||
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

function checkTargetWeightWarning(value) {
  const dangerous = value > 0 && value < 17;
  ['targetWeightWarning', 'targetWeightWarning2'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !dangerous;
  });
}

function syncWeightInputs() {
  const targetWeight1 = document.getElementById('targetWeight');
  const targetWeight2 = document.getElementById('targetWeight2');
  const currentWeight1 = document.getElementById('currentWeightInput');
  const currentWeight2 = document.getElementById('currentWeightInput2');

  if (targetWeight1 && targetWeight2) {
    targetWeight1.addEventListener('input', () => {
      targetWeight2.value = targetWeight1.value;
      checkTargetWeightWarning(parseFloat(targetWeight1.value));
      generateWeightAdvice();
    });
    targetWeight2.addEventListener('input', () => {
      targetWeight1.value = targetWeight2.value;
      checkTargetWeightWarning(parseFloat(targetWeight2.value));
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
    saveBtn2.addEventListener('click', async () => {
      if (currentWeight2 && currentWeight1) currentWeight1.value = currentWeight2.value;
      await recordNewWeight();
      await initWeightChart2();
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

      otherInput.hidden = newOption.dataset.value !== 'other';

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

function initActivityChart() {
  const container = document.getElementById('activityChartCanvas');
  if (!container) return;

  const history = getActivityHistory();
  const now = new Date();

  const days = [];
  const caloriesData = [];

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

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  activityChart = new ApexCharts(container, {
    series: [{ name: 'Спалено ккал', data: caloriesData }],
    chart: {
      type: 'bar',
      height: 280,
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'inherit',
      animations: { enabled: true, speed: 400 },
      dropShadow: { enabled: true, top: 4, blur: 8, opacity: 0.12 },
    },
    plotOptions: { bar: { borderRadius: 5, columnWidth: '70%' } },
    fill: {
      type: 'gradient',
      gradient: { shade: 'light', type: 'vertical', shadeIntensity: 0.12, opacityFrom: 1, opacityTo: 0.75, stops: [0, 100] },
    },
    colors: ['#4ab584'],
    dataLabels: { enabled: false },
    xaxis: {
      categories: days,
      labels: { rotate: -45, style: { colors: '#9ca3af', fontSize: '9px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      labels: {
        formatter: (v) => Math.round(v) + ' ккал',
        style: { colors: '#9ca3af', fontSize: '10px' },
      },
    },
    grid: { borderColor: 'rgba(156,163,175,0.12)', strokeDashArray: 3 },
    legend: { show: false },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: (v) => v + ' ккал' } },
    noData: { text: 'Немає активностей', style: { color: '#9ca3af', fontSize: '14px' } },
  });
  activityChart.render();
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

  function showSection(section) {
    section.removeAttribute('hidden');
    section.style.display = '';
  }
  function hideSection(section) {
    section.setAttribute('hidden', '');
    section.style.display = 'none';
  }

  sections.forEach((section, index) => {
    if (index === 0) showSection(section);
    else hideSection(section);
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
        if (section.dataset.profileSection === tab) showSection(section);
        else hideSection(section);
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
// NICKNAME EDITOR
// =====================================

const _NB_MIN = 2, _NB_MAX = 25;
const _NB_ALLOWED = /^[\p{L}\p{N} \-_.]{2,25}$/u;
let _nbDebounce = null;
let _nbValid = false;

function _initNicknameEditor(user) {
  const editBtn    = document.getElementById('settingsEditName');
  const editor     = document.getElementById('nicknameEditor');
  const input      = document.getElementById('nicknameInput');
  const hint       = document.getElementById('nicknameHint');
  const saveBtn    = document.getElementById('nicknameSaveBtn');
  const cancelBtn  = document.getElementById('nicknameCancelBtn');
  const nameDisplay = document.getElementById('settingsNameDisplay');
  if (!editBtn || !editor || !input) return;

  editBtn.addEventListener('click', () => {
    input.value = nameDisplay?.textContent?.trim() === '—' ? '' : (nameDisplay?.textContent?.trim() || '');
    editor.hidden = false;
    editBtn.hidden = true;
    input.focus();
    _nbValid = false;
    saveBtn.disabled = true;
    _setNbHint(hint, `від ${_NB_MIN} до ${_NB_MAX} символів`, '');
  });

  cancelBtn.addEventListener('click', () => {
    editor.hidden = true;
    editBtn.hidden = false;
  });

  input.addEventListener('input', () => {
    const val = input.value.trim();
    _nbValid = false;
    saveBtn.disabled = true;
    input.style.borderColor = '#82bf99';

    if (!val) { _setNbHint(hint, `від ${_NB_MIN} до ${_NB_MAX} символів`, ''); return; }
    if (val.length < _NB_MIN) { _setNbHint(hint, `Мінімум ${_NB_MIN} символи`, '#e74c3c'); input.style.borderColor = '#e74c3c'; return; }
    if (!_NB_ALLOWED.test(val)) { _setNbHint(hint, 'Тільки літери, цифри, пробіл, . - _', '#e74c3c'); input.style.borderColor = '#e74c3c'; return; }

    _setNbHint(hint, 'Перевіряємо…', '#3f7558');
    clearTimeout(_nbDebounce);
    _nbDebounce = setTimeout(() => _checkNbUnique(val, user.id), 450);
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !saveBtn.disabled) saveBtn.click(); });

  saveBtn.addEventListener('click', async () => {
    const val = input.value.trim();
    if (!_nbValid || !val) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Збереження…';

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, display_name: val }, { onConflict: 'id' });

    if (error) {
      _setNbHint(hint, 'Помилка збереження', '#e74c3c');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Зберегти';
      return;
    }

    if (nameDisplay) nameDisplay.textContent = val;
    editor.hidden = true;
    editBtn.hidden = false;
    saveBtn.textContent = 'Зберегти';
    showToast('Нікнейм збережено ✓');
  });
}

async function _checkNbUnique(val, userId) {
  const input   = document.getElementById('nicknameInput');
  const hint    = document.getElementById('nicknameHint');
  const saveBtn = document.getElementById('nicknameSaveBtn');
  if (!input) return;

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .ilike('display_name', val)
    .neq('id', userId);

  if (input.value.trim() !== val) return; // stale check

  if (count > 0) {
    _setNbHint(hint, 'Це ім\'я вже зайняте, спробуй інше', '#e74c3c');
    input.style.borderColor = '#e74c3c';
    _nbValid = false;
    if (saveBtn) saveBtn.disabled = true;
  } else {
    _setNbHint(hint, '✓ Це ім\'я вільне', '#4ab584');
    input.style.borderColor = '#4ab584';
    _nbValid = true;
    if (saveBtn) saveBtn.disabled = false;
  }
}

function _setNbHint(el, text, color) {
  if (!el) return;
  el.textContent = text;
  el.style.color = color || '#3f7558';
}

// =====================================
// SETTINGS TAB
// =====================================

function initSettings(user) {
  // Email / name display
  const emailEl = document.getElementById('settingsEmailDisplay');
  const nameEl = document.getElementById('settingsNameDisplay');
  if (emailEl && user?.email) emailEl.textContent = user.email;
  if (nameEl) {
    supabase.from('profiles').select('display_name, full_name').eq('id', user.id).single()
      .then(({ data }) => {
        nameEl.textContent = data?.display_name || data?.full_name || user.user_metadata?.full_name || '';
      });
  }

  // Theme buttons
  function syncThemeBtns() {
    const current =
      document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    document.querySelectorAll('.settings-theme-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.themeSet === current);
    });
  }
  syncThemeBtns();

  document.querySelectorAll('.settings-theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.themeSet;
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        setTheme('dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
        setTheme('light');
      }
      syncThemeBtns();
    });
  });

  // Language buttons
  function syncLangBtns() {
    const current = getLang();
    document.querySelectorAll('.settings-lang-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === current);
    });
  }
  syncLangBtns();

  document.querySelectorAll('.settings-lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      syncLangBtns();
    });
  });

  // Unit buttons (UI only — no backend yet)
  const savedUnit = localStorage.getItem('units') || 'metric';
  document.querySelectorAll('.settings-unit-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.unit === savedUnit);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.settings-unit-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      localStorage.setItem('units', btn.dataset.unit);
    });
  });

  // Nickname editor
  _initNicknameEditor(user);

  // Sign out from settings
  document.getElementById('settingsSignOut')?.addEventListener('click', async () => {
    await signOut();
    window.location.href = 'index.html';
  });

  // Delete account (confirmation only — no backend yet)
  document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
    showConfirmModal({
      title: 'Видалити акаунт?',
      message: 'Цю дію неможливо скасувати. Всі дані буде втрачено назавжди.',
      confirmText: 'Так, видалити',
      onConfirm: () => {
        showToast('Функція видалення акаунту незабаром буде доступна', 'info');
      },
    });
  });
}

// =====================================
// INLINE CALORIES EDIT
// =====================================

function initCaloriesInlineEdit() {
  const displayEl = document.getElementById('dailyCalories');
  const inputEl = document.getElementById('caloriesInlineInput');
  if (!displayEl || !inputEl) return;

  let editing = false;

  function startEdit() {
    if (editing) return;
    editing = true;
    const current = parseInt(localStorage.getItem('dailyCaloriesNorm') || '0');
    inputEl.value = current || '';
    inputEl.hidden = false;
    displayEl.hidden = true;
    inputEl.focus();
    inputEl.select();
  }

  async function confirmEdit() {
    if (!editing) return;
    editing = false;

    const val = parseInt(inputEl.value);
    inputEl.hidden = true;
    displayEl.hidden = false;

    if (!val || val < 500 || val > 10000) return;

    displayEl.textContent = `${val} ккал`;
    localStorage.setItem('dailyCaloriesNorm', val);

    const user = getCurrentUser();
    if (user) {
      await supabase
        .from('user_profiles')
        .upsert({ user_id: user.id, calories: val }, { onConflict: 'user_id' });
    }
    showToast('Калорії оновлено ✓');
  }

  function cancelEdit() {
    if (!editing) return;
    editing = false;
    inputEl.hidden = true;
    displayEl.hidden = false;
  }

  displayEl.addEventListener('click', startEdit);
  displayEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(); }
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmEdit();
    if (e.key === 'Escape') cancelEdit();
  });
  inputEl.addEventListener('blur', () => { if (editing) setTimeout(confirmEdit, 80); });
}

// =====================================
// INIT
// =====================================

function getDayWord(n) {
  const l2 = n % 100,
    l1 = n % 10;
  if (l2 >= 11 && l2 <= 14) return 'днів';
  if (l1 === 1) return 'день';
  if (l1 >= 2 && l1 <= 4) return 'дні';
  return 'днів';
}

async function loadProfileStreak(userId) {
  const currentEl = document.getElementById('profileCurrentStreak');
  const longestEl = document.getElementById('profileLongestStreak');
  const wordEl = document.getElementById('profileStreakWord');
  if (!currentEl) return;

  try {
    const { data } = await supabase.rpc('get_current_streak', { p_user_id: userId });
    const s = data?.[0];
    if (s) {
      currentEl.textContent = s.current_streak;
      if (wordEl) wordEl.textContent = getDayWord(s.current_streak) + ' поспіль';
      if (longestEl) longestEl.textContent = s.longest_streak;
    }
  } catch {
    // silent fail
  }
}

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

  initCaloriesInlineEdit();
  recordWeightBtn?.addEventListener('click', recordNewWeight);

  initSelectsGlobalListener();
  await loadProfileFromSupabase();
  await loadProfileStreak(user.id);

  initWeightChart();
  initProfileTabs();
  initSettings(user);
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

    if (goalInput.value === 'lose') calories *= 0.80;
    if (goalInput.value === 'gain') calories *= 1.15;

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
