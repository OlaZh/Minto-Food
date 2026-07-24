// Випадковий рецепт як CTA на 404-сторінці — тихо мовчимо при будь-якій помилці
import { supabase } from '/js/supabaseClient.js';

try {
  const { data } = await supabase
    .from('recipes')
    .select('name_ua, slug, image, kcal')
    .eq('status', 'published')
    .eq('is_public', true)
    .is('deleted_at', null)
    .not('slug', 'is', null)
    .limit(30);
  if (data?.length) {
    const r = data[Math.floor(Math.random() * data.length)];
    document.getElementById('nfRecipeLink').href = `/recipe/${r.slug}`;
    document.getElementById('nfRecipeName').textContent = r.name_ua || '';
    if (r.kcal) document.getElementById('nfRecipeKcal').textContent = `${r.kcal} ккал`;
    const img = document.getElementById('nfRecipeImg');
    if (r.image) { img.src = r.image; img.hidden = false; }
    document.getElementById('nfRandom').hidden = false;
  }
} catch (_) {}
