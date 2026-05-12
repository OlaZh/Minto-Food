// ============================================================
// recipe-page.js — публічна сторінка рецепту (/recipe/:slug)
// Без авторизації, з SEO Schema.org, OG-тегами
// ============================================================

import { supabase }                        from './supabaseClient.js';
import { initAuth, isLoggedIn, openAuthModal } from './auth.js';

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
    .select('id, name_ua, name_en, slug, image, kcal, protein, fat, carbs, steps, category, rating, user_id, created_at, prep_time_min, cook_time_min, total_time_min, recipe_yield')
    .eq('slug', _slug)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !recipe) { _show404(); return; }

  _recipe = recipe;

  // Паралельно: автор + інгредієнти
  const [profileRes, ingRes] = await Promise.all([
    recipe.user_id
      ? supabase.from('profiles').select('full_name').eq('id', recipe.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('product_recipe')
      .select('amount, unit, ingredient:products(name_ua, name_en)')
      .eq('recipe_id', recipe.id),
  ]);

  const authorName  = profileRes.data?.full_name ?? null;
  const ingredients = ingRes.data ?? [];

  _renderRecipe(recipe, authorName, ingredients);
  _updateMeta(recipe, authorName);
  _injectSchemaOrg(recipe, authorName, ingredients);
  _updateSaveCTA(isLoggedIn());
}

// ── Render recipe ─────────────────────────────────────────────

function _renderRecipe(recipe, authorName, ingredients) {
  const name     = recipe.name_ua || recipe.name_en || 'Без назви';
  const catLabel = CATEGORY_LABELS[recipe.category] ?? recipe.category ?? '';

  const heroHtml = recipe.image
    ? `<img class="rp-hero" src="${recipe.image}" alt="${_esc(name)}" loading="eager" decoding="async">`
    : `<div class="rp-hero--empty">🍽</div>`;

  const timeParts = [];
  if (recipe.prep_time_min)  timeParts.push(`Підготовка: ${recipe.prep_time_min} хв`);
  if (recipe.cook_time_min)  timeParts.push(`Готування: ${recipe.cook_time_min} хв`);
  if (!timeParts.length && recipe.total_time_min) timeParts.push(`Час: ${recipe.total_time_min} хв`);
  if (recipe.recipe_yield)   timeParts.push(`Порцій: ${recipe.recipe_yield}`);

  const metaItems = [
    authorName ? `<span>Автор: <b>${_esc(authorName)}</b></span>` : '',
    catLabel   ? `<span class="rp-meta__chip">${catLabel}</span>`  : '',
    recipe.rating > 0
      ? `<span class="rp-meta__rating">★ ${Number(recipe.rating).toFixed(1)}</span>`
      : '',
    ...timeParts.map(t => `<span class="rp-meta__dot">${_esc(t)}</span>`),
    `<span>${_formatDate(recipe.created_at)}</span>`,
    `<button class="rp-share-btn" id="rpShareBtn" title="Поділитися рецептом" type="button">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
      Поділитися
    </button>`,
  ].filter(Boolean).join('');

  const macrosHtml = (recipe.kcal != null) ? `
    <div class="rp-macros">
      <div class="rp-macro">
        <span class="rp-macro__val">${recipe.kcal}</span>
        <span class="rp-macro__lbl">ккал</span>
      </div>
      <div class="rp-macro">
        <span class="rp-macro__val">${recipe.protein ?? '—'}г</span>
        <span class="rp-macro__lbl">Білки</span>
      </div>
      <div class="rp-macro">
        <span class="rp-macro__val">${recipe.fat ?? '—'}г</span>
        <span class="rp-macro__lbl">Жири</span>
      </div>
      <div class="rp-macro">
        <span class="rp-macro__val">${recipe.carbs ?? '—'}г</span>
        <span class="rp-macro__lbl">Вуглев.</span>
      </div>
    </div>` : '';

  const ingsHtml = ingredients.length
    ? `<h2 class="rp-h2">Інгредієнти</h2>
       <ul class="rp-ings">
         ${ingredients.map(i => {
           const ingName = i.ingredient?.name_ua || i.ingredient?.name_en || '—';
           return `<li class="rp-ing">
             <span class="rp-ing__dot"></span>
             <span>${_esc(ingName)}</span>
             <span class="rp-ing__amount">${i.amount}${i.unit || 'г'}</span>
           </li>`;
         }).join('')}
       </ul>`
    : '';

  const steps = (recipe.steps || '')
    .replace(/\\n/g, '\n')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const stepsHtml = steps.length
    ? `<h2 class="rp-h2">Приготування</h2>
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
      <a href="recipes.html">Переглянути всі рецепти →</a>
    </footer>
  `;

  // Прибираємо скелетон-клас після рендеру
  document.documentElement.classList.remove('no-transition');

  // Share button
  document.getElementById('rpShareBtn')?.addEventListener('click', () => _shareRecipe(recipe));
}

function _shareRecipe(recipe) {
  const name = recipe.name_ua || recipe.name_en || 'Рецепт';
  const url  = _canonicalUrl();

  if (navigator.share) {
    navigator.share({ title: `${name} — Minto`, url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).then(() => {
      const btn = document.getElementById('rpShareBtn');
      if (!btn) return;
      const orig = btn.innerHTML;
      btn.textContent = '✓ Посилання скопійовано';
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
      <div class="rp-cta__icon">🔖</div>
      <p class="rp-cta__title">Сподобався рецепт?</p>
      <p class="rp-cta__sub">Збережіть у свою книгу рецептів і повертайтесь коли захочеться приготувати</p>
      <div class="rp-cta__actions">
        <a href="recipes.html?recipe=${_recipe.id}" class="btn btn--primary">Зберегти в книгу</a>
        <a href="recipes.html" class="btn btn--ghost">Всі рецепти</a>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="rp-cta__icon">🌿</div>
      <p class="rp-cta__title">Готуйте більше з Minto</p>
      <p class="rp-cta__sub">Увійдіть щоб зберегти рецепт у свою книгу, планувати меню на тиждень і рахувати КБЖУ</p>
      <div class="rp-cta__actions">
        <button class="btn btn--primary" id="rpCtaLogin">Увійти / Зареєструватись</button>
        <a href="recipes.html" class="btn btn--ghost">Переглянути рецепти</a>
      </div>`;
    document.getElementById('rpCtaLogin')
      ?.addEventListener('click', () => openAuthModal('login'));
  }
}

// ── 404 ───────────────────────────────────────────────────────

function _show404() {
  document.title = 'Рецепт не знайдено — Minto';
  _root.innerHTML = `
    <div class="rp-404">
      <div class="rp-404__icon">🍃</div>
      <h1 class="rp-404__title">Рецепт не знайдено</h1>
      <p class="rp-404__sub">Можливо, його видалено або посилання застаріло.</p>
      <a href="recipes.html" class="btn btn--primary">Переглянути всі рецепти</a>
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
  const image = recipe.image || '';

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
  if (lang === 'en' || lang === 'pl') return recipe.name_en || recipe.name_ua || 'Recipe';
  return recipe.name_ua || recipe.name_en || 'Рецепт';
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
  const steps = (recipe.steps || '').replace(/\\n/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);

  const schema = {
    '@context': 'https://schema.org',
    '@type':    'Recipe',
    name,
    image:      recipe.image ? [recipe.image] : [],
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
      return `${i.amount}${i.unit || 'г'} ${n}`.trim();
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

function _formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Start ─────────────────────────────────────────────────────

init();
