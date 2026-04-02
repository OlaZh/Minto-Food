// js/parse-food.js
// Професійний парсер продуктів з нечітким пошуком

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
  'дрібний',
  'дрібна',
  'дрібні',
  'дрібних',
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
  'очищений',
  'очищена',
  'очищені',
  'подрібнений',
  'подрібнена',
  'подрібнені',
  'тертий',
  'терта',
  'терті',
  'варений',
  'варена',
  'варені',
  'смажений',
  'смажена',
  'смажені',
  'печений',
  'печена',
  'печені',
  'сирий',
  'сира',
  'сирі',
  'червоний',
  'червона',
  'червоні',
  'зелений',
  'зелена',
  'зелені',
  'білий',
  'біла',
  'білі',
  'чорний',
  'чорна',
  'чорні',
  'солодкий',
  'солодка',
  'солодкі',
  'кислий',
  'кисла',
  'кислі',
  'гострий',
  'гостра',
  'гострі',
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
  'орієнтовно',
  'кімнатної',
  'температури',
  'холодний',
  'холодна',
  'холодні',
  'гарячий',
  'гаряча',
  'гарячі',
  'теплий',
  'тепла',
  'теплі',
]);

// Українські закінчення для стемінгу
const UA_SUFFIXES = [
  'ами',
  'ями',
  'ому',
  'ому',
  'ові',
  'еві',
  'єві',
  'ою',
  'ею',
  'єю',
  'ий',
  'ій',
  'ої',
  'ої',
  'ах',
  'ях',
  'их',
  'іх',
  'ам',
  'ям',
  'ом',
  'ем',
  'єм',
  'им',
  'ім',
  'ів',
  'їв',
  'ей',
  'ій',
  'ка',
  'ки',
  'ку',
  'кою',
  'ці',
  'ок',
  'ти',
  'ть',
  'ся',
  'а',
  'я',
  'у',
  'ю',
  'е',
  'є',
  'і',
  'ї',
  'и',
  'о',
];

// =====================================
// СТЕМІНГ (обрізання закінчень)
// =====================================

/**
 * Простий стемер для української мови
 */
function stem(word) {
  if (!word || word.length < 3) return word;

  let result = word.toLowerCase().trim();

  // Пробуємо відрізати закінчення (від довших до коротших)
  for (const suffix of UA_SUFFIXES) {
    if (result.length > suffix.length + 2 && result.endsWith(suffix)) {
      return result.slice(0, -suffix.length);
    }
  }

  return result;
}

/**
 * Нормалізує текст для пошуку
 */
function normalizeText(text) {
  if (!text) return '';

  return text
    .toLowerCase()
    .replace(/[^\wа-яіїєґ\s]/gi, ' ') // Залишаємо тільки букви
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Витягує ключові слова з тексту (без стоп-слів)
 */
function extractKeywords(text) {
  const normalized = normalizeText(text);
  const words = normalized.split(' ');

  return words.filter((w) => w.length > 1 && !STOP_WORDS.has(w)).map((w) => stem(w));
}

// =====================================
// FUZZY SEARCH (нечіткий пошук)
// =====================================

/**
 * Відстань Левенштейна між двома рядками
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const matrix = [];

  for (let i = 0; i <= m; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[m][n];
}

/**
 * Схожість між двома рядками (0-1)
 */
function similarity(str1, str2) {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLen;
}

/**
 * Перевіряє чи один рядок містить інший (з урахуванням стемінгу)
 */
function stemmedIncludes(text, query) {
  const textStem = stem(normalizeText(text));
  const queryStem = stem(normalizeText(query));

  return textStem.includes(queryStem) || queryStem.includes(textStem);
}

// =====================================
// ПАРСИНГ ІНГРЕДІЄНТІВ
// =====================================

/**
 * Парсить рядок інгредієнта
 * "2 великі картоплі" → { name: "картопля", amount: 2, unit: "шт", grams: null }
 * "курка 200 г" → { name: "курка", amount: 200, unit: "г", grams: 200 }
 */
export function parseFoodInput(input) {
  if (!input) return null;

  let text = input.toLowerCase().trim();

  // Прибираємо зайві символи
  text = text
    .replace(/[—–-]+/g, ' ') // тире → пробіл
    .replace(/[,;:]+/g, ' ') // розділові знаки
    .replace(/\s+/g, ' ')
    .trim();

  let amount = null;
  let unit = null;
  let grams = null;
  let name = text;

  // Патерн 1: "200 г курки" або "200г курки"
  let match = text.match(
    /^(\d+(?:[.,]\d+)?)\s*(г|гр|грам|кг|мл|л|шт|ст\.?л\.?|ч\.?л\.?|склянк[иа]?)\s+(.+)$/i,
  );
  if (match) {
    amount = parseFloat(match[1].replace(',', '.'));
    unit = match[2].toLowerCase();
    name = match[3].trim();
    grams = amount * (UNIT_CONVERSIONS[unit] || 1);
    if (unit === 'шт' || unit === 'шт.') grams = null; // Штуки не конвертуємо
  }

  // Патерн 2: "курка 200 г" або "курка 200г"
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

  // Патерн 3: "2 яйця" або "3 картоплі" (кількість на початку)
  if (!match) {
    match = text.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
    if (match) {
      amount = parseFloat(match[1].replace(',', '.'));
      name = match[2].trim();
      unit = 'шт';
    }
  }

  // Патерн 4: "яйця 2" (кількість в кінці)
  if (!match) {
    match = text.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)$/);
    if (match) {
      name = match[1].trim();
      amount = parseFloat(match[2].replace(',', '.'));
      unit = 'шт';
    }
  }

  // Прибираємо стоп-слова з назви для пошуку
  const keywords = extractKeywords(name);
  const searchName = keywords.join(' ') || name;

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
// ПОШУК ПРОДУКТІВ
// =====================================

/**
 * Рахує score співпадіння продукту з запитом
 * ВАЖЛИВО: Точний збіг має абсолютний пріоритет!
 * Шукаємо тільки ЦІЛІ СЛОВА, не частини слів
 */
function calculateMatchScore(product, query, queryStem, queryKeywords) {
  let score = 0;

  const names = [product.name_ua, product.name_en, product.name_pl]
    .filter(Boolean)
    .map((n) => n.toLowerCase().trim());

  // Розбиваємо назви на окремі слова
  const nameWords = names.map((n) => n.split(/\s+/));

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const words = nameWords[i];

    // 1. ТОЧНИЙ ЗБІГ повної назви — абсолютний пріоритет (1000 балів)
    // "сир" === "сир"
    if (name === query) {
      return 1000;
    }

    // 2. ПЕРШЕ СЛОВО === запит (900 балів)
    // "сир твердий" — перше слово "сир" === запит "сир"
    if (words[0] === query) {
      score = Math.max(score, 900);
      continue;
    }

    // 3. ЗАПИТ === одне з слів назви (але не перше)
    // "молоко згущене" містить слово "згущене" === запит "згущене"
    if (words.slice(1).includes(query)) {
      score = Math.max(score, 400);
      continue;
    }

    // 4. Стемінг першого слова
    const firstWordStem = stem(words[0]);
    if (firstWordStem === queryStem && words[0].length <= query.length + 4) {
      score = Math.max(score, 850);
      continue;
    }

    // 5. Запит містить назву продукту як перші слова
    // Запит: "сир твердий голландський" — назва: "сир твердий"
    if (query.startsWith(name + ' ') || query.startsWith(name)) {
      score = Math.max(score, 600);
      continue;
    }

    // 6. Назва починається із запиту + пробіл (запит = перше слово)
    // Назва: "сир твердий", запит: "сир"
    if (name.startsWith(query + ' ')) {
      score = Math.max(score, 500);
      continue;
    }

    // 7. Fuzzy match тільки для ПЕРШОГО слова і тільки якщо дуже схоже
    const sim = similarity(words[0], query);
    if (sim > 0.9) {
      score = Math.max(score, sim * 300);
    }
  }

  // НЕ шукаємо часткові входження типу "сир" в "сирники"!
  // Це різні продукти

  return score;
}

/**
 * Знаходить найкращий збіг продукту в базі
 * @param {string} query - назва для пошуку
 * @param {Array} products - масив продуктів з бази
 * @param {number} minScore - мінімальний score для збігу (0-1000)
 * @returns {Object|null} - знайдений продукт або null
 */
export function findProductMatch(query, products, minScore = 100) {
  if (!query || !products || !products.length) return null;

  const q = normalizeText(query);
  if (q.length < 2) return null;

  const qStem = stem(q);
  const qKeywords = extractKeywords(query);

  let bestMatch = null;
  let bestScore = 0;

  for (const product of products) {
    const score = calculateMatchScore(product, q, qStem, qKeywords);

    if (score > bestScore && score >= minScore) {
      bestScore = score;
      bestMatch = product;
    }
  }

  if (bestMatch) {
    return {
      ...bestMatch,
      _matchScore: bestScore,
    };
  }

  return null;
}

/**
 * Знаходить всі можливі збіги (для автокомпліту)
 */
export function findAllMatches(query, products, limit = 10, minScore = 30) {
  if (!query || !products || !products.length) return [];

  const q = normalizeText(query);
  if (q.length < 2) return [];

  const qStem = stem(q);
  const qKeywords = extractKeywords(query);

  const matches = [];

  for (const product of products) {
    const score = calculateMatchScore(product, q, qStem, qKeywords);

    if (score >= minScore) {
      matches.push({
        ...product,
        _matchScore: score,
      });
    }
  }

  // Сортуємо за score (найкращі зверху)
  matches.sort((a, b) => b._matchScore - a._matchScore);

  return matches.slice(0, limit);
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
// УТИЛІТИ
// =====================================

/**
 * Форматує кількість для відображення
 */
export function formatAmount(amount, unit) {
  if (!amount) return '';

  const num = parseFloat(amount);
  if (isNaN(num)) return '';

  // Конвертуємо великі числа
  if (unit === 'г' && num >= 1000) {
    return `${(num / 1000).toFixed(1)} кг`;
  }
  if (unit === 'мл' && num >= 1000) {
    return `${(num / 1000).toFixed(1)} л`;
  }

  // Прибираємо .0 для цілих чисел
  const formatted = num % 1 === 0 ? num.toString() : num.toFixed(1);

  return `${formatted} ${unit || 'шт'}`;
}

/**
 * Експорт для тестування
 */
export const _internal = {
  stem,
  normalizeText,
  extractKeywords,
  levenshteinDistance,
  similarity,
  calculateMatchScore,
};
