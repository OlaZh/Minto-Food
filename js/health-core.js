// ============================================================
// health-core.js — спільний розрахунок добової норми (Food + Fit)
// ============================================================
//
// ЄДИНЕ ДЖЕРЕЛО ПРАВДИ для формули калорій/макросів. Винесено з
// inline-логіки profile.js, щоб Minto Food і Minto Fit рахували
// однаково (див. docs/minto-food-fit-shared-health-plan.md, Крок 14 /
// Ризик 3: «різні формули калорій = хаос»). Будь-який новий споживач
// (onboarding wizard, Fit daily-summary) має кликати саме це, а не
// копіювати формулу.
//
// Чиста функція — без DOM, без БД, без localStorage. Тільки числа.

// Множники цілі: дефіцит для схуднення, профіцит для набору.
export const GOAL_MULTIPLIERS = {
  lose: 0.8,
  gain: 1.15,
  maintain: 1,
};

// Розподіл макросів від калорійності (білки 30% / жири 30% / вуглеводи 40%),
// калорійність на грам: білки 4, жири 9, вуглеводи 4.
const MACRO_SPLIT = { protein: 0.3, fat: 0.3, carbs: 0.4 };

// Базова норма води (л/добу). Поки константа — у профілі теж захардкоджено 2.5.
export const DEFAULT_WATER_L = 2.5;

/**
 * Базовий метаболізм за Mifflin-St Jeor.
 * @param {{gender:string, age:number, height:number, weight:number}} p
 * @returns {number} ккал/добу (BMR, без активності)
 */
export function calcBMR({ gender, age, height, weight }) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  // male: +5, інакше (female/не вказано): -161 — як у початковій формулі профілю.
  return gender === 'male' ? base + 5 : base - 161;
}

/**
 * Добова норма калорій і макросів.
 * @param {object} p
 * @param {string}  p.gender   'male' | 'female'
 * @param {number}  p.age      років
 * @param {number}  p.height   см
 * @param {number}  p.weight   кг
 * @param {number|string} p.activity множник активності (1.2 / 1.375 / …) — число або рядок
 * @param {string}  p.goal     'lose' | 'gain' | 'maintain'
 * @returns {{calories:number, protein:number, fat:number, carbs:number, water:number}}
 */
export function calcDailyNorm({ gender, age, height, weight, activity, goal }) {
  const bmr = calcBMR({ gender, age, height, weight });

  let calories = bmr * parseFloat(activity);
  calories *= GOAL_MULTIPLIERS[goal] ?? GOAL_MULTIPLIERS.maintain;
  calories = Math.round(calories);

  return {
    calories,
    protein: Math.round((calories * MACRO_SPLIT.protein) / 4),
    fat: Math.round((calories * MACRO_SPLIT.fat) / 9),
    carbs: Math.round((calories * MACRO_SPLIT.carbs) / 4),
    water: DEFAULT_WATER_L,
  };
}
