const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
,
);

// USDA_KEY потрібен тільки для КБЖВ
const USDA_KEY = '';

async function checkUrl(url) {
  try {
    const res = await axios.head(url);
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

async function enrichProductData() {
  console.log('🚀 Запуск: ТІЛЬКИ кулінарні API (TheMealDB + OFF)...');

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .or('image.is.null,kcal.is.null');

  if (error) {
    console.error('❌ Помилка:', error.message);
    return;
  }

  for (const product of products) {
    try {
      console.log(`\n🍎 Обробка: ${product.name_ua}`);
      let nutrients = {};
      let imageUrl = null;

      // 1. КБЖВ (USDA) - якщо калорії порожні
      if (product.kcal === null) {
        const usdaRes = await axios.get(`https://api.nal.usda.gov/fdc/v1/foods/search`, {
          params: { api_key: USDA_KEY, query: product.name_en, pageSize: 1 },
        });
        const food = usdaRes.data.foods?.[0];
        if (food) {
          const findN = (id) => food.foodNutrients.find((n) => n.nutrientId === id)?.value || 0;
          nutrients = {
            kcal: findN(1008),
            protein: findN(1003),
            fat: findN(1004),
            carbs: findN(1005),
          };
        }
      }

      // 2. ФОТО - ТІЛЬКИ КУЛІНАРНІ БАЗИ
      let searchName = product.name_en.toLowerCase();

      // Автокорекція назв для точності
      if (searchName.includes('munster')) searchName = 'munster cheese';
      if (searchName.includes('argentina')) searchName = 'argentina fish';
      if (searchName.includes('pepper')) searchName = 'dr pepper';

      const cleanName = searchName.replace(/\(.*\)/g, '').trim();

      // --- СПРОБА А: TheMealDB (Чисті інгредієнти) ---
      const formattedName = cleanName
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('%20');
      const mealUrl = `https://www.themealdb.com/images/ingredients/${formattedName}.png`;

      if (await checkUrl(mealUrl)) {
        imageUrl = mealUrl;
        console.log(`   🌟 TheMealDB: Знайдено`);
      }

      // --- СПРОБА Б: Open Food Facts (Реальні товари) ---
      if (!imageUrl) {
        const offRes = await axios.get(`https://world.openfoodfacts.org/cgi/search.pl`, {
          params: { search_terms: cleanName, json: 1, page_size: 1 },
        });
        if (offRes.data.products?.[0]?.image_url) {
          imageUrl = offRes.data.products[0].image_url;
          console.log(`   📦 OFF: Знайдено реальний товар`);
        }
      }

      // 3. ЗАПИС У БАЗУ
      await supabase
        .from('products')
        .update({ ...nutrients, image: imageUrl })
        .eq('id', product.id);
      console.log(`✅ Готово: ${product.name_ua}`);

      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error(`❌ Помилка ${product.name_ua}:`, e.message);
    }
  }
  console.log('\n🏁 Синхронізацію завершено БЕЗ "фігні"!');
}

enrichProductData();
