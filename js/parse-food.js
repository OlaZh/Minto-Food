// js/parse-food.js
// Парсер продуктів з pg_trgm пошуком через Supabase

import { supabase } from './supabaseClient.js';

// =====================================
// КОНСТАНТИ
// =====================================

// ─────────────────────────────────────────────────────────────
// DIRECT — вагові/об'ємні одиниці з ФІКСОВАНИМ перерахунком у грами.
// Вага продукту тут не залежить від продукту (г, кг, мл, л).
// ─────────────────────────────────────────────────────────────
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
};

// ─────────────────────────────────────────────────────────────
// LOOKUP — штучні/об'ємні одиниці, вага яких ЗАЛЕЖИТЬ ВІД ПРОДУКТУ
// (склянка борошна ≠ склянка молока). Грами беруться з product_units
// по конкретному продукту. У парсері grams завжди null.
// UNIT_TO_TYPE зводить синоніми до канонічного unit_type (як у БД).
// ─────────────────────────────────────────────────────────────
const UNIT_TO_TYPE = {
  // Штуки
  шт: 'шт', 'шт.': 'шт', штука: 'шт', штуки: 'шт', штук: 'шт',
  pcs: 'шт', piece: 'шт', pieces: 'шт',
  // Чайна ложка
  'ч.л.': 'ч.л.', 'ч.л': 'ч.л.', чл: 'ч.л.', tsp: 'ч.л.', teaspoon: 'ч.л.',
  // Десертна ложка
  'дес.л.': 'дес.л.', 'дес.л': 'дес.л.', десл: 'дес.л.',
  // Столова ложка
  'ст.л.': 'ст.л.', 'ст.л': 'ст.л.', стл: 'ст.л.', tbsp: 'ст.л.', tablespoon: 'ст.л.',
  ложка: 'ст.л.', ложки: 'ст.л.', ложок: 'ст.л.',
  // Склянка (250 мл) і стакан (200 мл) — РОЗДІЛЬНІ unit_type
  склянка: 'склянка', склянки: 'склянка', склянок: 'склянка', cup: 'склянка', cups: 'склянка',
  стакан: 'стакан', стакана: 'стакан', стакани: 'стакан',
  // Щіпки / дрібки
  щіпка: 'щіпка', щіпки: 'щіпка', щіпок: 'щіпка', pinch: 'щіпка',
  дрібка: 'дрібка', дрібки: 'дрібка', дрібок: 'дрібка',
  // Жмені
  жменя: 'жменя', жмені: 'жменя', жмень: 'жменя', жменька: 'жменя', жменьки: 'жменя', handful: 'жменя',
  // Пачки / упаковки
  пачка: 'пачка', пачки: 'пачка', пачок: 'пачка', упаковка: 'пачка', упаковки: 'пачка',
};

const LOOKUP_UNITS = new Set(Object.keys(UNIT_TO_TYPE));

// "Штучні" одиниці (для патернів "2 яйця" → unit='шт'). Підмножина LOOKUP.
const PIECE_UNITS = new Set(['шт', 'шт.', 'штука', 'штуки', 'штук', 'pcs', 'piece', 'pieces']);

// Регекс для ВСІХ одиниць — DIRECT + LOOKUP (довші першими, щоб "ст.л." не
// зматчилось як "ст"). Критично об'єднувати обидва набори, інакше склянки/ложки
// не ловитимуться регексом узагалі.
const UNIT_RE_SRC = [...Object.keys(UNIT_CONVERSIONS), ...LOOKUP_UNITS]
  .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .sort((a, b) => b.length - a.length)
  .join('|');

// Чи одиниця DIRECT (вага не залежить від продукту: г/кг/мл/л).
// Експортується, бо recipe-ingredients.js вирішує, чи перераховувати вагу при заміні продукту.
export function isDirectUnit(unit) {
  return unit != null && UNIT_CONVERSIONS[unit.toLowerCase()] !== undefined;
}

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
    .replace(/десертн[иіая]+\s+ложк[иаою]*/gi, 'дес.л.')
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
    // DIRECT (є в UNIT_CONVERSIONS) → фіксовані грами. LOOKUP → null (вага з product_units).
    const conv = UNIT_CONVERSIONS[unit];
    grams = conv !== undefined ? amount * conv : null;
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
      grams = conv !== undefined ? amount * conv : null;
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
  // Лише для LOOKUP-одиниць окрім штук ("сіль шт" безглуздо). Вага з product_units → grams=null.
  const implicitOneOk = (u) => LOOKUP_UNITS.has(u) && !PIECE_UNITS.has(u);
  if (!match) {
    // "сіль дрібка" — назва, потім одиниця в кінці
    match = text.match(new RegExp(`^(.+?)\\s+(${UNIT_RE_SRC})\\.?$`, 'i'));
    if (match && implicitOneOk(match[2].toLowerCase())) {
      name = match[1].trim();
      unit = match[2].toLowerCase();
      amount = 1;
      grams = null;
    } else {
      match = null;
    }
  }
  if (!match) {
    // "дрібка солі" — одиниця на початку, потім назва
    match = text.match(new RegExp(`^(${UNIT_RE_SRC})\\.?\\s+(.+)$`, 'i'));
    if (match && implicitOneOk(match[1].toLowerCase())) {
      unit = match[1].toLowerCase();
      name = match[2].trim();
      amount = 1;
      grams = null;
    } else {
      match = null;
    }
  }

  const searchName = removeStopWords(name);
  const finalUnit = unit || 'шт';

  return {
    raw: input,
    original: input,            // alias — recipe-ingredients.js читає item.original
    name: name,
    searchName: searchName,
    amount: amount || 1,
    unit: finalUnit,            // СИРА одиниця для показу "як написала" ("л", "дрібка")
    unitType: UNIT_TO_TYPE[finalUnit] ?? finalUnit, // канон для lookup у product_units
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
