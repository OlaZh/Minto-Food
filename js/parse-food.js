// js/parse-food.js

const UNIT_CONVERSIONS = {
  г: 1,
  гр: 1,
  g: 1,
  kg: 1000,
  мл: 1,
  l: 1000,
  cup: 250,
  tbsp: 15,
  tsp: 5,
  pinch: 2,
};

const PRODUCT_WEIGHTS = {
  яйце: 50,
  банан: 120,
  картопля: 100,
};

export function parseFoodInput(input) {
  if (!input) return null;

  const clean = input.toLowerCase().replace(/\s+/g, ' ').trim();

  // 1️⃣ "курка 100 г"
  let match = clean.match(/^(.+?)\s+(\d+)\s*(г|гр|g|kg|ml|l)$/);
  if (match) {
    return {
      name: match[1].trim(),
      grams: Number(match[2]) * (UNIT_CONVERSIONS[match[3]] || 1),
    };
  }

  // 2️⃣ "2 яйця"
  match = clean.match(/^(\d+)\s+(.+)$/);
  if (match) {
    const amount = Number(match[1]);
    const product = match[2].trim();

    const weight = PRODUCT_WEIGHTS[product];

    if (weight) {
      return {
        name: product,
        grams: amount * weight,
      };
    }
  }

  // 3️⃣ fallback
  return {
    name: clean,
    grams: null,
  };
}
