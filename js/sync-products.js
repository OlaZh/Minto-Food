const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// 1. КОНСТАНТИ - ПЕРЕВІР, ЩО ТУТ ТВОЇ ДАНІ
const SUPABASE_URL = '';
const SUPABASE_KEY = '';
const UNSPLASH_ACCESS_KEY = '';

// 2. СТВОРЕННЯ КЛІЄНТА (Важливо: const має бути тут!)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncWithUnsplash() {
  try {
    console.log('🧹 Очищення бази від ШІ-мутантів...');

    // Очищаємо посилання на ШІ-фото, щоб Unsplash міг їх замінити
    const { error: clearError } = await supabase
      .from('products')
      .update({ image: null, photographer_name: null })
      .eq('photographer_name', 'AI: Professional Shot');

    if (clearError) console.error('⚠️ Помилка очищення:', clearError.message);

    console.log('🚀 Пошук реальних фото на Unsplash...');

    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name_en, name_ua')
      .or('image.is.null, image.eq.""')
      .order('id', { ascending: true })
      .limit(30);

    if (fetchError) throw fetchError;
    if (!products || products.length === 0) return console.log('✅ Всі фото вже заповнені!');

    for (const product of products) {
      console.log(`🔍 Шукаю: ${product.name_ua}...`);

      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query: `${product.name_en} white background`,
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

        console.log(`✅ Знайдено фото від: ${photo.user.name}`);
      } else {
        console.log(`⚠️ Для "${product.name_en}" нічого не знайдено.`);
      }

      // Пауза 1.5 сек, щоб не "вилетіти" за ліміти
      await new Promise((res) => setTimeout(res, 1500));
    }
  } catch (err) {
    if (err.response && err.response.status === 403) {
      console.log('🛑 Ліміт Unsplash (50/год) вичерпано!');
    } else {
      console.error('❌ Помилка:', err.message);
    }
  }
  console.log('🏁 Завершено.');
}

syncWithUnsplash();
