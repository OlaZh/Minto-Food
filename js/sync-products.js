const supabase = require('./supabase');

const USDA_API_KEY = ''; // Не забудь вставити ключ

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function startSync() {
  console.log('🧹 Починаємо заповнення чистої бази з розумною перевіркою...');

  // Беремо всі продукти, де kcal порожній
  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, name_en, name_ua')
    .is('kcal', null);

  if (fetchError) return console.error('❌ Помилка Supabase:', fetchError.message);
  console.log(`📦 Знайдено ${products.length} порожніх позицій.`);

  for (const item of products) {
    try {
      const cleanName = item.name_en.replace(/[/\\"'()]/g, ' ').trim();
      const nameLower = item.name_ua.toLowerCase();

      // Шукаємо в USDA (pageSize=5, щоб мати вибір, але беремо перший адекватний)
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(cleanName)}&pageSize=5&dataType=Foundation Foods,SR Legacy`;

      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();

      if (data.foods && data.foods.length > 0) {
        const food = data.foods[0];
        const nutrients = food.foodNutrients;

        const getNutrient = (id) => nutrients.find((n) => n.nutrientId === id)?.value || 0;

        let p = getNutrient(1003); // Білок
        let f = getNutrient(1004); // Жир
        let c = getNutrient(1005); // Вуглеводи

        // --- ПЕРЕВІРКА НА "ОЛІЮ" ---
        // Якщо в назві продукту немає слова "олія", а жиру > 90г - це помилка пошуку
        const isOilSource =
          nameLower.includes('олія') ||
          nameLower.includes('смалець') ||
          nameLower.includes('жир') ||
          nameLower.includes('масло вершкове');
        if (f > 90 && !isOilSource) {
          console.warn(`⏭️ Пропущено "${item.name_ua}": USDA підсунула олію.`);
          continue;
        }

        // --- МАТЕМАТИЧНИЙ РОЗРАХУНОК ---
        const k = Math.round(p * 4 + f * 9 + c * 4);

        // --- ГЛІКЕМІЧНИЙ ІНДЕКС (Базова логіка) ---
        let giValue = 0;
        // Якщо вуглеводів майже немає (м'ясо/риба), ГІ завжди 0
        // Якщо це мед/цукор - ми знаємо, що там багато, але USDA не скаже цифру.
        // Залишаємо 0 для безпеки, або NULL, щоб потім заповнити вручну.

        const updatePayload = {
          kcal: k,
          protein: p,
          fat: f,
          carbs: c,
          gi: c < 1 ? 0 : null, // Якщо немає вуглеводів - ГІ 0, якщо є - лишаємо для ручної перевірки
        };

        // --- КАТЕГОРИЗАЦІЯ ---
        if (nameLower.includes('горіх') || nameLower.includes('насіння'))
          updatePayload.category = 'Горіхи та насіння';
        if (nameLower.includes('олія') || nameLower.includes('масло'))
          updatePayload.category = 'Жири та олії';
        if (nameLower.includes('хліб') || nameLower.includes('пластівці'))
          updatePayload.category = 'Зернові та випічка';

        const { error: updateError } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', item.id);

        if (!updateError) {
          console.log(`✅ [ID ${item.id}] ${item.name_ua}: ${k} ккал (Б:${p} Ж:${f} В:${c})`);
        }
      } else {
        console.warn(`⚠️ Не знайдено: ${cleanName}`);
      }
    } catch (err) {
      console.error(`🛑 Помилка ID ${item.id}:`, err.message);
    }
    await delay(450); // Трохи повільніше, щоб USDA не банила
  }
  console.log('🏁 Глобальне оновлення завершено!');
}

startSync();
