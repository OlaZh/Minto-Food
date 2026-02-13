// Імітація бази даних (Mock Database)
// js/food-api.js

const mockDatabase = [
  { id: 1, name: 'Makaron pełnoziarnisty', kcal: 350, protein: 12, fat: 2, carbs: 70 },
  { id: 2, name: 'Kurczak pieczony', kcal: 165, protein: 31, fat: 4, carbs: 0 },
  { id: 3, name: 'Owsianka z bananem', kcal: 350, protein: 10, fat: 5, carbs: 65 },
  { id: 4, name: 'Sałatka grecka', kcal: 150, protein: 4, fat: 12, carbs: 8 },
  { id: 5, name: 'Яблуко', kcal: 52, protein: 0.3, fat: 0.2, carbs: 14 },
];

export async function searchFood(query) {
  const q = query.toLowerCase().trim();

  console.log('🔎 SEARCH QUERY:', q);
  console.log('📦 DATABASE:', mockDatabase);

  return mockDatabase.filter(item =>
    item.name.toLowerCase().includes(q)
  );
}


/**
 * Функція для пошуку за штрих-кодом
 */
export async function getFoodByBarcode(barcode) {
  console.log(`Скануємо штрих-код: ${barcode}`);
  // Поки що повертаємо "продукт не знайдено" або тестовий об'єкт
  return null;
}
