// js/parse-food.js
// Парсер продуктів з pg_trgm пошуком через Supabase

import { supabase } from './supabaseClient.js';

// =====================================
// КОНСТАНТИ
// =====================================

const UNIT_CONVERSIONS = {
  // Вага
  г: 1, гр: 1, грам: 1, грами: 1, грамів: 1,
  g: 1, gram: 1, grams: 1,
  кг: 1000, кілограм: 1000, кілограма: 1000, кілограми: 1000,
  kg: 1000,
  oz: 28.35, ounce: 28.35,
  lb: 453.6, pound: 453.6,
  // Об'єм
  мл: 1, ml: 1,
  л: 1000, літр: 1000, літра: 1000, l: 1000, liter: 1000,
  // Ложки
  'ч.л.': 5, 'ч.л': 5, чл: 5, tsp: 5, teaspoon: 5,
  'ст.л.': 15, 'ст.л': 15, стл: 15, tbsp: 15, tablespoon: 15,
  ложка: 15, ложки: 15, ложок: 15,
  // Склянки / стакани
  склянка: 250, склянки: 250, склянок: 250,
  стакан: 200, стакана: 200, стакани: 200,
  cup: 250, cups: 250,
  // Щіпки / дрібки
  щіпка: 2, щіпки: 2, щіпок: 2,
  дрібка: 1, дрібки: 1, дрібок: 1,
  pinch: 2,
  // Жмені
  жменя: 30, жмені: 30, жмень: 30, жменька: 30, жменьки: 30,
  handful: 30,
  // Пачки / упаковки
  пачка: 200, пачки: 200, пачок: 200,
  упаковка: 200, упаковки: 200,
  // Штуки (grams=null → шукаємо в product_units)
  шт: null, 'шт.': null, штука: null, штуки: null, штук: null,
  pcs: null, piece: null, pieces: null,
};

// Одиниці що означають "штука" — кількість грамів береться з product_units
const PIECE_UNITS = new Set(
  Object.entries(UNIT_CONVERSIONS)
    .filter(([, v]) => v === null)
    .map(([k]) => k)
);

// Одиниці ваги/об'єму, для яких "без числа" не має сенсу ("сіль г", "сіль мл").
// Їх Патерн 5/6 (одиниця без числа) ігнорує — без числа ловимо лише мірні
// одиниці на кшталт дрібка/щіпка/жменя/склянка/пачка.
const IMPLICIT_ONE_EXCLUDE = new Set([
  'г', 'гр', 'грам', 'грами', 'грамів', 'g', 'gram', 'grams',
  'кг', 'кілограм', 'кілограма', 'кілограми', 'kg',
  'oz', 'ounce', 'lb', 'pound',
  'мл', 'ml', 'л', 'літр', 'літра', 'l', 'liter',
]);

// Регекс для всіх відомих одиниць (довші — першими, щоб "ст.л." не зматчилось як "ст")
const UNIT_RE_SRC = Object.keys(UNIT_CONVERSIONS)
  .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .sort((a, b) => b.length - a.length)
  .join('|');

// Слова, що вказують на термічну/кулінарну обробку (стан).
// Наявність стану → шукаємо готову страву в `recipes`, а не сирий продукт.
const COOKING_WORDS = [
  'варен', 'відварен', 'зварен', 'проварен',
  'смажен', 'жарен', 'обсмажен', 'підсмажен', 'засмажен',
  'тушен', 'затушен',
  'запечен', 'печен', 'пропечен', 'спечен',
  'копчен', 'підкопчен',
  'гриль', 'грилен', 'грильован',
  'пасеров', 'бланшир', 'припущен',
  'маринован', 'квашен', 'солен', 'засолен', 'мочен',
  'фарширован', 'панірован', 'клярі',
  'на пару', 'парен', 'парован',
];

function hasCookingWords(text) {
  const t = text.toLowerCase();
  return COOKING_WORDS.some((w) => t.includes(w));
}

// Слова для ігнорування при пошуку
const STOP_WORDS = new Set([
  'великий',
  'велика',
  'великі',
  'великих',
  'середній',
  'середня',
  'середні',
  'середніх',
  'маленький',
  'маленька',
  'маленькі',
  'маленьких',
  'свіжий',
  'свіжа',
  'свіжі',
  'свіжих',
  'нарізаний',
  'нарізана',
  'нарізані',
  'для',
  'або',
  'та',
  'і',
  'з',
  'на',
  'по',
  'до',
  'за',
  'без',
  'дуже',
  'трохи',
  'багато',
  'мало',
  'приблизно',
  'близько',
]);

// =====================================
// УТИЛІТИ
// =====================================

/**
 * Нормалізує текст для пошуку
 */
function normalizeText(text) {
  if (!text) return '';

  return text
    .toLowerCase()
    .replace(/[^\wа-яіїєґ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Прибирає стоп-слова
 */
function removeStopWords(text) {
  const words = normalizeText(text).split(' ');
  const filtered = words.filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return filtered.join(' ') || text;
}

// =====================================
// ПАРСИНГ ІНГРЕДІЄНТІВ
// =====================================

/**
 * Парсить рядок інгредієнта
 * "2 яблука" → { name: "яблука", amount: 2, unit: "шт" }
 * "курка 200 г" → { name: "курка", amount: 200, unit: "г", grams: 200 }
 */
export function parseFoodInput(input) {
  if (!input) return null;

  let text = input.toLowerCase().trim();

  // Нормалізуємо багатослівні одиниці перед основним парсингом
  text = text
    .replace(/столов[иіая]+\s+ложк[иаою]*/gi, 'ст.л.')
    .replace(/чайн[иіая]+\s+ложк[иаою]*/gi, 'ч.л.')
    .replace(/[—–-]+/g, ' ')
    .replace(/[,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let amount = null;
  let unit = null;
  let grams = null;
  let name = text;

  // Патерн 1: "200 г курки" / "1 щіпка солі" / "2 жмені горіхів"
  let match = text.match(
    new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_RE_SRC})\\.?\\s+(.+)$`, 'i'),
  );
  if (match) {
    amount = parseFloat(match[1].replace(',', '.'));
    unit = match[2].toLowerCase();
    name = match[3].trim();
    const conv = UNIT_CONVERSIONS[unit];
    grams = PIECE_UNITS.has(unit) ? null : amount * (conv ?? 1);
  }

  // Патерн 2: "курка 200 г" / "сіль 1 щіпка"
  if (!match) {
    match = text.match(
      new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_RE_SRC})\\.?$`, 'i'),
    );
    if (match) {
      name = match[1].trim();
      amount = parseFloat(match[2].replace(',', '.'));
      unit = match[3].toLowerCase();
      const conv = UNIT_CONVERSIONS[unit];
      grams = PIECE_UNITS.has(unit) ? null : amount * (conv ?? 1);
    }
  }

  // Патерн 3: "2 яйця"
  if (!match) {
    match = text.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
    if (match) {
      amount = parseFloat(match[1].replace(',', '.'));
      name = match[2].trim();
      unit = 'шт';
    }
  }

  // Патерн 4: "яйця 2"
  if (!match) {
    match = text.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)$/);
    if (match) {
      name = match[1].trim();
      amount = parseFloat(match[2].replace(',', '.'));
      unit = 'шт';
    }
  }

  // Патерн 5/6: одиниця БЕЗ числа, кількість мається на увазі = 1.
  // Природна мова: "сіль дрібка", "дрібка солі", "щіпка перцю", "склянка борошна".
  // Лише для безкількісних мірних одиниць (дрібка/щіпка/жменя/склянка/...),
  // НЕ для "г"/"мл"/"шт" — "сіль г" не має сенсу.
  if (!match) {
    // "сіль дрібка" — назва, потім одиниця в кінці
    match = text.match(new RegExp(`^(.+?)\\s+(${UNIT_RE_SRC})\\.?$`, 'i'));
    if (match && !PIECE_UNITS.has(match[2].toLowerCase()) && !IMPLICIT_ONE_EXCLUDE.has(match[2].toLowerCase())) {
      name = match[1].trim();
      unit = match[2].toLowerCase();
      amount = 1;
      grams = amount * (UNIT_CONVERSIONS[unit] ?? 1);
    } else {
      match = null;
    }
  }
  if (!match) {
    // "дрібка солі" — одиниця на початку, потім назва
    match = text.match(new RegExp(`^(${UNIT_RE_SRC})\\.?\\s+(.+)$`, 'i'));
    if (match && !PIECE_UNITS.has(match[1].toLowerCase()) && !IMPLICIT_ONE_EXCLUDE.has(match[1].toLowerCase())) {
      unit = match[1].toLowerCase();
      name = match[2].trim();
      amount = 1;
      grams = amount * (UNIT_CONVERSIONS[unit] ?? 1);
    } else {
      match = null;
    }
  }

  const searchName = removeStopWords(name);

  return {
    raw: input,
    name: name,
    searchName: searchName,
    amount: amount || 1,
    unit: unit || 'шт',
    grams: grams,
  };
}

// =====================================
// ПОШУК ПРОДУКТІВ (pg_trgm)
// =====================================

/**
 * Шукає продукт через pg_trgm
 * Спочатку в аліасах, потім в products
 *
 * @param {string} query - назва для пошуку
 * @param {number} minSimilarity - мін. схожість (0-1), default 0.3
 * @returns {Object|null} - знайдений продукт або null
 */
// Розбиває нормалізований запит на значущі слова (≥2 символів).
function termWords(term) {
  return term.split(' ').filter((w) => w.length >= 2);
}

// Чи схожий запит на штрихкод (8–14 цифр).
function isBarcode(query) {
  const digits = query.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 && /^\d+$/.test(query.trim());
}

// =====================================
// ПОШУК У RECIPES (для інгредієнтів зі станом)
// =====================================

// Нормалізує КБЖУ страви до значень на 100 г (recipes.kcal — на всю страву).
function recipeToPer100(recipe) {
  const w = Number(recipe.total_weight) || 0;
  const factor = w > 0 ? 100 / w : 1; // якщо ваги немає — припускаємо, що значення вже на 100 г
  return {
    ...recipe,
    kcal: Math.round((recipe.kcal || 0) * factor),
    protein: parseFloat(((recipe.protein || 0) * factor).toFixed(1)),
    fat: parseFloat(((recipe.fat || 0) * factor).toFixed(1)),
    carbs: parseFloat(((recipe.carbs || 0) * factor).toFixed(1)),
    fiber: parseFloat(((recipe.fiber || 0) * factor).toFixed(1)),
    food_state: 'cooked',
    _source: 'recipe',
  };
}

// Шукає готову страву в recipes за всіма словами запиту (AND).
async function searchRecipe(term) {
  // 1. Точний збіг
  const { data: exact } = await supabase
    .from('recipes')
    .select('*')
    .ilike('name_ua', term)
    .limit(1);
  if (exact?.length > 0) return { ...recipeToPer100(exact[0]), _matchedVia: 'recipe-exact' };

  // 2. Усі слова присутні (AND), у будь-якому порядку
  let q = supabase.from('recipes').select('*');
  for (const w of termWords(term)) {
    q = q.ilike('name_ua', `%${w}%`);
  }
  const { data: all } = await q.limit(10);
  if (all?.length > 0) {
    const best = all.reduce((a, b) =>
      (a.name_ua?.length ?? 999) <= (b.name_ua?.length ?? 999) ? a : b,
    );
    return { ...recipeToPer100(best), _matchedVia: 'recipe-and' };
  }

  return null;
}

// =====================================
// ПОШУК У PRODUCTS (для інгредієнтів без стану)
// =====================================

async function searchProduct(term) {
  const base = () =>
    supabase.from('products').select('*').is('deleted_at', null).is('user_id', null);

  // 1. Точний збіг по name_ua
  const { data: exact } = await base().ilike('name_ua', term).limit(1);
  if (exact?.length > 0) return { ...exact[0], _matchedVia: 'exact' };

  // 2. Точний збіг в аліасах — "яйце" → "яйце куряче"
  try {
    const { data: aliasRows } = await supabase
      .from('product_aliases')
      .select('product_id')
      .ilike('alias_normalized', term)
      .limit(1);

    if (aliasRows?.length > 0) {
      const { data: ap } = await base().eq('id', aliasRows[0].product_id).maybeSingle();
      if (ap) return { ...ap, _matchedVia: 'alias' };
    }
  } catch { /* alias search unavailable */ }

  // 3. Назва починається з терміну
  const { data: starts } = await base()
    .ilike('name_ua', `${term}%`)
    .order('name_ua', { ascending: true })
    .limit(1);
  if (starts?.length > 0) return { ...starts[0], _matchedVia: 'starts' };

  // 4. Усі слова присутні (AND) — беремо найкоротшу назву (базовий продукт)
  let q = base();
  for (const w of termWords(term)) {
    q = q.ilike('name_ua', `%${w}%`);
  }
  const { data: andMatch } = await q.limit(10);
  if (andMatch?.length > 0) {
    return {
      ...andMatch.reduce((a, b) =>
        (a.name_ua?.length ?? 999) <= (b.name_ua?.length ?? 999) ? a : b,
      ),
      _matchedVia: 'and',
    };
  }

  return null;
}

// Відкат: відсканований продукт за штрихкодом або за назвою.
async function searchScanned(query, term) {
  // За штрихкодом
  if (isBarcode(query)) {
    const { data } = await supabase
      .from('scanned_products')
      .select('*')
      .eq('barcode', query.replace(/\D/g, ''))
      .not('kcal', 'is', null)
      .maybeSingle();
    if (data) return { ...data, _source: 'barcode', _matchedVia: 'barcode' };
  }

  // За назвою (точний збіг)
  const { data: exact } = await supabase
    .from('scanned_products')
    .select('*')
    .ilike('name_ua', term)
    .not('kcal', 'is', null)
    .limit(1);
  if (exact?.length > 0) return { ...exact[0], _source: 'barcode', _matchedVia: 'scanned-exact' };

  return null;
}

/**
 * Знаходить інгредієнт для рецепта.
 * - Є слова стану (варений/смажений/…) → шукаємо ГОТОВУ страву в recipes.
 *   Не знайдено → null (інгредієнт лишиться нерозпізнаним / червоним).
 * - Немає стану → шукаємо БАЗОВИЙ продукт у products, далі у scanned_products
 *   (за назвою або штрихкодом).
 */
export async function findProductMatch(query) {
  if (!query || query.length < 2) return null;

  const term = normalizeText(query);

  try {
    // Зі станом → лише recipes, без відкату на products.
    if (hasCookingWords(term)) {
      return await searchRecipe(term);
    }

    // Штрихкод → одразу scanned_products.
    if (isBarcode(query)) {
      return await searchScanned(query, term);
    }

    // Без стану → products, потім scanned_products як відкат.
    const product = await searchProduct(term);
    if (product) return product;

    return await searchScanned(query, term);
  } catch (err) {
    console.error('Search error:', err);
    return null;
  }
}

/**
 * Знаходить всі можливі збіги (для автокомпліту)
 *
 * @param {string} query - назва для пошуку
 * @param {number} limit - макс. кількість результатів
 * @param {number} minSimilarity - мін. схожість (0-1)
 * @returns {Array} - масив продуктів
 */
export async function findAllMatches(query, limit = 10) {
  if (!query || query.length < 2) return [];

  const q = normalizeText(query);

  try {
    const [{ data: productsData }, { data: scannedData }] = await Promise.all([
      supabase
        .from('products')
        .select('id, name_ua, name_en, name_pl, kcal, protein, fat, carbs, fiber, food_state, category_id')
        .or(`name_ua.ilike.%${q}%,name_en.ilike.%${q}%`)
        .is('deleted_at', null)
        .is('user_id', null)
        .limit(limit),
      supabase
        .from('scanned_products')
        .select('barcode, name_ua, name_en, name_pl, kcal, protein, fat, carbs, fiber')
        .or(`name_ua.ilike.%${q}%,name_en.ilike.%${q}%`)
        .not('kcal', 'is', null)
        .limit(5),
    ]);

    // Сортуємо products: сирі/сухі першими, готові — знизу
    const stateOrder = { raw: 0, dry: 1, cooked: 2 };
    const sorted = (productsData || []).sort(
      (a, b) => (stateOrder[a.food_state] ?? 1) - (stateOrder[b.food_state] ?? 1),
    );

    // Scanned_products: маркуємо джерело
    const scanned = (scannedData || []).map((s) => ({
      ...s,
      _source: 'barcode',
      food_state: null,
    }));

    return [...sorted, ...scanned];
  } catch (err) {
    console.error('Search error:', err);
    return [];
  }
}

/**
 * Повертає products.id для scanned-продукту.
 * Шукає існуючий запис за іменем, якщо немає — створює глобальний продукт.
 */
export async function resolveScannedProduct(scanned) {
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('name_ua', scanned.name_ua || '')
    .is('user_id', null)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newProd, error } = await supabase
    .from('products')
    .insert({
      name_ua:    scanned.name_ua,
      name_en:    scanned.name_en,
      name_pl:    scanned.name_pl,
      kcal:       scanned.kcal,
      protein:    scanned.protein,
      fat:        scanned.fat,
      carbs:      scanned.carbs,
      fiber:      scanned.fiber,
      food_state: 'cooked',
      raw_edible: 'always',
      user_id:    null,
    })
    .select('id')
    .single();

  if (error) { console.error('resolveScannedProduct:', error); return null; }
  return newProd?.id ?? null;
}

/**
 * Парсить текст з інгредієнтами (кожен рядок — окремий інгредієнт)
 */
export function parseIngredientsText(text) {
  if (!text) return [];

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => parseFoodInput(line));
}

// =====================================
// ФОРМАТУВАННЯ
// =====================================

/**
 * Форматує кількість для відображення
 */
export function formatAmount(amount, unit) {
  if (!amount) return '';

  const num = parseFloat(amount);
  if (isNaN(num)) return '';

  if (unit === 'г' && num >= 1000) {
    return `${(num / 1000).toFixed(1)} кг`;
  }
  if (unit === 'мл' && num >= 1000) {
    return `${(num / 1000).toFixed(1)} л`;
  }

  const formatted = num % 1 === 0 ? num.toString() : num.toFixed(1);
  return `${formatted} ${unit || 'шт'}`;
}
