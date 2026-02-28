const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Використовуємо ті ж самі ключі, що й раніше
supabase = createClient(
  'https://xpaibteyntflrixmigfx.supabase.co',
  'sb_publishable_5aziCmaq0rxAJ24MznPycw_eY5iVZxZ',
);
const UNSPLASH_ACCESS_KEY = '91ClbP6TkC8dGAYEs4oioxI6peXOt-nJpJ2TE20--1U'; // Той самий, що ми вже мали

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncWithUnsplash() {
  console.log('🚀 Починаємо завантаження РЕАЛЬНИХ фото з Unsplash...');

  // Беремо перші 40 товарів без фото (щоб вписатися в ліміт 50/год)
  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, name_en, name_ua')
    .or('image.is.null, image.eq.""')
    .order('id', { ascending: true })
    .limit(40);

  if (fetchError) return console.error('❌ Помилка БД:', fetchError.message);
  if (!products?.length) return console.log('✅ Всі продукти вже з фото!');

  for (const product of products) {
    console.log(`🔍 Шукаю: ${product.name_ua}...`);

    try {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query: `${product.name_en} isolated on white background`,
          per_page: 1,
          orientation: 'squarish',
        },
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
      });

      const photo = response.data.results[0];

      if (photo) {
        await supabase
          .from('products')
          .update({
            image: photo.urls.regular,
            photographer_name: `Unsplash: ${photo.user.name}`,
          })
          .eq('id', product.id);

        console.log(`✅ Знайдено! (Автор: ${photo.user.name})`);
      } else {
        console.log(`⚠️ Не знайдено для "${product.name_en}". Треба шукати руками.`);
      }

      // Пауза 1.2 сек, щоб не перевищити ліміт запитів у секунду
      await new Promise((res) => setTimeout(res, 1200));
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('🛑 Ліміт Unsplash вичерпано. Відпочиваємо годину!');
        break;
      }
      console.error(`❌ Помилка: ${err.message}`);
    }
  }
  console.log('🏁 Готово! Тепер у тебе справжні фрукти замість ШІ-сміття.');
}

syncWithUnsplash();
