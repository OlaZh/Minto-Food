// js/parse-food.js
// Парсер продуктів з pg_trgm пошуком через Supabase

import { supabase } from './supabaseClient.js';

// =====================================
// КОНСТАНТИ
// =====================================

const UNIT_CONVERSIONS = {
  // Вага
  г: 1,
  гр: 1,
  грам: 1,
  грамів: 1,
  g: 1,
  gram: 1,
  grams: 1,
  кг: 1000,
  kg: 1000,
  oz: 28.35,
  ounce: 28.35,
  lb: 453.6,
  pound: 453.6,
  // Об'єм
  мл: 1,
  ml: 1,
  л: 1000,
  літр: 1000,
  літра: 1000,
  l: 1000,
  liter: 1000,
  'ч.л.': 5,
  'ч.л': 5,
  чл: 5,
  tsp: 5,
  teaspoon: 5,
  'ст.л.': 15,
  'ст.л': 15,
  стл: 15,
  tbsp: 15,
  tablespoon: 15,
  склянка: 250,
  склянки: 250,
  cup: 250,
  cups: 250,
  // Інше
  щіпка: 2,
  щіпки: 2,
  pinch: 2,
  шт: 1,
  'шт.': 1,
  штука: 1,
  штуки: 1,
  штук: 1,
  pcs: 1,
  piece: 1,
  pieces: 1,
};

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
  'сушений',
  'сушена',
  'сушені',
  'сушених',
  'заморожений',
  'заморожена',
  'заморожені',
  'нарізаний',
  'нарізана',
  'нарізані',
  'варений',
  'варена',
  'варені',
  'смажений',
  'смажена',
  'смажені',
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

  text = text
    .replace(/[—–-]+/g, ' ')
    .replace(/[,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let amount = null;
  let unit = null;
  let grams = null;
  let name = text;

  // Патерн 1: "200 г курки"
  let match = text.match(
    /^(\d+(?:[.,]\d+)?)\s*(г|гр|грам|кг|мл|л|шт|ст\.?л\.?|ч\.?л\.?|склянк[иа]?)\s+(.+)$/i,
  );
  if (match) {
    amount = parseFloat(match[1].replace(',', '.'));
    unit = match[2].toLowerCase();
    name = match[3].trim();
    grams = amount * (UNIT_CONVERSIONS[unit] || 1);
    if (unit === 'шт' || unit === 'шт.') grams = null;
  }

  // Патерн 2: "курка 200 г"
  if (!match) {
    match = text.match(
      /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(г|гр|грам|кг|мл|л|шт|ст\.?л\.?|ч\.?л\.?|склянк[иа]?)\.?$/i,
    );
    if (match) {
      name = match[1].trim();
      amount = parseFloat(match[2].replace(',', '.'));
      unit = match[3].toLowerCase();
      grams = amount * (UNIT_CONVERSIONS[unit] || 1);
      if (unit === 'шт' || unit === 'шт.') grams = null;
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
export async function findProductMatch(query, minSimilarity = 0.3) {
  if (!query || query.length < 2) return null;

  const q = normalizeText(query);

  try {
    // 1. Шукаємо в аліасах (точний збіг або pg_trgm)
    const { data: aliasMatch, error: aliasError } = await supabase.rpc('search_product_by_alias', {
      search_query: q,
      min_similarity: minSimilarity,
    });

    if (!aliasError && aliasMatch && aliasMatch.length > 0) {
      return {
        ...aliasMatch[0],
        _matchScore: aliasMatch[0].similarity_score,
        _matchedVia: 'alias',
      };
    }

    // 2. Шукаємо напряму в products
    const { data: productMatch, error: productError } = await supabase.rpc(
      'search_product_by_name',
      {
        search_query: q,
        min_similarity: minSimilarity,
      },
    );

    if (!productError && productMatch && productMatch.length > 0) {
      return {
        ...productMatch[0],
        _matchScore: productMatch[0].similarity_score,
        _matchedVia: 'product',
      };
    }

    return null;
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
export async function findAllMatches(query, limit = 10, minSimilarity = 0.2) {
  if (!query || query.length < 2) return [];

  const q = normalizeText(query);

  try {
    const { data, error } = await supabase.rpc('search_products_fuzzy', {
      search_query: q,
      result_limit: limit,
      min_similarity: minSimilarity,
    });

    if (error) {
      console.error('Search error:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Search error:', err);
    return [];
  }
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
