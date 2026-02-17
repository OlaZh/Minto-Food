import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.USDA_API_KEY;
const PRODUCTS_FILE = './data/products.json';
const OUTPUT_SQL = './sql/insert_products.sql';

async function fetchNutrition(query) {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(
    query,
  )}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.foods || data.foods.length === 0) return null;

  const food = data.foods[0];

  const nutrients = {};
  food.foodNutrients.forEach((n) => {
    if (n.nutrientName === 'Energy') nutrients.calories = n.value;
    if (n.nutrientName === 'Protein') nutrients.protein = n.value;
    if (n.nutrientName === 'Total lipid (fat)') nutrients.fat = n.value;
    if (n.nutrientName === 'Carbohydrate, by difference') nutrients.carbs = n.value;
  });

  return nutrients;
}

async function main() {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  let sql = '';

  for (const p of products) {
    console.log('Fetching:', p.search_key_en);

    const n = await fetchNutrition(p.search_key_en);

    if (!n) {
      console.log('No data for:', p.search_key_en);
      continue;
    }

    sql += `INSERT INTO products (id, name_ua, name_pl, name_en, category, tags, gi, calories, protein, fat, carbs)
VALUES ('${p.id}', '${p.name_ua}', '${p.name_pl}', '${p.name_en}', '${p.category}', '${JSON.stringify(
      p.tags,
    )}', ${p.gi === null ? 'NULL' : p.gi}, ${n.calories}, ${n.protein}, ${n.fat}, ${n.carbs});\n\n`;
  }

  fs.writeFileSync(OUTPUT_SQL, sql);
  console.log('SQL saved to', OUTPUT_SQL);
}

main();
