// =====================================
// PROFILE — SUPABASE + AUTH VERSION
// =====================================

import { supabase } from './supabaseClient.js';
import {
  iconWalk, iconRun, iconBike, iconSwim, iconYoga, iconGym, iconDance,
  iconHike, iconTennis, iconBall, iconStretch, iconGarden, iconElliptical,
  iconPlus, iconBarChart, iconCheckCircle, iconAlert, iconXCircle,
  iconSalad, iconScale, iconCalendar, iconTarget, iconFlame, iconSprout,
  iconUser, iconSettings,
} from './icons.js';
import { initAuth, requireAuth, getCurrentUser, openAuthModal, signOut } from './auth.js';
import { showToast, pluralUA } from './utils.js';
import { t } from './i18n-apply.js';
import {
  setTheme,
  getLang,
  setLang,
  getWaterNorm,
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

// Виправлено: об'єкт активностей з name та caloriesPerMinute
// label через t() — обчислюється раз при завантаженні модуля; перемикач
// мови робить location.reload(), тож мова фіксована на момент load.
const ACTIVITIES = {
  walking:    { icon: iconWalk,       label: t('actWalking'),    caloriesPerMinute: 4 },
  running:    { icon: iconRun,        label: t('actRunning'),    caloriesPerMinute: 10 },
  cycling:    { icon: iconBike,       label: t('actCycling'),    caloriesPerMinute: 8 },
  swimming:   { icon: iconSwim,       label: t('actSwimming'),   caloriesPerMinute: 9 },
  yoga:       { icon: iconYoga,       label: t('actYoga'),       caloriesPerMinute: 3 },
  fitness:    { icon: iconGym,        label: t('actFitness'),    caloriesPerMinute: 7 },
  dancing:    { icon: iconDance,      label: t('actDancing'),    caloriesPerMinute: 6 },
  hiking:     { icon: iconHike,       label: t('actHiking'),     caloriesPerMinute: 6 },
  tennis:     { icon: iconTennis,     label: t('actTennis'),     caloriesPerMinute: 8 },
  basketball: { icon: iconBall,       label: t('actBasketball'), caloriesPerMinute: 9 },
  football:   { icon: iconBall,       label: t('actFootball'),   caloriesPerMinute: 9 },
  stretching: { icon: iconStretch,    label: t('actStretching'), caloriesPerMinute: 2 },
  cleaning:   { icon: iconGym,        label: t('actCleaning'),   caloriesPerMinute: 3 },
  gardening:  { icon: iconGarden,     label: t('actGardening'),  caloriesPerMinute: 4 },
  gym:        { icon: iconGym,        label: t('actGym'),        caloriesPerMinute: 7 },
  pilates:    { icon: iconYoga,       label: t('actPilates'),    caloriesPerMinute: 3 },
  elliptical: { icon: iconElliptical, label: t('actElliptical'), caloriesPerMinute: 7 },
  other:      { icon: iconPlus,       label: t('actOther'),      caloriesPerMinute: 5 },
};

// =====================================
// CHART INSTANCES
// =====================================

let weightChart = null;
let weightChart2 = null;
let activityChart = null;
let currentPeriod = 'week'; // Додано: змінна для періоду
let activityCache = []; // дзеркало user_activities з Supabase (синхронний доступ для рендера)

let statisticsCharts = {
  balancePieChart: null,
  kbjuLineChart: null,
  usefulnessBarChart: null,
  lastWeekChart: null,
  thisWeekChart: null,
};

function renderStatsEmptyState(container, message, compact = false) {
  if (!container) return;

  container.innerHTML = `
    <div class="stats-empty-state${compact ? ' stats-empty-state--compact' : ''}">
      <span class="stats-empty-state__text">${message}</span>
    </div>
  `;
}

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

// =====================================
// ACTIVITY — SUPABASE HELPERS
// =====================================

// Рядок БД → формат, який очікують рендер-функції (date/dateFormatted/time)
function mapActivityRow(row) {
  const d = new Date(row.performed_at);
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    icon: row.icon,
    duration: row.duration,
    calories: row.calories,
    date: row.performed_at,
    dateFormatted: d.toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
  };
}

async function loadActivitiesFromSupabase(userId) {
  const { data, error } = await supabase
    .from('user_activities')
    .select('id, type, label, icon, duration, calories, performed_at')
    .eq('user_id', userId)
    .order('performed_at', { ascending: false });
  if (error) {
    console.warn('user_activities fetch:', error.message);
    return false;
  }
  activityCache = (data || []).map(mapActivityRow);
  return true;
}

async function saveActivityToSupabase(activity) {
  const user = await getCurrentUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from('user_activities')
    .insert({
      user_id: user.id,
      type: activity.type,
      label: activity.label,
      icon: activity.icon,
      duration: activity.duration,
      calories: activity.calories,
      performed_at: activity.date,
    })
    .select('id, type, label, icon, duration, calories, performed_at')
    .single();
  if (error) {
    console.warn('user_activities insert:', error.message);
    return false;
  }
  activityCache.unshift(mapActivityRow(data));
  return true;
}

async function deleteActivityFromSupabase(activityId) {
  const { error } = await supabase.from('user_activities').delete().eq('id', activityId);
  if (error) {
    console.warn('user_activities delete:', error.message);
    return false;
  }
  activityCache = activityCache.filter((a) => a.id !== activityId);
  return true;
}

// Синхронний доступ до історії для рендер-функцій (читає кеш)
function getActivityHistory() {
  return activityCache;
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
    series: [{ name: t('weightLabel'), data: weights }],
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
    noData: { text: t('noData'), style: { color: '#9ca3af', fontSize: '14px' } },
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
    showToast(t('weightInvalid'), 'error');
    return;
  }

  const user = await getCurrentUser();
  if (!user) {
    showToast(t('signInRequired'), 'error');
    return;
  }

  const ok = await saveWeightToSupabase(user.id, weight);
  if (!ok) {
    showToast(t('saveError'), 'error');
    return;
  }

  weightNowInput.value = '';
  showToast(`Вага ${weight} кг збережена`);

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
      <span class="progress-status__icon">${iconScale}</span>
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

  const { data: meals, error: mealsError } = await supabase
    .from('meals')
    .select('date, meal_type, kcal, protein, fat, carbs, name, weight')
    .eq('user_id', user.id)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: true });

  if (mealsError) {
    console.warn('meals fetch:', mealsError.message);
  }

  const rows = meals || [];
  const hasStatisticsData = rows.length > 0;

  // ─── Розбивка по тижнях ──────────────────────────────────
  const thisWeekStart = fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));
  const thisWeek = rows.filter((r) => r.date >= thisWeekStart);
  const lastWeek = rows.filter((r) => r.date < thisWeekStart);
  const thisWeekDaysLogged = new Set(thisWeek.map((r) => r.date)).size;
  const hasThisWeekData = thisWeek.length > 0;
  const hasLastWeekData = lastWeek.length > 0;

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
  const DAY_NAMES = [
    t('daySun'), t('dayMon'), t('dayTue'), t('dayWed'), t('dayThu'), t('dayFri'), t('daySat'),
  ];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    dayLabels.push(DAY_NAMES[d.getDay()]);
    const dateStr = fmt(d);
    const dayTotal = rows
      .filter((r) => r.date === dateStr)
      .reduce((s, r) => s + (Number(r.kcal) || 0), 0);
    dayKcal.push(Math.round(dayTotal));
  }

  // ─── Прийоми їжі по типах (цей тиждень) ─────────────────
  const mealTypeLabels = {
    breakfast: t('breakfast'),
    lunch: t('lunch'),
    dinner: t('dinner'),
    snack: t('snack'),
  };
  const mealTypeCounts = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  thisWeek.forEach((r) => {
    if (r.meal_type in mealTypeCounts) mealTypeCounts[r.meal_type]++;
  });

  // ─── Топи тижня (топ-3 найчастіших страв) ────────────────
  const dishStats = {};
  thisWeek.forEach((r) => {
    if (!r.name) return;
    if (!dishStats[r.name]) dishStats[r.name] = { count: 0, weight: Number(r.weight) || 0 };
    dishStats[r.name].count++;
  });
  const topDishes = Object.entries(dishStats)
    .map(([name, s]) => ({ name, count: s.count, weight: s.weight }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const maxTopCount = topDishes[0]?.count || 1;

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  const topsListEl = document.getElementById('statsTopsListEl');
  if (topsListEl) {
    if (mealsError) {
      topsListEl.innerHTML =
        `<li class="stats-tops__empty">${t('topsLoadError')}</li>`;
    } else if (topDishes.length > 0) {
      topsListEl.innerHTML = topDishes
        .map((d, i) => {
          const rankClass = i === 0 ? 'stats-tops__rank--gold' : '';
          const rankContent = i === 0 ? '★' : i + 1;
          const pct = Math.round((d.count / maxTopCount) * 100);
          const weightLabel = d.weight > 0 ? ` · ${Math.round(d.weight)} гр` : '';
          return `
            <li class="stats-tops__item">
              <span class="stats-tops__rank ${rankClass}">${rankContent}</span>
              <div class="stats-tops__body">
                <div class="stats-tops__row">
                  <span class="stats-tops__name">${d.name}${weightLabel}</span>
                  <span class="stats-tops__count">${d.count}×</span>
                </div>
                <div class="stats-tops__bar">
                  <span class="stats-tops__fill" style="width:${pct}%"></span>
                </div>
              </div>
            </li>`;
        })
        .join('');
    } else {
      topsListEl.innerHTML =
        `<li class="stats-tops__empty">${t('topsEmpty')}</li>`;
    }
  }

  // ─── Легенда макро ───────────────────────────────────────
  const { protein: tp, fat: tf, carbs: tc } = thisTotals;
  setEl('legendProtein', Math.round(tp) + ' г');
  setEl('legendFat', Math.round(tf) + ' г');
  setEl('legendCarbs', Math.round(tc) + ' г');

  // ─── Дельта порівняння ───────────────────────────────────
  const thisTotal = thisTotals.kcal;
  const lastTotal = lastTotals.kcal;
  const deltaKcal = Math.round(thisTotal - lastTotal);
  const deltaPct = lastTotal > 0 ? Math.round((deltaKcal / lastTotal) * 100) : 0;
  const deltaEl = document.getElementById('compareDelta');
  const pctEl = document.getElementById('comparePct');
  if (deltaEl) {
    if (hasThisWeekData || hasLastWeekData) {
      deltaEl.textContent = (deltaKcal >= 0 ? '+' : '') + deltaKcal + ' ккал';
      deltaEl.className = 'profile-compare__delta ' + (deltaKcal >= 0 ? 'pos' : 'neg');
    } else {
      deltaEl.textContent = '—';
      deltaEl.className = 'profile-compare__delta';
    }
  }
  if (pctEl) {
    pctEl.textContent = hasThisWeekData || hasLastWeekData ? (deltaPct >= 0 ? '+' : '') + deltaPct + '%' : '—';
  }

  // ─── Рекомендації ────────────────────────────────────────
  const tipsList = document.getElementById('statsTipsList');
  if (tipsList && mealsError) {
    const iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>`;
    tipsList.innerHTML = `<li class="stats-tips__item"><span class="stats-tips__icon">${iconSvg}</span><span class="stats-tips__text">Не вдалося завантажити рекомендації. Спробуй оновити сторінку трохи пізніше.</span></li>`;
  } else if (tipsList && hasThisWeekData) {
    const tips = [];
    const { protein: tp2, fat: tf2, carbs: tc2, kcal: tk2 } = thisTotals;
    const macroTotal = tp2 + tf2 + tc2;
    if (macroTotal > 0) {
      const protPct = tp2 / macroTotal;
      const fatPct = tf2 / macroTotal;
      if (protPct >= 0.25 && fatPct <= 0.35)
        tips.push({ title: t('tipBalanceTitle'), sub: t('tipBalanceSub') });
      if (protPct < 0.2)
        tips.push({ title: t('tipProteinTitle'), sub: t('tipProteinSub') });
      if (fatPct > 0.4)
        tips.push({ title: t('tipFatTitle'), sub: t('tipFatSub') });
    }
    const avgKcal = thisWeekDaysLogged > 0 ? tk2 / thisWeekDaysLogged : 0;
    if (avgKcal > 0 && avgKcal < 1200)
      tips.push({ title: t('tipKcalTitle'), sub: t('tipKcalSubA') + Math.round(avgKcal) + t('tipKcalSubB') });
    if (thisWeekDaysLogged >= 4 && mealTypeCounts.dinner < 3)
      tips.push({ title: t('tipVegTitle'), sub: t('tipVegSub') });
    tips.push({ title: t('tipWaterTitle'), sub: t('tipWaterSubA') + getWaterNorm().toFixed(1) + t('tipWaterSubB') });
    if (!tips.length) {
      tips.push({ title: t('tipEvenTitle'), sub: t('tipEvenSub') });
    }

    const iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`;
    tipsList.innerHTML = tips
      .map(
        (t) =>
          `<li class="stats-tips__item"><span class="stats-tips__icon">${iconSvg}</span><span class="stats-tips__text"><strong>${t.title}</strong>${t.sub ? '<br><small>' + t.sub + '</small>' : ''}</span></li>`,
      )
      .join('');
  } else if (tipsList) {
    const iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>`;
    tipsList.innerHTML = `<li class="stats-tips__item"><span class="stats-tips__icon">${iconSvg}</span><span class="stats-tips__text">${t('tipEmptyState')}</span></li>`;
  }

  const COLORS = ['#6fcfba', '#f5a623', '#7b9cda'];
  const LABELS = [t('proteins'), t('fats'), t('carbsFull')];
  const APEX_GRID = { borderColor: 'rgba(156,163,175,0.08)', strokeDashArray: 4 };
  const APEX_TEXT = { colors: '#9ca3af', fontSize: '11px', fontFamily: 'inherit' };
  const NO_DATA = { text: t('noData'), style: { color: '#9ca3af', fontSize: '14px' } };

  // Колір зазорів = фон картки (світла/темна тема)
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const CARD_BG = isDark ? '#162e28' : '#c8ead5';
  const VALUE_COLOR = isDark ? '#eaf4ee' : '#1c3a2e';
  const LABEL_COLOR = isDark ? '#9bb3a8' : '#5b7468';

  function donutConfig(series, height, totalLabel) {
    const big = height >= 260;
    return {
      series,
      chart: {
        type: 'donut',
        height,
        toolbar: { show: false },
        background: 'transparent',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 750,
          animateGradually: { enabled: true, delay: 90 },
          dynamicAnimation: { enabled: true, speed: 400 },
        },
        dropShadow: {
          enabled: true,
          top: 0,
          left: 0,
          blur: 18,
          opacity: 0.35,
          color: '#6fcfba',
        },
      },
      labels: LABELS,
      colors: COLORS,
      // Кожен сегмент — м'який вертикальний градієнт від насиченого до трохи світлішого
      fill: {
        type: 'gradient',
        gradient: {
          type: 'vertical',
          shade: 'dark',
          shadeIntensity: 0,
          inverseColors: false,
          gradientToColors: ['#8fdcc6', '#f7bc5a', '#9bb6e6'],
          opacityFrom: 1,
          opacityTo: 1,
          stops: [0, 100],
        },
      },
      plotOptions: {
        pie: {
          // менший % = товще кільце
          donut: {
            size: big ? '54%' : '58%',
            labels: {
              show: true,
              name: {
                show: true,
                offsetY: big ? -14 : -11,
                fontSize: big ? '13px' : '11px',
                fontWeight: '600',
                color: LABEL_COLOR,
                fontFamily: 'inherit',
              },
              value: {
                show: true,
                offsetY: big ? 8 : 6,
                fontSize: big ? '36px' : '26px',
                fontWeight: '800',
                color: VALUE_COLOR,
                fontFamily: 'inherit',
                formatter: (v) => Math.round(v) + ' г',
              },
              total: {
                show: true,
                label: totalLabel || t('pfcShort'),
                color: LABEL_COLOR,
                fontSize: big ? '13px' : '11px',
                fontWeight: '600',
                fontFamily: 'inherit',
                formatter: (w) =>
                  Math.round(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) + ' г',
              },
            },
          },
        },
      },
      // Тонкі зазори між сегментами кольором фону картки
      stroke: { width: 2, colors: [CARD_BG], lineCap: 'round' },
      dataLabels: { enabled: false },
      legend: { show: false },
      states: {
        hover: { filter: { type: 'lighten', value: 0.06 } },
        active: { filter: { type: 'none' } },
      },
      // Кастомний тултіп: ● Назва · 250 г · 28 %
      tooltip: {
        enabled: true,
        custom: ({ series, seriesIndex, w }) => {
          const total = series.reduce((a, b) => a + b, 0);
          const val = Math.round(series[seriesIndex]);
          const pct = total > 0 ? Math.round((series[seriesIndex] / total) * 100) : 0;
          const label = w.globals.labels[seriesIndex];
          const color = w.globals.colors[seriesIndex];
          return (
            '<div class="stats-donut-tip">' +
            `<span class="stats-donut-tip__dot" style="background:${color}"></span>` +
            `<span class="stats-donut-tip__name">${label}</span>` +
            `<span class="stats-donut-tip__sep">·</span>` +
            `<span class="stats-donut-tip__val">${val} г</span>` +
            `<span class="stats-donut-tip__sep">·</span>` +
            `<span class="stats-donut-tip__pct">${pct} %</span>` +
            '</div>'
          );
        },
      },
      noData: NO_DATA,
    };
  }

  // Кастомний SVG-донат: заокруглені кінці сегментів, що накладаються (як у дизайні)
  function renderSvgDonut(el, series, size, totalLabel) {
    const total = series.reduce((a, b) => a + b, 0) || 1;
    const cx = size / 2;
    const cy = size / 2;
    const sw = size * 0.16; // товщина кільця
    const r = (size - sw) / 2 - 2; // радіус по центру штриха
    const C = 2 * Math.PI * r;
    const gapDeg = 4; // візуальний зазор між сегментами
    const overlapDeg = 7; // на скільки кінець наповзає на сусіда

    // м'які градієнти на сегмент (насичений → трохи світліший)
    const grads = [
      ['#6fcfba', '#8fdcc6'],
      ['#f5a623', '#f7bc5a'],
      ['#7b9cda', '#9bb6e6'],
    ];

    let defs = '';
    let arcs = '';
    let angle = -90; // старт зверху

    series.forEach((val, i) => {
      const frac = val / total;
      const sweep = frac * 360;
      // ефективні кути дуги: подовжуємо на overlap, лишаючи зазор
      const start = angle + gapDeg / 2 - overlapDeg;
      const end = angle + sweep - gapDeg / 2 + overlapDeg;
      const arcLen = ((end - start) / 360) * C;

      // dash: малюємо тільки потрібну дугу, решта прозора
      const rot = start; // поворот старту дуги
      const gid = `donutGrad${i}`;
      defs +=
        `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="${grads[i][0]}"/>` +
        `<stop offset="100%" stop-color="${grads[i][1]}"/>` +
        `</linearGradient>`;

      arcs +=
        `<circle class="svg-donut__seg" data-i="${i}" cx="${cx}" cy="${cy}" r="${r}" fill="none" ` +
        `stroke="url(#${gid})" stroke-width="${sw}" stroke-linecap="round" ` +
        `stroke-dasharray="${arcLen} ${C}" ` +
        `transform="rotate(${rot} ${cx} ${cy})" ` +
        `style="filter:drop-shadow(0 0 6px ${grads[i][0]}66);cursor:pointer;transition:opacity .2s"/>`;

      angle += sweep;
    });

    // розміри тексту пропорційні до розміру донату (база 260px)
    const k = size / 260;
    const labelFs = Math.round(13 * k);
    const valueFs = Math.round(34 * k);
    const labelDy = 8 * k;
    const valueDy = 24 * k;

    el.style.position = 'relative';
    el.innerHTML =
      `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" ` +
      `style="display:block;margin:0 auto;overflow:visible">` +
      `<defs>${defs}</defs>` +
      // легке загальне світіння під кільцем
      `<g style="filter:drop-shadow(0 0 14px rgba(111,207,186,.3))">${arcs}</g>` +
      // центральний текст
      `<text x="${cx}" y="${cy - labelDy}" text-anchor="middle" ` +
      `fill="${LABEL_COLOR}" font-size="${labelFs}" font-weight="600" font-family="inherit">${totalLabel}</text>` +
      `<text x="${cx}" y="${cy + valueDy}" text-anchor="middle" ` +
      `fill="${VALUE_COLOR}" font-size="${valueFs}" font-weight="800" font-family="inherit">${Math.round(total)} г</text>` +
      `</svg>` +
      `<div class="svg-donut-tip" hidden></div>`;

    // ── інтерактив: hover / tap по сегменту показує плашку ──
    const tip = el.querySelector('.svg-donut-tip');
    const segs = el.querySelectorAll('.svg-donut__seg');
    const baseColors = ['#6fcfba', '#f5a623', '#7b9cda'];

    const showTip = (i, clientX, clientY) => {
      const val = Math.round(series[i]);
      const pct = Math.round((series[i] / total) * 100);
      tip.innerHTML =
        '<div class="stats-donut-tip">' +
        `<span class="stats-donut-tip__dot" style="background:${baseColors[i]}"></span>` +
        `<span class="stats-donut-tip__name">${LABELS[i]}</span>` +
        `<span class="stats-donut-tip__sep">·</span>` +
        `<span class="stats-donut-tip__val">${val} г</span>` +
        `<span class="stats-donut-tip__sep">·</span>` +
        `<span class="stats-donut-tip__pct">${pct} %</span>` +
        '</div>';
      const rect = el.getBoundingClientRect();
      tip.style.left = clientX - rect.left + 'px';
      tip.style.top = clientY - rect.top + 'px';
      tip.hidden = false;
      segs.forEach((s) => (s.style.opacity = s.dataset.i == i ? '1' : '0.35'));
    };
    const hideTip = () => {
      tip.hidden = true;
      segs.forEach((s) => (s.style.opacity = '1'));
    };

    segs.forEach((seg) => {
      const i = +seg.dataset.i;
      seg.addEventListener('pointermove', (e) => showTip(i, e.clientX, e.clientY));
      seg.addEventListener('pointerenter', (e) => showTip(i, e.clientX, e.clientY));
      seg.addEventListener('pointerleave', hideTip);
    });
    // тап поза сегментами ховає плашку (для тачу)
    el.addEventListener('pointerdown', (e) => {
      if (!e.target.classList.contains('svg-donut__seg')) hideTip();
    });
  }

  // ─── 1. Баланс макро (цей тиждень) ───────────────────────
  const balanceEl = document.getElementById('balancePieChart');
  if (balanceEl) {
    const { protein: p, fat: f, carbs: c } = thisTotals;
    if (p + f + c > 0) {
      renderSvgDonut(balanceEl, [Math.round(p), Math.round(f), Math.round(c)], 260, t('pfcShort'));
    } else {
      renderStatsEmptyState(balanceEl, mealsError ? t('balanceLoadError') : t('noDataThisWeek'));
    }
  }

  // ─── 2. Динаміка калорій (7 днів) ────────────────────────
  const kbjuEl = document.getElementById('kbjuLineChart');
  if (kbjuEl) {
    statisticsCharts.kbjuLineChart = new ApexCharts(kbjuEl, {
      series: hasStatisticsData ? [{ name: t('caloriesFull'), data: dayKcal }] : [],
      chart: {
        type: 'area',
        height: 260,
        toolbar: { show: false },
        background: 'transparent',
        fontFamily: 'inherit',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 900,
          animateGradually: { enabled: true, delay: 100 },
        },
        dropShadow: { enabled: true, top: 8, left: 0, blur: 16, opacity: 0.25, color: '#4ab584' },
        sparkline: { enabled: false },
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          type: 'vertical',
          colorStops: [
            { offset: 0, color: '#4ab584', opacity: 0.4 },
            { offset: 100, color: '#4ab584', opacity: 0.02 },
          ],
        },
      },
      stroke: { curve: 'straight', width: 3, colors: ['#4ab584'] },
      colors: ['#4ab584'],
      dataLabels: { enabled: false },
      xaxis: {
        categories: dayLabels,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: APEX_TEXT },
      },
      yaxis: {
        min: 0,
        labels: { formatter: (v) => Math.round(v), style: APEX_TEXT },
      },
      grid: APEX_GRID,
      markers: {
        size: 5,
        colors: ['#4ab584'],
        strokeColors: '#1a2332',
        strokeWidth: 2,
        hover: { size: 7 },
      },
      tooltip: {
        theme: 'dark',
        style: { fontSize: '13px', fontFamily: 'inherit' },
        y: { formatter: (v) => Math.round(v) + ' ккал' },
      },
      noData: NO_DATA,
    });
    statisticsCharts.kbjuLineChart.render();
  }

  // ─── 3. Прийоми їжі по типах ─────────────────────────────
  const usefulnessEl = document.getElementById('usefulnessBarChart');
  if (usefulnessEl) {
    const counts = Object.values(mealTypeCounts);
    const maxCount = Math.max(...counts, 1);
    statisticsCharts.usefulnessBarChart = new ApexCharts(usefulnessEl, {
      series: hasThisWeekData ? [{ name: t('timesLabel'), data: counts }] : [],
      chart: {
        type: 'bar',
        height: 260,
        toolbar: { show: false },
        background: 'transparent',
        fontFamily: 'inherit',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 700,
          animateGradually: { enabled: true, delay: 120 },
        },
        dropShadow: { enabled: true, top: 6, blur: 10, opacity: 0.15 },
      },
      plotOptions: {
        bar: {
          borderRadius: 10,
          borderRadiusApplication: 'end',
          distributed: true,
          columnWidth: '50%',
        },
      },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'dark',
          type: 'vertical',
          shadeIntensity: 0.3,
          opacityFrom: 1,
          opacityTo: 0.65,
          stops: [0, 100],
        },
      },
      colors: COLORS.concat(['#a78bfa']),
      dataLabels: { enabled: false },
      xaxis: {
        categories: Object.values(mealTypeLabels),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: APEX_TEXT },
      },
      yaxis: {
        min: 0,
        tickAmount: Math.min(maxCount, 10),
        labels: { formatter: (v) => Math.round(v), style: APEX_TEXT },
      },
      grid: APEX_GRID,
      legend: { show: false },
      tooltip: {
        theme: 'dark',
        style: { fontSize: '13px', fontFamily: 'inherit' },
        y: { formatter: (v) => Math.round(v) + ' разів' },
      },
      noData: NO_DATA,
    });
    statisticsCharts.usefulnessBarChart.render();
  }

  // ─── 4 & 5. Порівняння тижнів ────────────────────────────
  const lastWeekEl = document.getElementById('lastWeekChart');
  if (lastWeekEl) {
    const { protein: p, fat: f, carbs: c } = lastTotals;
    if (p + f + c > 0) {
      renderSvgDonut(lastWeekEl, [Math.round(p), Math.round(f), Math.round(c)], 190, t('pfcShort'));
    } else {
      renderStatsEmptyState(lastWeekEl, mealsError ? t('loadError') : t('noData'), true);
    }
  }

  const thisWeekEl = document.getElementById('thisWeekChart');
  if (thisWeekEl) {
    const { protein: p, fat: f, carbs: c } = thisTotals;
    if (p + f + c > 0) {
      renderSvgDonut(thisWeekEl, [Math.round(p), Math.round(f), Math.round(c)], 190, t('pfcShort'));
    } else {
      renderStatsEmptyState(thisWeekEl, mealsError ? t('loadError') : t('noData'), true);
    }
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
        ? t('bmiUnder')
        : bmi < 25
          ? t('bmiNormal')
          : bmi < 30
            ? t('bmiOver')
            : t('bmiObese');
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
    .maybeSingle();

  const name =
    profileData?.display_name ||
    profileData?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    t('userDefault');
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
    showToast(t('saveError'), 'error');
    return;
  }

  localStorage.setItem('userProfile', JSON.stringify(data));
  showToast(t('profileSaved'));
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
    adviceHTML += `<div class="advice-item advice-item--info"><span class="advice-icon">${iconBarChart}</span><div class="advice-text"><strong>Ваш ІМТ: ${bmi}</strong> — недостатня вага. Рекомендована вага: ${idealWeightMin}–${idealWeightMax} кг.</div></div>`;
  } else if (bmi >= 18.5 && bmi < 25) {
    adviceHTML += `<div class="advice-item advice-item--success"><span class="advice-icon">${iconCheckCircle}</span><div class="advice-text"><strong>Ваш ІМТ: ${bmi}</strong> — вага в нормі! Чудово!</div></div>`;
  } else if (bmi >= 25 && bmi < 30) {
    adviceHTML += `<div class="advice-item advice-item--warning"><span class="advice-icon">${iconAlert}</span><div class="advice-text"><strong>Ваш ІМТ: ${bmi}</strong> — надмірна вага. Рекомендована: ${idealWeightMin}–${idealWeightMax} кг.</div></div>`;
  } else if (bmi >= 30) {
    adviceHTML += `<div class="advice-item advice-item--alert"><span class="advice-icon">${iconXCircle}</span><div class="advice-text"><strong>Ваш ІМТ: ${bmi}</strong> — ожиріння. Рекомендуємо консультацію лікаря.</div></div>`;
  }

  // Поради по цілі
  if (goal === 'lose') {
    adviceHTML += `<div class="advice-item"><span class="advice-icon">${iconSalad}</span><div class="advice-text"><strong>Ціль — схуднути.</strong> Дефіцит 300-500 ккал/день = 0.5-1 кг/тиждень.</div></div>`;
    adviceHTML += `<div class="advice-item"><span class="advice-icon">${iconWalk}</span><div class="advice-text">30 хвилин ходьби = 150-200 ккал додатково.</div></div>`;
  } else if (goal === 'gain') {
    adviceHTML += `<div class="advice-item"><span class="advice-icon">${iconFlame}</span><div class="advice-text"><strong>Ціль — набрати.</strong> +300-500 ккал, акцент на білок.</div></div>`;
  } else {
    adviceHTML += `<div class="advice-item"><span class="advice-icon">${iconScale}</span><div class="advice-text"><strong>Ціль — підтримка.</strong> Дотримуйтесь норми калорій.</div></div>`;
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
      <div class="progress-estimate"><span class="progress-icon">${iconCalendar}</span><div class="progress-text">При 0.5 кг/тиждень — ціль за <strong>${Math.ceil(diff / 0.5)} тижнів</strong>.</div></div>
    `;
  } else {
    progressHTML = `<div class="progress-status progress-status--empty"><span class="progress-icon">${iconTarget}</span><div class="progress-text">Встановіть бажану вагу для відстеження прогресу.</div></div>`;
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

async function initActivityTracker() {
  const user = await getCurrentUser();
  if (user) await loadActivitiesFromSupabase(user.id);

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

function injectActivityIcons() {
  const iconMap = {
    walking:    iconWalk,
    running:    iconRun,
    cycling:    iconBike,
    gym:        iconGym,
    bodyweight: iconStretch,
    yoga:       iconYoga,
    dancing:    iconDance,
    swimming:   iconSwim,
    stretching: iconStretch,
    pilates:    iconYoga,
    elliptical: iconElliptical,
    other:      iconPlus,
  };

  document.querySelectorAll('#activityTypeSelect .custom-select__option').forEach(opt => {
    const icon = iconMap[opt.dataset.value];
    const label = ACTIVITIES[opt.dataset.value]?.label ?? opt.textContent.replace(/^\S+\s*/, '').trim();
    if (icon && !opt.querySelector('.nav-icon')) {
      opt.innerHTML = `<span class="nav-icon">${icon}</span>${label}`;
    }
  });
}

function setupActivitySelect() {
  injectActivityIcons();
  const select = document.getElementById('activityTypeSelect');
  const input = document.getElementById('activityTypeInput');
  const durationInput = document.getElementById('activityDuration');

  if (!select || !input) {
    console.warn('Activity select not found');
    return;
  }

  // Спільний компонент (initCustomSelect тепер переносить innerHTML опції в
  // тригер → іконка .nav-icon зберігається). Викликається один раз — guard
  // activityTrackerInitialized гарантує відсутність дублів listeners.
  initCustomSelect('activityTypeSelect', 'activityTypeInput', (value) => {
    const otherInput = document.getElementById('otherActivityInput');
    if (otherInput) otherInput.hidden = value !== 'other';
    updateCaloriesPreview();
  });

  if (durationInput) {
    durationInput.addEventListener('input', updateCaloriesPreview);
  }
}

function updateCaloriesPreview() {
  const activityType = document.getElementById('activityTypeInput')?.value;
  const duration = parseInt(document.getElementById('activityDuration')?.value || 0);
  const previewEl = document.getElementById('previewCalories');

  if (!previewEl) return;

  if (activityType && duration > 0) {
    // Виправлено: використовуємо ACTIVITIES
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

  newBtn.addEventListener('click', async () => {
    const activityType = document.getElementById('activityTypeInput')?.value;
    const durationEl = document.getElementById('activityDuration');
    const duration = parseInt(durationEl?.value || 0);

    if (!activityType) return showToast(t('selectActivityType'), 'error');
    if (!duration || duration < 1) return showToast(t('enterDuration'), 'error');

    // Виправлено: використовуємо ACTIVITIES
    const activityData = ACTIVITIES[activityType];
    const caloriesPerMin = activityData ? activityData.caloriesPerMinute : 5;
    const activityLabel = activityData ? activityData.label : 'Активність';
    const activityIcon  = activityData ? activityData.icon  : '';
    const caloriesBurned = Math.round(caloriesPerMin * duration);

    const activity = {
      id: Date.now(),
      type: activityType,
      label: activityLabel,
      icon:  activityIcon,
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

    const saved = await saveActivityToSupabase(activity);
    if (!saved) {
      showToast(t('activitySaveError'), 'error');
      return;
    }

    // Clear form
    if (durationEl) durationEl.value = '';
    document.getElementById('activityTypeInput').value = '';
    const triggerSpan = document.querySelector('#activityTypeSelect .custom-select__trigger span');
    if (triggerSpan) triggerSpan.textContent = t('selectActivityPlaceholder');
    document
      .querySelectorAll('#activityTypeSelect .custom-select__option')
      .forEach((o) => o.classList.remove('selected'));
    updateCaloriesPreview();

    updateTodayStats();
    renderActivityHistory(currentPeriod);
    initActivityChart();

    showToast(`${activityLabel}: ${caloriesBurned} ккал спалено`);
  });
}

async function deleteActivity(activityId) {
  const ok = await deleteActivityFromSupabase(activityId);
  if (!ok) {
    showToast(t('deleteError'), 'error');
    return;
  }

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
    container.innerHTML = `<div class="activity-history-empty"><span class="empty-icon">${iconRun}</span><p>Немає записів за цей період.</p></div>`;
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
          <div class="activity-item__icon">${activity.icon || ''}</div>
          <div class="activity-item__info">
            <span class="activity-item__name">${activity.label || activity.name || ''}</span>
            <span class="activity-item__details">${activity.duration} хв • ${activity.time}</span>
          </div>
          <div class="activity-item__calories">
            <span class="activity-item__calories-value">-${activity.calories}</span>
            <span class="activity-item__calories-label">ккал</span>
          </div>
          <button class="activity-item__delete" onclick="deleteActivity(${activity.id})" title="Видалити">${iconXCircle}</button>
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
    series: [{ name: t('burnedKcal'), data: caloriesData }],
    chart: {
      type: 'bar',
      height: 280,
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'inherit',
      animations: { enabled: true, speed: 400 },
      dropShadow: { enabled: true, top: 4, blur: 8, opacity: 0.12 },
    },
    plotOptions: { bar: { borderRadius: 5, columnWidth: '55%' } },
    fill: {
      type: 'gradient',
      gradient: { shade: 'light', type: 'vertical', shadeIntensity: 0.12, opacityFrom: 1, opacityTo: 0.75, stops: [0, 100] },
    },
    colors: ['#4ab584'],
    dataLabels: { enabled: false },
    xaxis: {
      categories: days,
      tickAmount: 10,
      labels: {
        rotate: -45,
        hideOverlappingLabels: true,
        style: { colors: '#9ca3af', fontSize: '9px' },
      },
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
    grid: { borderColor: 'rgba(156,163,175,0.12)', strokeDashArray: 3, padding: { right: 24, left: 8 } },
    legend: { show: false },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: (v) => v + ' ккал' } },
    noData: { text: t('noActivities'), style: { color: '#9ca3af', fontSize: '14px' } },
  });
  activityChart.render();
}
// =====================================
// PROFILE TABS
// =====================================

function initSidebarIcons() {
  const map = {
    profileData:   { icon: iconUser,     label: t('tabMyData') },
    weightControl: { icon: iconScale,    label: t('weightControl') },
    activity:      { icon: iconRun,      label: t('tabActivity') },
    statistics:    { icon: iconBarChart, label: t('tabStatistics') },
    settings:      { icon: iconSettings, label: t('tabSettings') },
  };
  document.querySelectorAll('.profile-sidebar__item[data-tab]').forEach(btn => {
    const entry = map[btn.dataset.tab];
    if (entry && !btn.querySelector('.nav-icon')) {
      btn.innerHTML = `<span class="nav-icon">${entry.icon}</span>${entry.label}`;
    }
  });
}

function initProfileTabs() {
  const buttons = document.querySelectorAll('.profile-sidebar__item');
  const sections = document.querySelectorAll('[data-profile-section]');

  if (!buttons.length || !sections.length) {
    console.warn('initProfileTabs: не знайдено кнопок або секцій');
    return;
  }

  // Захист від подвійної ініціалізації
  if (buttons[0]?.dataset.tabInit) return;
  buttons.forEach(b => b.dataset.tabInit = '1');

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

  buttons.forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  buttons[0]?.classList.add('active');
  buttons[0]?.setAttribute('aria-selected', 'true');

  const nav = buttons[0]?.closest('.profile-sidebar');
  const isMobile = () => window.innerWidth <= 1000;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const alreadyActive = btn.classList.contains('active');

      // На мобільному: тап на активний таб = відкрити/закрити список
      if (isMobile() && alreadyActive) {
        nav?.classList.toggle('open');
        return;
      }

      // Закриваємо dropdown і перемикаємо таб
      nav?.classList.remove('open');

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

  // Закриваємо якщо тапнули поза навом
  document.addEventListener('click', (e) => {
    if (isMobile() && nav && !nav.contains(e.target)) {
      nav.classList.remove('open');
    }
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
    if (!_NB_ALLOWED.test(val)) { _setNbHint(hint, t('nickOnlyChars'), '#e74c3c'); input.style.borderColor = '#e74c3c'; return; }

    _setNbHint(hint, t('nickChecking'), '#3f7558');
    clearTimeout(_nbDebounce);
    _nbDebounce = setTimeout(() => _checkNbUnique(val, user.id), 450);
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !saveBtn.disabled) saveBtn.click(); });

  saveBtn.addEventListener('click', async () => {
    const val = input.value.trim();
    if (!_nbValid || !val) return;

    saveBtn.disabled = true;
    saveBtn.textContent = t('nickSaving');

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
    showToast(t('nicknameSaved'));
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
    _setNbHint(hint, t('nickTaken'), '#e74c3c');
    input.style.borderColor = '#e74c3c';
    _nbValid = false;
    if (saveBtn) saveBtn.disabled = true;
  } else {
    _setNbHint(hint, 'Це ім\'я вільне', '#4ab584');
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
      if (btn.dataset.lang === getLang()) return; // вже ця мова
      setLang(btn.dataset.lang);
      // reload — як footer-перемикач: чисто перемальовує весь контент
      // (статику через applyTranslations + динамічний JS-рендер профілю).
      location.reload();
    });
  });

  // Unit buttons are intentionally disabled until conversions are wired to the UI.
  document.querySelectorAll('.settings-unit-btn').forEach((btn) => {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
  });

  // Nickname editor
  _initNicknameEditor(user);

  // Sign out from settings
  document.getElementById('settingsSignOut')?.addEventListener('click', async () => {
    await signOut();
    window.location.href = 'index.html';
  });

  // Pending controls stay disabled so the settings UI reflects the current product state.
  ['toggleMealReminders', 'toggleWaterReminders', 'deleteAccountBtn'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = true;
    el.setAttribute('aria-disabled', 'true');
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
    showToast(t('caloriesUpdated'));
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

// Локалізований лейбл серії днів: "N днів поспіль" / "N dni z rzędu" / "N days in a row"
function _streakLabel(n) {
  const lang = getLang() === 'uk' ? 'ua' : getLang();
  if (lang === 'pl') return `${n === 1 ? 'dzień' : 'dni'} z rzędu`;
  if (lang === 'en') return `${n === 1 ? 'day' : 'days'} in a row`;
  return pluralUA(n, ['день', 'дні', 'днів']) + ' поспіль';
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
      if (wordEl) wordEl.textContent = _streakLabel(s.current_streak);
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
  initSidebarIcons();
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
