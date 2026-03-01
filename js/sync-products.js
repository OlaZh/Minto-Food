const supabase = require('./supabase'); // Підключаємо твій файл конфігурації

const USDA_API_KEY = '';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function startSync() {
  console.log('🚀 Синхронізація: Кал, Білки, Жири, Вуглеводи + GI (з API)...');

  // Беремо продукти, де ще немає калорій
  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, name_en')
    .is('kcal', null);

  if (fetchError) return console.error('❌ Помилка Supabase:', fetchError.message);

  for (const item of products) {
    try {
      // Очищуємо назву (видаляємо зайві знаки, що заважають пошуку)
      const cleanName = item.name_en.replace(/[/\\"'()]/g, ' ').trim();

      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(cleanName)}&pageSize=1`;

      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();

      if (data.foods && data.foods.length > 0) {
        const nutrients = data.foods[0].foodNutrients;

        // Функція для пошуку конкретного нутрієнта в масиві від USDA
        const getNutrient = (id, namePart) => {
          return (
            nutrients.find(
              (n) => n.nutrientId === id || (n.nutrientName && n.nutrientName.includes(namePart)),
            )?.value || 0
          );
        };

        const updatePayload = {
          kcal: getNutrient(1008, 'Energy'),
          protein: getNutrient(1003, 'Protein'),
          fat: getNutrient(1004, 'Total lipid'),
          carbs: getNutrient(1005, 'Carbohydrate'),
          // Тягнемо GI саме з бази API (якщо USDA його має для цього продукту)
          gi: getNutrient(null, 'Glycemic index'),
        };

        const { error: updateError } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', item.id);

        if (!updateError) {
          console.log(`✅ ${item.name_en}: Кал: ${updatePayload.kcal}, GI: ${updatePayload.gi}`);
        }
      } else {
        console.warn(`⚠️ USDA не знає назву: ${cleanName}`);
      }
    } catch (err) {
      console.error(`🛑 Помилка ID ${item.id}:`, err.message);
    }
    await delay(350); // Пауза для лімітів API
  }
  console.log('🏁 Готово!');
}

startSync();
