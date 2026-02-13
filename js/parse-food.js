// js/parse-food.js
export function parseFoodInput(input) {
  if (!input) return null;

  const clean = input.toLowerCase().replace(/\s+/g, ' ').trim();

  // підтримує: "50 г", "50гр", "50 g"
  const match = clean.match(/^(.+?)\s+(\d+)\s*(г|гр|g)$/);

  if (!match) return null;

  return {
    name: match[1].trim(),
    grams: Number(match[2]),
  };
}
