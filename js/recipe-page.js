// ============================================================
// recipe-page.js — публічна сторінка рецепту (/recipe/:slug)
// Без авторизації, з SEO Schema.org, OG-тегами
// ============================================================

import { supabase }                        from './supabaseClient.js';
import { initAuth, isLoggedIn, openAuthModal } from './auth.js';
import { iconShare, iconPlate, iconLeaf, iconBookOpen, iconStar } from './icons.js';
import { safeImageUrl } from './utils.js';

const CATEGORY_LABELS = {
  breakfast: 'Сніданок', lunch: 'Обід',    dinner: 'Вечеря',
  snack:     'Перекус',  dessert: 'Десерт', drinks: 'Напої',
  bakery:    'Випічка',  fast: 'Швидкий',   no_power: 'Без світла',
};

const CATEGORY_LABELS_EN = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner',
  snack:     'Snack',     dessert: 'Dessert', drinks: 'Drinks',
  bakery:    'Bakery',    fast:    'Quick',   no_power: 'No-power',
};

const CATEGORY_LABELS_PL = {
  breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja',
  snack:     'Przekąska', dessert: 'Deser', drinks: 'Napoje',
  bakery:    'Pieczywo',  fast:   'Szybki', no_power: 'Bez prądu',
};

// UI-лейбли тіла сторінки рецепту (ключі _getLang(): 'uk' | 'en' | 'pl')
const UI_LABELS = {
  uk: {
    author: 'Автор', share: 'Поділитися',
    shareTitle: 'Поділитися рецептом',
    prep: 'Підготовка', cook: 'Готування', time: 'Час', servings: 'Порцій',
    min: 'хв', kcal: 'ккал', proteins: 'Білки', fats: 'Жири', carbs: 'Вуглев.', gram: 'г',
    ingredients: 'Інгредієнти', steps: 'Приготування',
    allRecipes: 'Переглянути всі рецепти →', linkCopied: 'Посилання скопійовано',
    ctaTitleIn: 'Сподобався рецепт?',
    ctaSubIn: 'Збережіть у свою книгу рецептів і повертайтесь коли захочеться приготувати',
    ctaSave: 'Зберегти в книгу', ctaAll: 'Всі рецепти',
    ctaTitleOut: 'Готуйте більше з Minto',
    ctaSubOut: 'Увійдіть щоб зберегти рецепт у свою книгу, планувати меню на тиждень і рахувати КБЖУ',
    ctaLogin: 'Увійти / Зареєструватись', ctaBrowse: 'Переглянути рецепти',
    notFoundTitle: 'Рецепт не знайдено', notFoundDocTitle: 'Рецепт не знайдено — Minto',
    notFoundSub: 'Можливо, його видалено або посилання застаріло.',
    notFoundBtn: 'Переглянути всі рецепти',
  },
  en: {
    author: 'Author', share: 'Share',
    shareTitle: 'Share recipe',
    prep: 'Prep', cook: 'Cook', time: 'Time', servings: 'Servings',
    min: 'min', kcal: 'kcal', proteins: 'Protein', fats: 'Fats', carbs: 'Carbs', gram: 'g',
    ingredients: 'Ingredients', steps: 'Instructions',
    allRecipes: 'View all recipes →', linkCopied: 'Link copied',
    ctaTitleIn: 'Liked the recipe?',
    ctaSubIn: 'Save it to your cookbook and come back whenever you want to cook',
    ctaSave: 'Save to cookbook', ctaAll: 'All recipes',
    ctaTitleOut: 'Cook more with Minto',
    ctaSubOut: 'Sign in to save recipes to your cookbook, plan weekly menus and track macros',
    ctaLogin: 'Sign in / Sign up', ctaBrowse: 'Browse recipes',
    notFoundTitle: 'Recipe not found', notFoundDocTitle: 'Recipe not found — Minto',
    notFoundSub: 'It may have been deleted or the link is outdated.',
    notFoundBtn: 'View all recipes',
  },
  pl: {
    author: 'Autor', share: 'Udostępnij',
    shareTitle: 'Udostępnij przepis',
    prep: 'Przygotowanie', cook: 'Gotowanie', time: 'Czas', servings: 'Porcje',
    min: 'min', kcal: 'kcal', proteins: 'Białko', fats: 'Tłuszcze', carbs: 'Węglow.', gram: 'g',
    ingredients: 'Składniki', steps: 'Przygotowanie',
    allRecipes: 'Zobacz wszystkie przepisy →', linkCopied: 'Skopiowano link',
    ctaTitleIn: 'Spodobał się przepis?',
    ctaSubIn: 'Zapisz go w swojej książce przepisów i wróć, kiedy zechcesz gotować',
    ctaSave: 'Zapisz do książki', ctaAll: 'Wszystkie przepisy',
    ctaTitleOut: 'Gotuj więcej z Minto',
    ctaSubOut: 'Zaloguj się, aby zapisywać przepisy, planować menu na tydzień i liczyć makra',
    ctaLogin: 'Zaloguj / Zarejestruj się', ctaBrowse: 'Przeglądaj przepisy',
    notFoundTitle: 'Nie znaleziono przepisu', notFoundDocTitle: 'Nie znaleziono przepisu — Minto',
    notFoundSub: 'Mógł zostać usunięty lub link jest nieaktualny.',
    notFoundBtn: 'Zobacz wszystkie przepisy',
  },
};

function _t(key) {
  const lang = _getLang();
  return UI_LABELS[lang]?.[key] ?? UI_LABELS.uk[key] ?? key;
}

// Detect current lang: ?lang= param → localStorage → 'uk'
function _getLang() {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl && ['uk', 'ua', 'en', 'pl'].includes(fromUrl)) return fromUrl === 'ua' ? 'uk' : fromUrl;
  try {
    const stored = localStorage.getItem('lang');
    if (stored === 'ua') return 'uk';
    if (stored && ['uk', 'en', 'pl'].includes(stored)) return stored;
  } catch (_) {}
  return 'uk';
}

// Витягуємо slug з URL: /recipe/borshch-z-pampushkamy
const _slug = window.location.pathname.match(/\/recipe\/([^/]+)/)?.[1] ?? null;
const _root = document.getElementById('recipeRoot');

let _recipe = null;

// ── Init ─────────────────────────────────────────────────────

async function init() {
  _renderSkeleton();

  // initAuth керує headerAuthBtn + відкриває модалку при потребі
  await initAuth((_event, user) => _updateSaveCTA(!!user));

  if (!_slug) { _show404(); return; }

  // Отримуємо рецепт по slug
  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('id, name_ua, name_en, name_pl, slug, image, kcal, protein, fat, carbs, steps, steps_en, steps_pl, category, rating, user_id, created_at, prep_time_min, cook_time_min, total_time_min, recipe_yield')
    .eq('slug', _slug)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !recipe) { _show404(); return; }

  _recipe = recipe;

  // Паралельно: автор + інгредієнти
  const [profileRes, ingRes] = await Promise.all([
    recipe.user_id
      ? supabase.from('profiles').select('display_name, full_name').eq('id', recipe.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('product_recipe')
      .select('amount, unit, ingredient:products(name_ua, name_en, name_pl)')
      .eq('recipe_id', recipe.id),
  ]);

  const authorName  = profileRes.data?.display_name || profileRes.data?.full_name || null;
  const ingredients = ingRes.data ?? [];

  _renderRecipe(recipe, authorName, ingredients);
  _updateMeta(recipe, authorName);
  _injectSchemaOrg(recipe, authorName, ingredients);
  _updateSaveCTA(isLoggedIn());
}

// ── Render recipe ─────────────────────────────────────────────

function _renderRecipe(recipe, authorName, ingredients) {
  const name     = _getLocalizedName(recipe, _getLang());
  const catLabel = _getCategoryLabel(recipe.category, _getLang());
  const safeHeroImage = _safeImage(recipe.image);

  const heroHtml = safeHeroImage
    ? `<img class="rp-hero" src="${safeHeroImage}" alt="${_esc(name)}" loading="eager" decoding="async">`
    : `<div class="rp-hero--empty">${iconPlate}</div>`;

  const timeParts = [];
  if (recipe.prep_time_min)  timeParts.push(`${_t('prep')}: ${recipe.prep_time_min} ${_t('min')}`);
  if (recipe.cook_time_min)  timeParts.push(`${_t('cook')}: ${recipe.cook_time_min} ${_t('min')}`);
  if (!timeParts.length && recipe.total_time_min) timeParts.push(`${_t('time')}: ${recipe.total_time_min} ${_t('min')}`);
  if (recipe.recipe_yield)   timeParts.push(`${_t('servings')}: ${recipe.recipe_yield}`);

  const metaItems = [
    authorName ? `<span>${_t('author')}: <b>${_esc(authorName)}</b></span>` : '',
    catLabel   ? `<span class="rp-meta__chip">${catLabel}</span>`  : '',
    recipe.rating > 0
      ? `<span class="rp-meta__rating">${iconStar} ${Number(recipe.rating).toFixed(1)}</span>`
      : '',
    ...timeParts.map(t => `<span class="rp-meta__dot">${_esc(t)}</span>`),
    `<span>${_formatDate(recipe.created_at)}</span>`,
    `<button class="rp-share-btn" id="rpShareBtn" title="${_t('shareTitle')}" type="button">
      ${iconShare.replace('<svg ', '<svg width="16" height="16" aria-hidden="true" ')}
      ${_t('share')}
    </button>`,
  ].filter(Boolean).join('');

  const macrosHtml = (recipe.kcal != null) ? `
    <div class="rp-macros">
      <div class="rp-macro">
        <span class="rp-macro__val">${recipe.kcal}</span>
        <span class="rp-macro__lbl">${_t('kcal')}</span>
      </div>
      <div class="rp-macro">
        <span class="rp-macro__val">${recipe.protein ?? '—'}${_t('gram')}</span>
        <span class="rp-macro__lbl">${_t('proteins')}</span>
      </div>
      <div class="rp-macro">
        <span class="rp-macro__val">${recipe.fat ?? '—'}${_t('gram')}</span>
        <span class="rp-macro__lbl">${_t('fats')}</span>
      </div>
      <div class="rp-macro">
        <span class="rp-macro__val">${recipe.carbs ?? '—'}${_t('gram')}</span>
        <span class="rp-macro__lbl">${_t('carbs')}</span>
      </div>
    </div>` : '';

  const ingsHtml = ingredients.length
    ? `<h2 class="rp-h2">${_t('ingredients')}</h2>
       <ul class="rp-ings">
         ${ingredients.map(i => {
           const ing = i.ingredient ?? {};
           const lang = _getLang();
           const ingName =
             (lang === 'pl' && ing.name_pl) ? ing.name_pl :
             (lang === 'en' && ing.name_en) ? ing.name_en :
             ing.name_ua || ing.name_en || '—';
           // Показуємо міру лише коли є кількість. Інакше (напр. "за смаком")
           // нічого не показуємо замість фейкового "1 шт"/"null г".
           const amountLabel = (i.amount != null && i.amount !== '')
             ? `${i.amount}${i.unit || _t('gram')}`
             : (i.unit || '');
           return `<li class="rp-ing">
             <span class="rp-ing__dot"></span>
             <span>${_esc(ingName)}</span>
             <span class="rp-ing__amount">${_esc(amountLabel)}</span>
           </li>`;
         }).join('')}
       </ul>`
    : '';

  const steps = _getLocalizedSteps(recipe, _getLang())
    .split(/\\n|\n/)
    .map(s => s.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);

  const stepsHtml = steps.length
    ? `<h2 class="rp-h2">${_t('steps')}</h2>
       <div class="rp-steps">
         ${steps.map((step, i) => `
           <div class="rp-step">
             <span class="rp-step__num">${i + 1}</span>
             <p class="rp-step__text">${_esc(step)}</p>
           </div>`).join('')}
       </div>`
    : '';

  _root.innerHTML = `
    ${heroHtml}
    <div class="rp-content">
      <h1 class="rp-title">${_esc(name)}</h1>
      <div class="rp-meta">${metaItems}</div>
      ${macrosHtml}
      ${ingsHtml}
      ${stepsHtml}
      <div class="rp-cta" id="rpCta">
        <!-- Оновлюється через _updateSaveCTA -->
      </div>
    </div>
    <footer class="rp-footer">
      <span>© Minto ${new Date().getFullYear()}</span>
      <a href="recipes.html">${_t('allRecipes')}</a>
    </footer>
  `;

  // Прибираємо скелетон-клас після рендеру
  document.documentElement.classList.remove('no-transition');

  // Share button
  document.getElementById('rpShareBtn')?.addEventListener('click', () => _shareRecipe(recipe));
}

function _shareRecipe(recipe) {
  const name = _getLocalizedName(recipe, _getLang());
  const url  = _canonicalUrl();

  if (navigator.share) {
    navigator.share({ title: `${name} — Minto`, url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).then(() => {
      const btn = document.getElementById('rpShareBtn');
      if (!btn) return;
      const orig = btn.innerHTML;
      btn.textContent = _t('linkCopied');
      btn.disabled = true;
      setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2000);
    }).catch(() => {});
  }
}

// ── Save CTA ──────────────────────────────────────────────────

function _updateSaveCTA(loggedIn) {
  const el = document.getElementById('rpCta');
  if (!el || !_recipe) return;

  if (loggedIn) {
    el.innerHTML = `
      <div class="rp-cta__icon">${iconBookOpen}</div>
      <p class="rp-cta__title">${_t('ctaTitleIn')}</p>
      <p class="rp-cta__sub">${_t('ctaSubIn')}</p>
      <div class="rp-cta__actions">
        <a href="recipes.html?recipe=${_recipe.id}" class="btn btn--primary">${_t('ctaSave')}</a>
        <a href="recipes.html" class="btn btn--ghost">${_t('ctaAll')}</a>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="rp-cta__icon">${iconLeaf}</div>
      <p class="rp-cta__title">${_t('ctaTitleOut')}</p>
      <p class="rp-cta__sub">${_t('ctaSubOut')}</p>
      <div class="rp-cta__actions">
        <button class="btn btn--primary" id="rpCtaLogin">${_t('ctaLogin')}</button>
        <a href="recipes.html" class="btn btn--ghost">${_t('ctaBrowse')}</a>
      </div>`;
    document.getElementById('rpCtaLogin')
      ?.addEventListener('click', () => openAuthModal('login'));
  }
}

// ── 404 ───────────────────────────────────────────────────────

function _show404() {
  document.title = _t('notFoundDocTitle');
  _root.innerHTML = `
    <div class="rp-404">
      <div class="rp-404__icon">${iconLeaf}</div>
      <h1 class="rp-404__title">${_t('notFoundTitle')}</h1>
      <p class="rp-404__sub">${_t('notFoundSub')}</p>
      <a href="recipes.html" class="btn btn--primary">${_t('notFoundBtn')}</a>
    </div>`;
}

// ── Skeleton ──────────────────────────────────────────────────

function _renderSkeleton() {
  _root.innerHTML = `
    <div class="rp-skel">
      <div class="rp-skel-hero"></div>
      <div class="rp-content">
        <div class="rp-skel-block" style="height:36px;width:65%"></div>
        <div class="rp-skel-block" style="height:18px;width:45%;margin-bottom:24px"></div>
        <div class="rp-macros">
          ${[...Array(4)].map(() => '<div class="rp-skel-block rp-macro" style="height:72px"></div>').join('')}
        </div>
        ${[...Array(5)].map(() => '<div class="rp-skel-block" style="height:40px"></div>').join('')}
      </div>
    </div>`;
}

// ── SEO: meta tags ────────────────────────────────────────────

function _updateMeta(recipe, authorName) {
  const lang  = _getLang();
  const name  = _getLocalizedName(recipe, lang);
  const desc  = _buildDescription(recipe, authorName, lang);
  const canonical = _canonicalUrl();
  const image = _safeImage(recipe.image);

  document.title = `${name} — Minto`;
  document.documentElement.lang = lang === 'uk' ? 'uk' : lang;

  _setMeta('name',     'description',    desc);
  _setMeta('property', 'og:title',       name);
  _setMeta('property', 'og:description', desc);
  _setMeta('property', 'og:image',       image);
  _setMeta('property', 'og:url',         canonical);
  _setMeta('name',     'twitter:title',       name);
  _setMeta('name',     'twitter:description', desc);
  _setMeta('name',     'twitter:image',       image);

  const canonicalEl = document.querySelector('link[rel="canonical"]');
  if (canonicalEl) canonicalEl.href = canonical;

  _injectHreflang(canonical);
}

function _canonicalUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('lang');
  return url.toString();
}

function _injectHreflang(canonical) {
  // Remove old hreflang links
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());

  const LANGS = ['uk', 'en', 'pl'];
  LANGS.forEach(lang => {
    const url = new URL(canonical);
    url.searchParams.set('lang', lang);
    const link = document.createElement('link');
    link.rel       = 'alternate';
    link.hreflang  = lang;
    link.href      = url.toString();
    document.head.appendChild(link);
  });

  // x-default → canonical (without ?lang)
  const xDefault = document.createElement('link');
  xDefault.rel      = 'alternate';
  xDefault.hreflang = 'x-default';
  xDefault.href     = canonical;
  document.head.appendChild(xDefault);
}

function _getLocalizedName(recipe, lang) {
  if (lang === 'pl') return recipe.name_pl || recipe.name_ua || 'Przepis';
  if (lang === 'en') return recipe.name_en || recipe.name_ua || 'Recipe';
  return recipe.name_ua || recipe.name_en || 'Рецепт';
}

// steps = UA (база), steps_pl/steps_en — переклади; фолбек на UA
function _getLocalizedSteps(recipe, lang) {
  if (lang === 'pl') return recipe.steps_pl || recipe.steps || '';
  if (lang === 'en') return recipe.steps_en || recipe.steps || '';
  return recipe.steps || '';
}

function _getCategoryLabel(category, lang) {
  if (lang === 'en') return CATEGORY_LABELS_EN[category] ?? category ?? '';
  if (lang === 'pl') return CATEGORY_LABELS_PL[category] ?? category ?? '';
  return CATEGORY_LABELS[category] ?? category ?? '';
}

function _buildDescription(recipe, authorName, lang = 'uk') {
  const parts = [];
  if (lang === 'en') {
    if (recipe.kcal)    parts.push(`${recipe.kcal} kcal`);
    if (recipe.protein) parts.push(`P: ${recipe.protein}g`);
    if (recipe.fat)     parts.push(`F: ${recipe.fat}g`);
    if (recipe.carbs)   parts.push(`C: ${recipe.carbs}g`);
  } else if (lang === 'pl') {
    if (recipe.kcal)    parts.push(`${recipe.kcal} kcal`);
    if (recipe.protein) parts.push(`B: ${recipe.protein}g`);
    if (recipe.fat)     parts.push(`T: ${recipe.fat}g`);
    if (recipe.carbs)   parts.push(`W: ${recipe.carbs}g`);
  } else {
    if (recipe.kcal)    parts.push(`${recipe.kcal} ккал`);
    if (recipe.protein) parts.push(`Б: ${recipe.protein}г`);
    if (recipe.fat)     parts.push(`Ж: ${recipe.fat}г`);
    if (recipe.carbs)   parts.push(`В: ${recipe.carbs}г`);
  }

  const macros   = parts.length ? parts.join(' · ') : '';
  const catLabel = _getCategoryLabel(recipe.category, lang);
  const author   = authorName
    ? (lang === 'en' ? `Author: ${authorName}.` : lang === 'pl' ? `Autor: ${authorName}.` : `Автор: ${authorName}.`)
    : '';
  const steps    = recipe.steps ? recipe.steps.slice(0, 120).trimEnd() + '…' : '';

  return [catLabel, macros, author, steps].filter(Boolean).join(' ').slice(0, 160);
}

function _setMeta(attr, key, value) {
  const el = document.querySelector(`meta[${attr}="${key}"]`);
  if (el) { el.setAttribute('content', value); return; }
  const m = document.createElement('meta');
  m.setAttribute(attr, key);
  m.setAttribute('content', value);
  document.head.appendChild(m);
}

// ── SEO: Schema.org JSON-LD ───────────────────────────────────

function _injectSchemaOrg(recipe, authorName, ingredients) {
  const name  = recipe.name_ua || recipe.name_en || 'Рецепт';
  const steps = (recipe.steps || '').split(/\\n|\n/).map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);

  const schema = {
    '@context': 'https://schema.org',
    '@type':    'Recipe',
    name,
    image:      _safeImage(recipe.image) ? [_safeImage(recipe.image)] : [],
    author:     { '@type': 'Person', name: authorName || 'Minto' },
    datePublished: recipe.created_at?.slice(0, 10) ?? '',
    description: _buildDescription(recipe, authorName, 'uk'),
    ...(recipe.prep_time_min  && { prepTime:  `PT${recipe.prep_time_min}M`  }),
    ...(recipe.cook_time_min  && { cookTime:  `PT${recipe.cook_time_min}M`  }),
    ...(recipe.total_time_min && { totalTime: `PT${recipe.total_time_min}M` }),
    ...(recipe.recipe_yield   && { recipeYield: String(recipe.recipe_yield) }),
    ...(recipe.category && { recipeCategory: CATEGORY_LABELS[recipe.category] ?? recipe.category }),
    recipeCuisine: 'Ukrainian',
    recipeIngredient: ingredients.map(i => {
      const n = i.ingredient?.name_ua || i.ingredient?.name_en || '';
      const amountLabel = (i.amount != null && i.amount !== '')
        ? `${i.amount}${i.unit || 'г'}`
        : (i.unit || '');
      return `${amountLabel} ${n}`.trim();
    }),
    recipeInstructions: steps.map((text, idx) => ({
      '@type':    'HowToStep',
      position:   idx + 1,
      name:       `Крок ${idx + 1}`,
      text,
    })),
    ...(recipe.kcal != null && {
      nutrition: {
        '@type':              'NutritionInformation',
        calories:             `${recipe.kcal} calories`,
        ...(recipe.protein != null && { proteinContent:       `${recipe.protein} g` }),
        ...(recipe.fat     != null && { fatContent:           `${recipe.fat} g` }),
        ...(recipe.carbs   != null && { carbohydrateContent:  `${recipe.carbs} g` }),
      },
    }),
    ...(recipe.rating > 0 && {
      aggregateRating: {
        '@type':       'AggregateRating',
        ratingValue:   Number(recipe.rating).toFixed(1),
        bestRating:    '5',
        worstRating:   '1',
        ratingCount:   '1',
      },
    }),
  };

  const script = document.createElement('script');
  script.type    = 'application/ld+json';
  script.textContent = JSON.stringify(schema, null, 0);
  document.head.appendChild(script);
}

// ── Utils ─────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _safeImage(url) {
  return safeImageUrl(url);
}

function _formatDate(iso) {
  if (!iso) return '';
  const lang = _getLang();
  const locale = lang === 'en' ? 'en-US' : lang === 'pl' ? 'pl-PL' : 'uk-UA';
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Start ─────────────────────────────────────────────────────

init();
