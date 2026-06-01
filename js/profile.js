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
import { getDayWord, showToast } from './utils.js';
import {
  getDailyCaloriesNorm,
  getUnitSystem,
  getUserProfile,
  loadUserStorage,
  mergeUserProfileCache,
  setTheme,
  getLang,
  setLang,
  setUnitSystem,
} from './storage.js';
import { saveProfileFields } from './storage.js';
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

// Виправлено: об'єкт активностей з name та caloriesPerMinute
const ACTIVITIES = {
  walking:    { icon: iconWalk,       label: 'Ходьба',             caloriesPerMinute: 4 },
  running:    { icon: iconRun,        label: 'Біг',                caloriesPerMinute: 10 },
  cycling:    { icon: iconBike,       label: 'Велосипед',          caloriesPerMinute: 8 },
  swimming:   { icon: iconSwim,       label: 'Плавання',           caloriesPerMinute: 9 },
  yoga:       { icon: iconYoga,       label: 'Йога',               caloriesPerMinute: 3 },
  fitness:    { icon: iconGym,        label: 'Фітнес',             caloriesPerMinute: 7 },
  dancing:    { icon: iconDance,      label: 'Танці',              caloriesPerMinute: 6 },
  hiking:     { icon: iconHike,       label: 'Похід',              caloriesPerMinute: 6 },
  tennis:     { icon: iconTennis,     label: 'Теніс',              caloriesPerMinute: 8 },
  basketball: { icon: iconBall,       label: 'Баскетбол',          caloriesPerMinute: 9 },
  football:   { icon: iconBall,       label: 'Футбол',             caloriesPerMinute: 9 },
  stretching: { icon: iconStretch,    label: 'Розтяжка',           caloriesPerMinute: 2 },
  cleaning:   { icon: iconGym,        label: 'Прибирання',         caloriesPerMinute: 3 },
  gardening:  { icon: iconGarden,     label: 'Садівництво',        caloriesPerMinute: 4 },
  gym:        { icon: iconGym,        label: 'Тренування в залі',  caloriesPerMinute: 7 },
  pilates:    { icon: iconYoga,       label: 'Пілатес',            caloriesPerMinute: 3 },
  elliptical: { icon: iconElliptical, label: 'Орбітрек',           caloriesPerMinute: 7 },
  other:      { icon: iconPlus,       label: 'Інша активність',    caloriesPerMinute: 5 },
};

// =====================================
// CHART INSTANCES
// =====================================

let weightChart = null;
let weightChart2 = null;
let activityChart = null;
let currentPeriod = 'week'; // Додано: змінна для періоду
let activityCache = []; // дзеркало user_activities з Supabase (синхронний доступ для рендера)
let weightHistoryCache = [];

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
  weightHistoryCache = data || [];
  return weightHistoryCache;
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
  const user = getCurrentUser();
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
  const user = getCurrentUser();
  if (!user) return;

  const history = await loadWeightFromSupabase(user.id);
  if (history === null) return;

  weightChart = buildWeightChart('weightChartCanvas', history, weightChart);
}

async function initWeightChart2() {
  const user = getCurrentUser();
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

  const user = getCurrentUser();
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
  showToast(`Вага ${weight} кг збережена`);

  const weightNowInput2 = document.getElementById('currentWeightInput2');
  if (weightNowInput2) weightNowInput2.value = '';

  await initWeightChart();
  await initWeightChart2();
  generateWeightAdvice();
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

  const user = getCurrentUser();
  if (!user) return;

  // Діапазон: сьогодні - 13 днів (2 тижні)
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const dateFrom = fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13));
  const dateTo = fmt(today);

  const { data: meals } = await supabase
    .from('meals')
    .select('date, meal_type, kcal, protein, fat, carbs, name, weight')
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
    if (topDishes.length > 0) {
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
        '<li class="stats-tops__empty">Залогуй страви за тиждень — тут зʼявляться твої топи</li>';
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
    deltaEl.textContent = (deltaKcal >= 0 ? '+' : '') + deltaKcal + ' г';
    deltaEl.className = 'profile-compare__delta ' + (deltaKcal >= 0 ? 'pos' : 'neg');
  }
  if (pctEl) {
    pctEl.textContent = (deltaPct >= 0 ? '+' : '') + deltaPct + '%';
  }

  // ─── Рекомендації ────────────────────────────────────────
  const tipsList = document.getElementById('statsTipsList');
  if (tipsList && thisWeek.length > 0) {
    const tips = [];
    const { protein: tp2, fat: tf2, carbs: tc2, kcal: tk2 } = thisTotals;
    const macroTotal = tp2 + tf2 + tc2;
    if (macroTotal > 0) {
      const protPct = tp2 / macroTotal;
      const fatPct = tf2 / macroTotal;
      if (protPct >= 0.25 && fatPct <= 0.35)
        tips.push({ title: 'Чудовий баланс БЖВ цього тижня', sub: 'Білки, жири та вуглеводи у здоровому співвідношенні' });
      if (protPct < 0.2)
        tips.push({ title: 'Додай більше білкових страв', sub: 'Їх частка менше 20% — спробуй м\'ясо, яйця, бобові' });
      if (fatPct > 0.4)
        tips.push({ title: 'Жири займають понад 40%', sub: 'Спробуй легші вечері або менше олії' });
    }
    const avgKcal = tk2 / 7;
    if (avgKcal > 0 && avgKcal < 1200)
      tips.push({ title: 'Калорійність дуже низька', sub: 'Середнє ' + Math.round(avgKcal) + ' ккал/день — стеж за нормою' });
    if (mealTypeCounts.dinner < 3)
      tips.push({ title: 'Додайте овочі до вечері', sub: 'Це підвищить кількість клітковини' });
    tips.push({ title: 'Пийте більше води зранку', sub: 'Ваша норма — 2.0 л на день' });

    const iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`;
    tipsList.innerHTML = tips
      .map(
        (t) =>
          `<li class="stats-tips__item"><span class="stats-tips__icon">${iconSvg}</span><span class="stats-tips__text"><strong>${t.title}</strong>${t.sub ? '<br><small>' + t.sub + '</small>' : ''}</span></li>`,
      )
      .join('');
  } else if (tipsList) {
    const iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>`;
    tipsList.innerHTML = `<li class="stats-tips__item"><span class="stats-tips__icon">${iconSvg}</span><span class="stats-tips__text">Залогуй страви за тиждень — з'являться рекомендації</span></li>`;
  }

  const COLORS = ['#6fcfba', '#f5a623', '#7b9cda'];
  const LABELS = ['Білки', 'Жири', 'Вуглеводи'];
  const APEX_GRID = { borderColor: 'rgba(156,163,175,0.08)', strokeDashArray: 4 };
  const APEX_TEXT = { colors: '#9ca3af', fontSize: '11px', fontFamily: 'inherit' };
  const NO_DATA = { text: 'Немає даних', style: { color: '#9ca3af', fontSize: '14px' } };

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
                label: totalLabel || 'БЖВ',
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
    const series = p + f + c > 0 ? [Math.round(p), Math.round(f), Math.round(c)] : [1, 1, 1];
    renderSvgDonut(balanceEl, series, 260, 'БЖВ');
  }

  // ─── 2. Динаміка калорій (7 днів) ────────────────────────
  const kbjuEl = document.getElementById('kbjuLineChart');
  if (kbjuEl) {
    statisticsCharts.kbjuLineChart = new ApexCharts(kbjuEl, {
      series: [{ name: 'Калорії', data: dayKcal }],
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
      series: [{ name: 'Разів', data: counts }],
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
    const series = p + f + c > 0 ? [Math.round(p), Math.round(f), Math.round(c)] : [1, 1, 1];
    renderSvgDonut(lastWeekEl, series, 190, 'БЖВ');
  }

  const thisWeekEl = document.getElementById('thisWeekChart');
  if (thisWeekEl) {
    const { protein: p, fat: f, carbs: c } = thisTotals;
    const series = p + f + c > 0 ? [Math.round(p), Math.round(f), Math.round(c)] : [1, 1, 1];
    renderSvgDonut(thisWeekEl, series, 190, 'БЖВ');
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
          ? 'Вага в нормі'
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
  mergeUserProfileCache(data);

  const burnedCalories = parseInt(
    document.getElementById('impactBurnedCalories')?.textContent || '0',
    10,
  );
  updateCalorieImpact(Number.isFinite(burnedCalories) ? burnedCalories : 0);
}

// =====================================
// SUPABASE — LOAD PROFILE
// =====================================

async function loadProfileFromSupabase() {
  const user = getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    const cachedProfile = getUserProfile();
    fillForm(cachedProfile);
    renderAll(cachedProfile);
    updateProfileHeader(user);
    return null;
  }

  fillForm(data);
  renderAll(data);
  updateProfileHeader(user);
  return data;
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
    'Користувач';
  const email = user.email || '';
  const avatar = user.user_metadata?.avatar_url || '';

  const profileNameEl = document.querySelector('.profile-header__name');
  const profileEmailEl = document.querySelector('.profile-header__email');
  const profileAvatarEl = document.querySelector('.profile-header__avatar');

  if (profileNameEl) profileNameEl.textContent = name;
  if (profileEmailEl) profileEmailEl.textContent = email;

  if (profileAvatarEl && avatar) {
    profileAvatarEl.textContent = '';
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
    profileAvatarEl.style.backgroundImage = 'none';
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
  if (!user) return;

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

  mergeUserProfileCache(data);
  showToast('Профіль збережено');
}

// =====================================
// WEIGHT ADVICE — ПЕРСОНАЛЬНІ ПОРАДИ
// =====================================

function generateWeightAdvice() {
  const adviceContainer = document.getElementById('weightAdviceContent');
  const progressContainer = document.getElementById('weightProgressContent');

  if (!adviceContainer) return;

  const weight = parseFloat(
    document.getElementById('weight')?.value || 0,
  );
  const height = parseFloat(
    document.getElementById('height')?.value || 0,
  );
  const goal =
    document.getElementById('goalInput')?.value || 'maintain';
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
    const startWeight = parseFloat(weightHistoryCache[0]?.weight || weight);
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
  const user = getCurrentUser();
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
      select.querySelector('.custom-select__trigger span').innerHTML = newOption.innerHTML;
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

    if (!activityType) return showToast('Оберіть вид активності', 'error');
    if (!duration || duration < 1) return showToast('Введіть тривалість', 'error');

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
      showToast('Помилка збереження активності', 'error');
      return;
    }

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

    showToast(`${activityLabel}: ${caloriesBurned} ккал спалено`);
  });
}

async function deleteActivity(activityId) {
  const ok = await deleteActivityFromSupabase(activityId);
  if (!ok) {
    showToast('Помилка видалення', 'error');
    return;
  }

  updateTodayStats();
  renderActivityHistory(currentPeriod);
  initActivityChart();
}

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
}

function updateCalorieImpact(burnedCalories) {
  const baseCalories = getDailyCaloriesNorm();
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
          <button class="activity-item__delete" data-activity-id="${activity.id}" title="Видалити">${iconXCircle}</button>
        </div>
      `;
    });

    html += `</div></div>`;
  }

  container.innerHTML = html;
  container.querySelectorAll('.activity-item__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const activityId = Number(btn.dataset.activityId);
      if (activityId) deleteActivity(activityId);
    });
  });
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
    noData: { text: 'Немає активностей', style: { color: '#9ca3af', fontSize: '14px' } },
  });
  activityChart.render();
}
// =====================================
// PROFILE TABS
// =====================================

function initSidebarIcons() {
  const map = {
    profileData:   { icon: iconUser,     label: 'Мої дані' },
    weightControl: { icon: iconScale,    label: 'Контроль ваги' },
    activity:      { icon: iconRun,      label: 'Активність' },
    statistics:    { icon: iconBarChart, label: 'Статистика' },
    settings:      { icon: iconSettings, label: 'Налаштування' },
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

    const ok = await saveProfileFields({ display_name: val }, user);

    if (!ok) {
      _setNbHint(hint, 'Помилка збереження', '#e74c3c');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Зберегти';
      return;
    }

    if (nameDisplay) nameDisplay.textContent = val;
    editor.hidden = true;
    editBtn.hidden = false;
    saveBtn.textContent = 'Зберегти';
    showToast('Нікнейм збережено');
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

function formatAccountDate(value) {
  if (!value) return '';

  try {
    return new Intl.DateTimeFormat('uk-UA', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function renderDeletionStatus(profileData = {}) {
  const statusEl = document.getElementById('settingsDeletionStatus');
  const deleteBtn = document.getElementById('deleteAccountBtn');
  const cancelBtn = document.getElementById('cancelDeletionBtn');
  if (!statusEl || !deleteBtn || !cancelBtn) return;

  const scheduledFor = profileData.deletion_scheduled_for;
  const requestedAt = profileData.deletion_requested_at;
  const isPending = Boolean(scheduledFor);

  statusEl.classList.toggle('is-pending', isPending);
  deleteBtn.hidden = isPending;
  cancelBtn.hidden = !isPending;

  if (isPending) {
    const scheduledLabel = formatAccountDate(scheduledFor);
    const requestedLabel = formatAccountDate(requestedAt);
    statusEl.textContent = requestedLabel
      ? `Запит на видалення створено ${requestedLabel}. Остаточне видалення заплановано на ${scheduledLabel}.`
      : `Запит на видалення активний. Остаточне видалення заплановано на ${scheduledLabel}.`;
    return;
  }

  statusEl.textContent = 'Акаунт активний. Запитів на видалення немає.';
}

async function syncReminderPreference(field, enabled) {
  const user = getCurrentUser();
  if (!user) return false;

  return saveProfileFields({ [field]: enabled }, user);
}

function bindReminderToggle(inputId, field, initialValue, successMessage) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.checked = Boolean(initialValue);
  input.addEventListener('change', async () => {
    const nextValue = input.checked;
    const ok = await syncReminderPreference(field, nextValue);

    if (!ok) {
      input.checked = !nextValue;
      showToast('Не вдалося зберегти налаштування', 'error');
      return;
    }

    showToast(successMessage);
  });
}

async function requestAccountDeletion(userId) {
  const { error } = await supabase.rpc('soft_delete_user', { p_user_id: userId });
  if (error) {
    console.warn('soft_delete_user:', error.message);
    showToast('Не вдалося створити запит на видалення', 'error');
    return false;
  }

  return true;
}

async function cancelAccountDeletionRequest(userId) {
  const { error } = await supabase.rpc('cancel_soft_delete_user', { p_user_id: userId });
  if (error) {
    console.warn('cancel_soft_delete_user:', error.message);
    showToast('Не вдалося скасувати запит', 'error');
    return false;
  }

  return true;
}

// =====================================
// SETTINGS TAB
// =====================================

async function initSettings(user) {
  // Email / name display
  const emailEl = document.getElementById('settingsEmailDisplay');
  const nameEl = document.getElementById('settingsNameDisplay');
  if (emailEl && user?.email) emailEl.textContent = user.email;
  const { data: profileDataRaw } = await supabase
    .from('profiles')
    .select(`
      display_name,
      full_name,
      meal_reminders_enabled,
      water_reminders_enabled,
      deletion_requested_at,
      deletion_scheduled_for
    `)
    .eq('id', user.id)
    .maybeSingle();

  let profileData = profileDataRaw || {};

  if (nameEl) {
    nameEl.textContent =
      profileData.display_name ||
      profileData.full_name ||
      user.user_metadata?.full_name ||
      '';
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
    btn.addEventListener('click', async () => {
      const theme = btn.dataset.themeSet;
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        await setTheme('dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
        await setTheme('light');
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
    btn.addEventListener('click', async () => {
      await setLang(btn.dataset.lang);
      syncLangBtns();
    });
  });

  const savedUnit = getUnitSystem();
  document.querySelectorAll('.settings-unit-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.unit === savedUnit);
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.settings-unit-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      await setUnitSystem(btn.dataset.unit);
    });
  });

  bindReminderToggle(
    'toggleMealReminders',
    'meal_reminders_enabled',
    profileData.meal_reminders_enabled,
    'Налаштування нагадувань про їжу збережено',
  );
  bindReminderToggle(
    'toggleWaterReminders',
    'water_reminders_enabled',
    profileData.water_reminders_enabled,
    'Налаштування нагадувань про воду збережено',
  );

  renderDeletionStatus(profileData);

  // Nickname editor
  _initNicknameEditor(user);

  // Sign out from settings
  document.getElementById('settingsSignOut')?.addEventListener('click', async () => {
    await signOut();
    window.location.href = 'index.html';
  });

  // Legacy handler kept only until the fresh button replacement below.
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

  const deleteBtn = document.getElementById('deleteAccountBtn');
  if (deleteBtn) {
    const freshDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.replaceWith(freshDeleteBtn);
    freshDeleteBtn.addEventListener('click', () => {
      showConfirmModal({
        title: 'Запросити видалення акаунту?',
        message:
          'Ми створимо GDPR-запит і заплануємо видалення через 30 днів. До цього моменту ти зможеш скасувати запит у профілі.',
        confirmText: 'Створити запит',
        onConfirm: async () => {
          const ok = await requestAccountDeletion(user.id);
          if (!ok) return;

          profileData = {
            ...profileData,
            deletion_requested_at: new Date().toISOString(),
            deletion_scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          };
          renderDeletionStatus(profileData);
          showToast('Запит на видалення акаунту створено');
        },
      });
    });
  }

  const cancelBtn = document.getElementById('cancelDeletionBtn');
  if (cancelBtn) {
    const freshCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.replaceWith(freshCancelBtn);
    freshCancelBtn.addEventListener('click', () => {
      showConfirmModal({
        title: 'Скасувати запит на видалення?',
        message: 'Акаунт залишиться активним, а запит на видалення буде відкликано.',
        confirmText: 'Скасувати запит',
        onConfirm: async () => {
          const ok = await cancelAccountDeletionRequest(user.id);
          if (!ok) return;

          profileData = {
            ...profileData,
            deletion_requested_at: null,
            deletion_scheduled_for: null,
          };
          renderDeletionStatus(profileData);
          showToast('Запит на видалення скасовано');
        },
      });
    });
  }
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
    const current = getDailyCaloriesNorm();
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
    mergeUserProfileCache({ calories: val });
    const burnedCalories = parseInt(
      document.getElementById('impactBurnedCalories')?.textContent || '0',
      10,
    );
    updateCalorieImpact(Number.isFinite(burnedCalories) ? burnedCalories : 0);

    const user = getCurrentUser();
    if (user) {
      await supabase
        .from('user_profiles')
        .upsert({ user_id: user.id, calories: val }, { onConflict: 'user_id' });
    }
    showToast('Калорії оновлено');
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
      await loadUserStorage(user, { force: true });
      await loadProfileFromSupabase();
      updateProfileHeader(user);
      initProfileTabs();
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
  await loadUserStorage(user, { force: true });
  const cachedProfile = getUserProfile();
  fillForm(cachedProfile);
  renderAll(cachedProfile);
  if (cachedProfile.target_weight) {
    checkTargetWeightWarning(cachedProfile.target_weight);
  }
  await loadProfileFromSupabase();
  await loadProfileStreak(user.id);

  initWeightChart();
  initSidebarIcons();
  initProfileTabs();
  generateWeightAdvice();
  await initSettings(user);
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
