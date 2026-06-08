import { supabase } from './supabaseClient.js';
import { initAuth } from './auth.js';
import { showToast } from './utils.js';
import { getLang } from './storage.js';
import { i18n } from './i18n.js';
import { getRecipeDisplayName } from './recipe-utils.js';
import { lockScroll, unlockScroll } from './scroll-lock.js';
import { showLoading, showConfirmModal } from './ui-components.js';
import { initRecipeModal, openRecipeModal, openRecipeModalForEdit } from './recipe-modal.js';
import {
  iconSearch, iconGlobe as iconGlobal, iconMoreVertical, iconChevronDown,
  iconHeart, iconPlus, iconEdit, iconTrash, iconBookmark, iconFlag,
  iconSunrise, iconSun, iconMoon, iconApple, iconCakeSlice, iconMug,
  iconBread, iconPorridge, iconSoup, iconSalad, iconSideDish, iconPlate,
  iconPasta, iconSauce, iconSandwich, iconCasserole, iconPancakes, iconOmelet,
  iconSmoothie, iconBoil, iconOven, iconSteam, iconGrill, iconStew, iconSoak,
  iconLeafRaw, iconAlert, iconScale, iconClose, iconStar, iconStarFilled, iconCalendar, iconLock,
  iconProtein, iconLowCarb, iconLowCal, iconLowFat, iconVeg, iconSprout,
  iconNoGluten, iconNoLactose, iconAvocado, iconDiabetic, iconHealthy,
  iconBolt, iconKid, iconWallet, iconNoCook, iconBento, iconCandle,
} from './icons.js';
import { parseFoodInput, formatAmount } from './parse-food.js';
import {
  initBookSelector,
  quickSaveToDefault,
  openBookSelector,
  isRecipeSaved,
  openReportModal,
  removeRecipeFromBook,
  removeRecipeFromAllBooks,
  getRecipeBooks,
} from './book-selector.js';

// =============================================================
// 1. ОГОЛОШЕННЯ ЕЛЕМЕНТІВ (DOM)
// =============================================================

const addBtn = document.getElementById('open-add-modal');

const viewModal = document.getElementById('view-recipe-modal');
const closeViewModalBtn = document.getElementById('close-view-modal');
const closeViewBtn = document.getElementById('close-view-btn');
const saveNotesBtn = document.getElementById('save-notes-btn');

// =============================================================
// 2. ДАНІ ТА СТАН
// =============================================================

let currentViewingId = null;
let currentUser = null;

// Фільтр власних рецептів (browsing): 'all' | 'private' | 'public' | 'pending'
let ownFilter = 'all';
let ownRecipesCache = [];
let savedRecipeIdsCache = [];

// Пошук/browsing state
let searchOwnShowAll = false;
let searchCommunityShowAll = false;
const SEARCH_PREVIEW_LIMIT = 4;

// =============================================================
// 3. ДОПОМІЖНІ ФУНКЦІЇ
// =============================================================

const updateStarsUI = (rating) => {
  const ratingContainer = document.querySelector('.recipe-rating');
  if (!ratingContainer) return;

  const stars = ratingContainer.querySelectorAll('.star');
  const valDisplay = ratingContainer.querySelector('.rating-value');
  const numericRating = Number(rating) || 0;

  stars.forEach((star) => {
    const starValue = Number(star.dataset.value);
    if (starValue <= numericRating) {
      star.classList.add('filled');
      star.innerHTML = iconStarFilled;
    } else {
      star.classList.remove('filled');
      star.innerHTML = iconStar;
    }
  });

  if (valDisplay) {
    valDisplay.textContent = numericRating > 0 ? numericRating.toFixed(1) : '0.0';
  }
};

function getRecipeName(recipe) {
  return getRecipeDisplayName(recipe, getLang());
}

function isOwnRecipe(recipe) {
  if (!currentUser || !recipe) return false;
  return recipe.user_id === currentUser.id;
}

// Чи відповідає рецепт активному фільтру власної секції
function matchesOwnFilter(recipe) {
  switch (ownFilter) {
    case 'pending':
      return recipe.status === 'pending';
    case 'public':
      return recipe.is_public === true && recipe.status !== 'pending';
    case 'private':
      return recipe.is_public !== true;
    case 'all':
    default:
      return true;
  }
}

// Рендер власної секції з урахуванням активного фільтра
function renderOwnRecipes() {
  const ownRow = document.getElementById('own-row');
  const ownCount = document.getElementById('own-count');
  if (!ownRow) return;

  const filtered = ownRecipesCache.filter(matchesOwnFilter);

  ownRow.innerHTML = '';
  if (filtered.length === 0) {
    ownRow.innerHTML = `<p class="recipe-own-filter__empty">У цій категорії поки порожньо</p>`;
  } else {
    filtered.forEach((r) => ownRow.appendChild(buildRecipeCard(r, savedRecipeIdsCache)));
  }

  // Бейдж показує кількість у поточному фільтрі (або загальну для "Усі")
  if (ownCount) {
    ownCount.textContent = ownFilter === 'all' ? ownRecipesCache.length : filtered.length;
  }
}

// Навісити обробники на чіпи фільтра (одноразово при init)
function initOwnFilter() {
  const bar = document.getElementById('own-filter');
  if (!bar) return;
  bar.addEventListener('click', (e) => {
    const chip = e.target.closest('.recipe-own-filter__chip');
    if (!chip) return;
    ownFilter = chip.dataset.filter || 'all';
    bar.querySelectorAll('.recipe-own-filter__chip').forEach((c) =>
      c.classList.toggle('is-active', c === chip),
    );
    renderOwnRecipes();
  });
}

// =============================================================
// 4. ЗАВАНТАЖЕННЯ ТА ВІДОБРАЖЕННЯ РЕЦЕПТІВ З SUPABASE
// =============================================================

function showRecipeSkeletons(count = 10) {
  const grid = document.getElementById('community-grid');
  if (!grid) return;
  grid.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-card__image"></div>
      <div class="skeleton-card__content">
        <div class="skeleton-card__title"></div>
        <div class="skeleton-card__subtitle"></div>
        <div class="skeleton-card__footer">
          <div class="skeleton-card__badge"></div>
          <div class="skeleton-card__btn"></div>
        </div>
      </div>
    </div>
  `).join('');
}

function showRecipesWelcomeState() {
  const sectionOwn       = document.getElementById('section-own');
  const sectionCommunity = document.getElementById('section-community');
  const sectionSearchOwn = document.getElementById('section-search-own');
  const sectionSearchCommunity = document.getElementById('section-search-community');
  const communityGrid    = document.getElementById('community-grid');

  if (sectionOwn)            sectionOwn.hidden = true;
  if (sectionSearchOwn)      sectionSearchOwn.hidden = true;
  if (sectionSearchCommunity)sectionSearchCommunity.hidden = true;
  if (sectionCommunity)      sectionCommunity.hidden = false;

  if (communityGrid) {
    communityGrid.innerHTML = `
      <div class="recipe-empty-state" style="grid-column:1/-1">
        <div class="recipe-empty-state__icon">${iconPlate}</div>
        <p class="recipe-empty-state__title">Знайдіть ідеальну страву</p>
        <p class="recipe-empty-state__text">Введіть назву або скористайтеся фільтрами</p>
        <button class="btn btn--secondary" id="welcome-browse-all-btn" style="margin-top:8px">Переглянути всі рецепти</button>
      </div>`;
    document.getElementById('welcome-browse-all-btn')?.addEventListener('click', () => {
      loadAndDisplayRecipes(true);
    });
  }
}

async function loadAndDisplayRecipes(force = false) {
  const searchQuery = document.getElementById('recipe-search-input')?.value?.trim() || '';

  if (!force && !searchQuery && !hasActiveFilters()) {
    showRecipesWelcomeState();
    if (!currentUser) {
      const { data: { user } } = await supabase.auth.getUser();
      currentUser = user;
    }
    return;
  }

  showRecipeSkeletons();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  currentUser = user;

  let query = supabase.from('recipes').select('*');

  if (user) {
    query = query.or(`status.eq.published,user_id.eq.${user.id}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Помилка завантаження рецептів:', error);
    const grid = document.getElementById('community-grid');
    if (grid) grid.innerHTML = `
      <div class="recipe-empty-state">
        <div class="recipe-empty-state__icon">${iconAlert}</div>
        <p class="recipe-empty-state__title">Не вдалося завантажити рецепти</p>
        <p class="recipe-empty-state__text">Перевірте з'єднання та спробуйте ще раз</p>
      </div>`;
    return;
  }

  displayRecipes(data || [], false);
}

function t(key) {
  const lang = getLang();
  return (i18n[lang] || i18n.ua)[key] || key;
}

function getCategoryLabel(value) {
  const key = `cat_${value}`;
  return t(key) !== key ? t(key) : value;
}

function getDifficultyLabel(value) {
  const key = `diff_${value}`;
  return t(key) !== key ? t(key) : value;
}

function parsePositiveNumber(value) {
  const normalized = String(value ?? '').replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatRecipeMacroValue(value, decimals = 1) {
  const num = Number(value) || 0;
  if (decimals === 0) return String(Math.round(num));
  return num.toFixed(decimals).replace(/\.0$/, '');
}

function getRecipeNutritionNote(recipe) {
  const totalWeight = parsePositiveNumber(recipe?.total_weight);
  if (totalWeight) {
    return `Готова страва: приблизно ${formatRecipeMacroValue(recipe?.kcal, 0)} ккал на 100 г`;
  }

  return 'Сума сирих інгредієнтів. Вкажіть вагу готової страви, щоб побачити КБЖУ на 100 г.';
}

// =============================================================
// ФІЛЬТРИ — дворівнева архітектура
//   1. COLUMN_GROUPS — фільтрують напряму по колонках recipes
//   2. TAG_GROUP_TYPES — фільтрують через recipe_tags (з tags table)
// =============================================================

const COLUMN_GROUPS = [
  {
    id: 'category',
    dbColumn: 'category',
    labelKey: 'filterGroupCategory',
    options: [
      { value: 'breakfast',  ua: 'Сніданок',   en: 'Breakfast', pl: 'Śniadanie',  icon: iconSunrise },
      { value: 'lunch',      ua: 'Обід',        en: 'Lunch',     pl: 'Obiad',      icon: iconSun },
      { value: 'dinner',     ua: 'Вечеря',      en: 'Dinner',    pl: 'Kolacja',    icon: iconMoon },
      { value: 'snack',      ua: 'Перекус',     en: 'Snack',     pl: 'Przekąska',  icon: iconApple },
      { value: 'dessert',    ua: 'Десерт',      en: 'Dessert',   pl: 'Deser',      icon: iconCakeSlice },
      { value: 'drinks',     ua: 'Напої',       en: 'Drinks',    pl: 'Napoje',     icon: iconMug },
      { value: 'bakery',     ua: 'Випічка',     en: 'Bakery',    pl: 'Pieczywo',   icon: iconBread },
    ],
  },
  {
    id: 'dish_type',
    dbColumn: 'type',
    labelKey: 'filterGroupDishType',
    options: [
      { value: 'porridge',    ua: 'Каша',           en: 'Porridge',   pl: 'Kasza',        icon: iconPorridge },
      { value: 'soup',        ua: 'Суп',            en: 'Soup',       pl: 'Zupa',         icon: iconSoup },
      { value: 'salad',       ua: 'Салат',          en: 'Salad',      pl: 'Sałatka',      icon: iconSalad },
      { value: 'side_dish',   ua: 'Гарнір',         en: 'Side dish',  pl: 'Dodatek',      icon: iconSideDish },
      { value: 'main_course', ua: 'Основна страва', en: 'Main course',pl: 'Danie główne', icon: iconPlate },
      { value: 'pasta',       ua: 'Паста',          en: 'Pasta',      pl: 'Makaron',      icon: iconPasta },
      { value: 'sauce',       ua: 'Соус',           en: 'Sauce',      pl: 'Sos',          icon: iconSauce },
      { value: 'sandwich',    ua: 'Сендвіч',        en: 'Sandwich',   pl: 'Kanapka',      icon: iconSandwich },
      { value: 'casserole',   ua: 'Запіканка',      en: 'Casserole',  pl: 'Zapiekanka',   icon: iconCasserole },
      { value: 'pancakes',    ua: 'Млинці',         en: 'Pancakes',   pl: 'Naleśniki',    icon: iconPancakes },
      { value: 'omelet',      ua: 'Омлет',          en: 'Omelet',     pl: 'Omlet',        icon: iconOmelet },
      { value: 'smoothie',    ua: 'Смузі',          en: 'Smoothie',   pl: 'Smoothie',     icon: iconSmoothie },
    ],
  },
  {
    id: 'cooking_method',
    dbColumn: 'cooking_method',
    labelKey: 'filterGroupCookingMethod',
    options: [
      { value: 'boiling',  ua: 'Варіння',          en: 'Boiling',    pl: 'Gotowanie',   icon: iconBoil },
      { value: 'frying',   ua: 'Смаження',         en: 'Frying',     pl: 'Smażenie',    icon: iconOmelet },
      { value: 'baking',   ua: 'Запікання',        en: 'Baking',     pl: 'Pieczenie',   icon: iconOven },
      { value: 'steaming', ua: 'На парі',          en: 'Steaming',   pl: 'Na parze',    icon: iconSteam },
      { value: 'grilling', ua: 'Гриль',            en: 'Grilling',   pl: 'Grillowanie', icon: iconGrill },
      { value: 'stewing',  ua: 'Тушкування',       en: 'Stewing',    pl: 'Duszenie',    icon: iconStew },
      { value: 'soaking',  ua: 'Замочування',      en: 'Soaking',    pl: 'Namaczanie',  icon: iconSoak },
      { value: 'fresh',    ua: 'Без термообробки', en: 'Fresh/Raw',  pl: 'Bez obróbki', icon: iconLeafRaw },
    ],
  },
];

// Типи тегів що приходять з tags table (via recipe_tags)
const TAG_GROUP_LABEL_KEYS = {
  dietary:   'filterGroupDietary',
  lifestyle: 'filterGroupLifestyle',
  // legacy
  diet:      'filterGroupDietary',
  nutrition: 'filterGroupDietary',
  health:    'filterGroupDietary',
};

const COLUMN_GROUP_IDS = new Set(COLUMN_GROUPS.map((g) => g.id));

// selectedFilters: { [groupId]: Set }
//   для column-груп → Set<string value>
//   для tag-груп   → Set<number tagId>
const selectedFilters = {};

// id вкладки, яка зараз відкрита (зберігається між перебудовами панелі)
let _activeFilterTab = null;

const TAG_ICON_MAP = {
  high_protein: iconProtein,
  low_carb: iconLowCarb,
  low_calorie: iconLowCal,
  low_fat: iconLowFat,
  vegetarian: iconVeg,
  vegan: iconSprout,
  gluten_free: iconNoGluten,
  lactose_free: iconNoLactose,
  keto: iconAvocado,
  diabetic: iconDiabetic,
  pp: iconHealthy,
  quick: iconBolt,
  kids: iconKid,
  budget: iconWallet,
  no_cook: iconNoCook,
  meal_prep: iconBento,
  no_power: iconCandle,
};

function getTagIconMarkup(tag) {
  const mappedIcon = TAG_ICON_MAP[tag.code];
  if (mappedIcon) return mappedIcon;
  return typeof tag.icon === 'string' && tag.icon.includes('<svg') ? tag.icon : '';
}

function hasActiveFilters() {
  return Object.values(selectedFilters).some((s) => s.size > 0);
}

async function applyRecipeFilters() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const statusFilter = user
    ? `status.eq.published,user_id.eq.${user.id}`
    : 'status.eq.published';

  // 1. Тагові групи → отримуємо recipe_id через recipe_tags
  const activeTagGroups = Object.entries(selectedFilters).filter(
    ([key, s]) => s.size > 0 && !COLUMN_GROUP_IDS.has(key),
  );

  let tagMatchingIds = null;
  if (activeTagGroups.length > 0) {
    const recipeSets = await Promise.all(
      activeTagGroups.map(async ([, tagIds]) => {
        const { data } = await supabase
          .from('recipe_tags')
          .select('recipe_id')
          .in('tag_id', [...tagIds]);
        return new Set((data || []).map((r) => r.recipe_id));
      }),
    );
    tagMatchingIds = recipeSets[0];
    for (let i = 1; i < recipeSets.length; i++) {
      tagMatchingIds = new Set([...tagMatchingIds].filter((id) => recipeSets[i].has(id)));
    }
    if (tagMatchingIds.size === 0) {
      displayRecipes([], false);
      return;
    }
  }

  // 2. Будуємо головний запит
  let query = supabase.from('recipes').select('*').or(statusFilter);

  // 2a. Колонкові фільтри (AND між групами, OR всередині)
  for (const group of COLUMN_GROUPS) {
    const sel = selectedFilters[group.id];
    if (sel?.size > 0) {
      query = query.in(group.dbColumn, [...sel]);
    }
  }

  // 2b. Тагові фільтри через ID-список
  if (tagMatchingIds !== null) {
    query = query.in('id', [...tagMatchingIds]);
  }

  const { data, error } = await query;
  if (!error) displayRecipes(data || [], false);
}

function resetSearch() {
  const searchInputEl = document.getElementById('recipe-search-input');
  const clearBtn = document.getElementById('clear-search-btn');
  const searchModeEl = document.getElementById('search-mode-btn');
  if (searchInputEl) searchInputEl.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  if (searchModeEl) {
    searchModeEl.innerHTML = iconSearch;
    searchModeEl.classList.remove('is-active');
  }
}

async function buildFilterPanel() {
  const panel = document.getElementById('recipe-filters-panel');
  if (!panel) return;

  const lang = getLang();
  const nameField = lang === 'en' ? 'name_en' : lang === 'pl' ? 'name_pl' : 'name_ua';

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const statusFilter = user
    ? `status.eq.published,user_id.eq.${user.id}`
    : 'status.eq.published';

  const { data: pubRecipes } = await supabase
    .from('recipes')
    .select('id, category, type, cooking_method')
    .or(statusFilter);

  const pubIds = (pubRecipes || []).map((r) => r.id);
  const colCounts = { category: {}, dish_type: {}, cooking_method: {} };
  (pubRecipes || []).forEach((r) => {
    if (r.category)       colCounts.category[r.category]             = (colCounts.category[r.category] || 0) + 1;
    if (r.type)           colCounts.dish_type[r.type]                = (colCounts.dish_type[r.type] || 0) + 1;
    if (r.cooking_method) colCounts.cooking_method[r.cooking_method] = (colCounts.cooking_method[r.cooking_method] || 0) + 1;
  });

  const { data: tags } = await supabase
    .from('tags')
    .select('id, code, type, name_ua, name_en, name_pl, icon')
    .eq('is_active', true)
    .order('id');

  const tagCounts = {};
  if (pubIds.length > 0 && tags?.length) {
    const { data: links } = await supabase
      .from('recipe_tags')
      .select('tag_id')
      .in('recipe_id', pubIds);
    (links || []).forEach((l) => {
      tagCounts[l.tag_id] = (tagCounts[l.tag_id] || 0) + 1;
    });
  }

  const tagGroups = {};
  (tags || []).forEach((tag) => {
    if (!tagGroups[tag.type]) tagGroups[tag.type] = [];
    tagGroups[tag.type].push(tag);
  });

  panel.innerHTML = '';

  const allGroups = [];
  for (const group of COLUMN_GROUPS) {
    allGroups.push({ id: group.id, label: t(group.labelKey), kind: 'column', group });
  }
  for (const type of ['dietary', 'lifestyle']) {
    const labelKey = TAG_GROUP_LABEL_KEYS[type];
    if (!labelKey) continue;
    allGroups.push({ id: type, label: t(labelKey), kind: 'tag', groupTags: tagGroups[type] || [] });
  }

  // Рядок вкладок — ті самі класи що на путівнику продуктів
  const tabsRow = document.createElement('div');
  tabsRow.className = 'product-filters';

  // Обгортка абсолютних панелей підфільтрів
  const subfiltersWrapper = document.createElement('div');
  subfiltersWrapper.className = 'product-subfilters';

  allGroups.forEach((groupInfo) => {
    const selCount = selectedFilters[groupInfo.id]?.size || 0;
    const isActive = _activeFilterTab === groupInfo.id;

    // Таб-кнопка
    const tabBtn = document.createElement('button');
    tabBtn.type = 'button';
    tabBtn.className = 'product-filters__item' + (isActive ? ' is-active' : '');
    tabBtn.textContent = selCount > 0 ? `${groupInfo.label} (${selCount})` : groupInfo.label;

    // Панель підфільтрів
    const groupPanel = document.createElement('div');
    groupPanel.className = 'subfilter-group' + (isActive ? ' active' : '');
    groupPanel.dataset.subfilter = groupInfo.id;

    function buildItems() {
      if (groupInfo.kind === 'column') {
        const group = groupInfo.group;
        group.options.forEach((opt) => {
          const count = colCounts[group.id][opt.value] || 0;
          const isChecked = selectedFilters[group.id]?.has(opt.value) || false;
          const label = opt[lang === 'en' ? 'en' : lang === 'pl' ? 'pl' : 'ua'] || opt.ua;

          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'subfilter-item' + (isChecked ? ' is-active' : '');
          item.innerHTML = `${opt.icon ? opt.icon + ' ' : ''}${label}${count > 0 ? ` <span style="opacity:.55;font-size:11px;font-weight:600">${count}</span>` : ''}`;

          item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!selectedFilters[group.id]) selectedFilters[group.id] = new Set();
            if (selectedFilters[group.id].has(opt.value)) {
              selectedFilters[group.id].delete(opt.value);
              if (selectedFilters[group.id].size === 0) delete selectedFilters[group.id];
              item.classList.remove('is-active');
            } else {
              selectedFilters[group.id].add(opt.value);
              item.classList.add('is-active');
            }
            const newSel = selectedFilters[group.id]?.size || 0;
            tabBtn.textContent = newSel > 0 ? `${groupInfo.label} (${newSel})` : groupInfo.label;
            resetSearch();
            hasActiveFilters() ? applyRecipeFilters() : loadAndDisplayRecipes();
          });

          groupPanel.appendChild(item);
        });
      } else {
        groupInfo.groupTags.forEach((tag) => {
          const count = tagCounts[tag.id] || 0;
          const isChecked = selectedFilters[groupInfo.id]?.has(tag.id) || false;
          const tagName = tag[nameField] || tag.name_ua;
          const tagIcon = getTagIconMarkup(tag);

          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'subfilter-item' + (isChecked ? ' is-active' : '');
          item.innerHTML = `${tagIcon ? tagIcon + ' ' : ''}${tagName}${count > 0 ? ` <span style="opacity:.55;font-size:11px;font-weight:600">${count}</span>` : ''}`;

          item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!selectedFilters[groupInfo.id]) selectedFilters[groupInfo.id] = new Set();
            if (selectedFilters[groupInfo.id].has(tag.id)) {
              selectedFilters[groupInfo.id].delete(tag.id);
              if (selectedFilters[groupInfo.id].size === 0) delete selectedFilters[groupInfo.id];
              item.classList.remove('is-active');
            } else {
              selectedFilters[groupInfo.id].add(tag.id);
              item.classList.add('is-active');
            }
            const newSel = selectedFilters[groupInfo.id]?.size || 0;
            tabBtn.textContent = newSel > 0 ? `${groupInfo.label} (${newSel})` : groupInfo.label;
            resetSearch();
            hasActiveFilters() ? applyRecipeFilters() : loadAndDisplayRecipes();
          });

          groupPanel.appendChild(item);
        });
      }
    }

    buildItems();

    tabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = groupPanel.classList.contains('active');

      subfiltersWrapper.querySelectorAll('.subfilter-group').forEach((g) => g.classList.remove('active'));
      tabsRow.querySelectorAll('.product-filters__item').forEach((b) => b.classList.remove('is-active'));

      if (!isOpen) {
        groupPanel.classList.add('active');
        tabBtn.classList.add('is-active');
        _activeFilterTab = groupInfo.id;
      } else {
        _activeFilterTab = null;
      }
    });

    tabsRow.appendChild(tabBtn);
    subfiltersWrapper.appendChild(groupPanel);
  });

  panel.appendChild(tabsRow);
  panel.appendChild(subfiltersWrapper);

  if (hasActiveFilters()) {
    const resetRow = document.createElement('div');
    resetRow.className = 'filter-reset-row';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'filter-reset-btn';
    resetBtn.type = 'button';
    resetBtn.textContent = t('filterReset');
    resetBtn.addEventListener('click', () => {
      Object.keys(selectedFilters).forEach((k) => delete selectedFilters[k]);
      _activeFilterTab = null;
      buildFilterPanel();
      loadAndDisplayRecipes();
    });
    resetRow.appendChild(resetBtn);
    panel.appendChild(resetRow);
  }
}

// =============================================================
// 4.0 ДОПОМІЖНА: будує DOM-картку рецепту
// =============================================================

function buildRecipeCard(recipe, savedRecipeIds) {
  const rating = recipe.rating || 0;
  const name = getRecipeName(recipe);
  const cardImage =
    recipe.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?q=80&w=500';
  const displayCategory = recipe.category ? getCategoryLabel(recipe.category) : '';
  const isSaved = savedRecipeIds.includes(recipe.id);
  const isOwn = isOwnRecipe(recipe);

  const timeVal = recipe.time_minutes;
  const timePart = timeVal ? `<span class="recipe-card__meta-item">⏱ ${timeVal} ${t('cardMin')}</span>` : '';
  const diffPart = recipe.difficulty
    ? `<span class="recipe-card__meta-item recipe-card__meta-item--diff recipe-card__meta-item--diff-${recipe.difficulty}">${getDifficultyLabel(recipe.difficulty)}</span>`
    : '';
  const weightPart = recipe.total_weight
    ? `<span class="recipe-card__meta-item">${iconScale} ${recipe.total_weight} ${t('cardG')}</span>`
    : '';
  const metaRow = (timePart || diffPart || weightPart)
    ? `<div class="recipe-card__meta">${timePart}${diffPart}${weightPart}</div>`
    : '';

  const card = document.createElement('div');
  card.className = 'recipe-card content-fade-in';
  card.dataset.id = recipe.id;

  card.innerHTML = `
  <div class="recipe-card__image-box">
    <img src="${cardImage}" alt="${name}" class="recipe-card__img" loading="lazy">
    <div class="recipe-card__rating-badge">
      <span class="recipe-card__rating-star">${iconStarFilled}</span>
      <span>${rating > 0 ? Number(rating).toFixed(1) : '0'}</span>
    </div>
    ${isOwn ? (recipe.is_public
      ? `<div class="recipe-card__visibility recipe-card__visibility--public" title="Публічний — видно у спільноті">${iconGlobal}<span>Публічний</span></div>`
      : `<div class="recipe-card__visibility recipe-card__visibility--private" title="Приватний — видно лише тобі">${iconLock}<span>Приватний</span></div>`) : ''}
    ${isOwn ? `<button class="btn-delete-recipe js-delete-recipe" aria-label="Видалити рецепт">${iconClose}</button>` : ''}
    <button class="recipe-card__favorite ${isSaved ? 'recipe-card__favorite--saved' : ''}"
            data-recipe-id="${recipe.id}"
            aria-label="Зберегти в книгу">
      ${iconHeart}
    </button>
  </div>
  <div class="recipe-card__content">
    <h3 class="recipe-card__name">${name}</h3>
    ${recipe.status === 'pending' ? '<div class="recipe-card__pending-badge">На модерації</div>' : ''}
    ${isOwn && recipe.has_pending_update ? `<div class="recipe-card__update-badge">${iconCalendar} Оновлення на перевірці</div>` : ''}
    ${isOwn && recipe.status === 'draft' && recipe.moderation_note
      ? `<div class="recipe-card__mod-note">${recipe.moderation_note}</div>`
      : ''}
    ${metaRow}
    ${isOwn && !recipe.is_public && recipe.status !== 'pending'
      ? `<button class="recipe-card__make-public js-make-public">${iconGlobal}Зробити публічним</button>`
      : ''}
    <div class="recipe-card__footer">
      <span class="recipe-card__kcal">${recipe.kcal || 0} ккал</span>
      <button class="recipe-card__btn js-view-recipe">Переглянути</button>
    </div>
  </div>
`;

  card.querySelector('.recipe-card__favorite').addEventListener('click', async (e) => {
    e.stopPropagation();
    await handleFavoriteClick(e.currentTarget, recipe.id);
  });

  card.querySelector('.js-view-recipe').addEventListener('click', () => {
    openRecipeView(recipe.id);
  });

  const deleteBtn = card.querySelector('.js-delete-recipe');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteConfirm(recipe.id);
    });
  }

  const makePublicBtn = card.querySelector('.js-make-public');
  if (makePublicBtn) {
    makePublicBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMakePublicConfirm(recipe);
    });
  }

  return card;
}

// =============================================================
// 4.1 ВІДОБРАЖЕННЯ РЕЦЕПТІВ: browsing і search режими
// =============================================================

async function displayRecipes(recipes, isSearch = false) {
  // --- Завантажити збережені рецепти ---
  let savedRecipeIds = [];
  if (currentUser) {
    const { data: savedData } = await supabase
      .from('cookbook_recipes')
      .select('recipe_id, cookbooks!inner(user_id)')
      .eq('cookbooks.user_id', currentUser.id);
    if (savedData) savedRecipeIds = savedData.map((d) => d.recipe_id);
  }

  // --- Показати/сховати секції залежно від режиму ---
  const sectionOwn = document.getElementById('section-own');
  const sectionCommunity = document.getElementById('section-community');
  const sectionSearchOwn = document.getElementById('section-search-own');
  const sectionSearchCommunity = document.getElementById('section-search-community');
  const emptyStateEl = document.getElementById('recipes-empty-state');

  const showBrowsing = !isSearch;

  if (sectionOwn) sectionOwn.hidden = isSearch;
  if (sectionCommunity) sectionCommunity.hidden = isSearch;
  if (sectionSearchOwn) sectionSearchOwn.hidden = !isSearch;
  if (sectionSearchCommunity) sectionSearchCommunity.hidden = !isSearch;
  if (emptyStateEl) emptyStateEl.hidden = true;

  // --- РЕЖИМ BROWSING ---
  if (showBrowsing) {
    const ownRecipes = recipes.filter((r) => isOwnRecipe(r));
    const communityRecipes = recipes.filter((r) => !isOwnRecipe(r));

    // Власна секція — кешуємо й рендеримо з урахуванням активного фільтра
    ownRecipesCache = ownRecipes;
    savedRecipeIdsCache = savedRecipeIds;
    if (sectionOwn) sectionOwn.hidden = ownRecipes.length === 0;
    renderOwnRecipes();

    // Загальна база (сітка)
    const communityGrid = document.getElementById('community-grid');
    const communityCount = document.getElementById('community-count');
    if (communityGrid) {
      communityGrid.innerHTML = '';

      if (communityRecipes.length === 0 && ownRecipes.length === 0) {
        communityGrid.innerHTML = `
          <div class="recipe-empty-state">
            <div class="recipe-empty-state__icon">${iconPlate}</div>
            <p class="recipe-empty-state__title">Рецептів не знайдено</p>
            <p class="recipe-empty-state__text">Спробуйте змінити фільтр або додайте свій перший рецепт</p>
            <button class="btn-add-recipe recipe-empty-state__cta" id="empty-state-add-btn">
              ${iconPlus.replace('<svg ', '<svg width="18" height="18" ')}
              Додати рецепт
            </button>
          </div>`;
        document.getElementById('empty-state-add-btn')?.addEventListener('click', () => {
          document.getElementById('open-add-modal')?.click();
        });
      } else {
        communityRecipes.forEach((r) =>
          communityGrid.appendChild(buildRecipeCard(r, savedRecipeIds)),
        );
      }
    }
    if (communityCount) communityCount.textContent = communityRecipes.length;
    return;
  }

  // --- РЕЖИМ SEARCH ---
  const ownResults = recipes.filter((r) => isOwnRecipe(r));
  const communityResults = recipes.filter((r) => !isOwnRecipe(r));

  // Секція "Мої" — горизонтальний рядок, показуємо всі
  if (sectionSearchOwn) sectionSearchOwn.hidden = ownResults.length === 0;
  const searchOwnGrid = document.getElementById('search-own-grid');
  const searchOwnCount = document.getElementById('search-own-count');

  if (searchOwnGrid) {
    searchOwnGrid.innerHTML = '';
    ownResults.forEach((r) => searchOwnGrid.appendChild(buildRecipeCard(r, savedRecipeIds)));
  }
  if (searchOwnCount) searchOwnCount.textContent = ownResults.length;

  // Секція "Загальні"
  if (sectionSearchCommunity) sectionSearchCommunity.hidden = communityResults.length === 0;
  const searchCommunityGrid = document.getElementById('search-community-grid');
  const searchCommunityCount = document.getElementById('search-community-count');
  const searchCommunityShowAllBtn = document.getElementById('search-community-show-all');

  if (searchCommunityGrid) {
    searchCommunityGrid.innerHTML = '';
    const toShow = searchCommunityShowAll
      ? communityResults
      : communityResults.slice(0, SEARCH_PREVIEW_LIMIT * 2);
    toShow.forEach((r) => searchCommunityGrid.appendChild(buildRecipeCard(r, savedRecipeIds)));
  }
  if (searchCommunityCount) searchCommunityCount.textContent = communityResults.length;
  if (searchCommunityShowAllBtn) {
    searchCommunityShowAllBtn.hidden = communityResults.length <= SEARCH_PREVIEW_LIMIT * 2;
    searchCommunityShowAllBtn.textContent = searchCommunityShowAll
      ? 'Згорнути'
      : `Показати всі (${communityResults.length})`;
    searchCommunityShowAllBtn.onclick = () => {
      searchCommunityShowAll = !searchCommunityShowAll;
      displayRecipes(recipes, true);
    };
  }

  // Empty state якщо нічого не знайдено
  if (ownResults.length === 0 && communityResults.length === 0) {
    if (sectionSearchCommunity) sectionSearchCommunity.hidden = false;
    if (searchCommunityGrid) {
      searchCommunityGrid.innerHTML = `
        <div class="recipe-empty-state">
          <div class="recipe-empty-state__icon">${iconSearch}</div>
          <p class="recipe-empty-state__title">Нічого не знайдено</p>
          <p class="recipe-empty-state__text">Спробуйте інший запит або змініть фільтр</p>
        </div>`;
    }
  }
}

// =============================================================
// 4.1 ОБРОБКА КЛІКУ НА СЕРДЕЧКО
// =============================================================

async function handleFavoriteClick(btn, recipeId) {
  if (!currentUser) {
    showToast('Увійдіть, щоб зберігати рецепти', 'error');
    return;
  }

  btn.classList.add('is-saving');

  const isSaved = btn.classList.contains('recipe-card__favorite--saved');

  if (isSaved) {
    openBookSelector(recipeId, async () => {
      const stillSaved = await isRecipeSaved(recipeId);
      btn.classList.toggle('recipe-card__favorite--saved', stillSaved);
    });
  } else {
    const success = await quickSaveToDefault(recipeId);
    if (success) {
      btn.classList.add('recipe-card__favorite--saved');
    }
  }

  btn.classList.remove('is-saving');
}

// =============================================================
// 5. ПЕРЕГЛЯД РЕЦЕПТУ
// =============================================================

// Розкладає рядок інгредієнта (як написала людина) на назву + міру для
// показу "назва зліва / міра справа". Міру визначає парсер (надійно ловить
// число+одиницю за будь-якого розділювача), але назву беремо з оригіналу,
// щоб зберегти регістр і написання ("Молоко 3.2%", а не "молоко 3.2%").
// Якщо парсер не знайшов кількості ("сіль за смаком") — міри немає, весь
// рядок іде зліва.
function splitIngredientLine(line) {
  const parsed = parseFoodInput(line) || {};
  const parsedName = (parsed.name || '').trim();
  const hasMeasure = parsedName && parsedName.length < line.length;

  if (!hasMeasure) {
    return { name: line, measure: '' };
  }

  // parsed.name у нижньому регістрі — відновлюємо оригінальний регістр,
  // знайшовши цю підстроку в оригіналі ("молоко 3.2%" → "Молоко 3.2%").
  const idx = line.toLowerCase().indexOf(parsedName);
  const name = idx >= 0 ? line.substr(idx, parsedName.length) : parsedName;

  return {
    name,
    measure: formatAmount(parsed.amount, parsed.unit),
  };
}

export async function openRecipeView(recipeId) {
  if (!currentUser) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    currentUser = user;
  }

  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .single();

  if (error || !recipe) {
    console.error('Помилка завантаження рецепту:', error);
    return;
  }

  currentViewingId = recipeId;

  const name = getRecipeName(recipe);
  const isOwn = isOwnRecipe(recipe);

  const setT = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '0';
  };

  setT('view-title', name);
  setT('view-calories', formatRecipeMacroValue(recipe.kcal, 0));
  setT('view-category', getCategoryLabel(recipe.category));
  setT('view-proteins', formatRecipeMacroValue(recipe.protein, 0));
  setT('view-carbs', formatRecipeMacroValue(recipe.carbs, 0));
  setT('view-fats', formatRecipeMacroValue(recipe.fat, 0));
  setT(
    'view-total-weight',
    recipe.total_weight ? `Вага готової страви: ${formatRecipeMacroValue(recipe.total_weight, 0)} г` : 'Вага готової страви не вказана',
  );
  setT('view-nutrition-note', getRecipeNutritionNote(recipe));

  // Клік по вазі готової страви відкриває редагування (лише для власних рецептів),
  // щоб людина могла дозаповнити/змінити вагу.
  const totalWeightEl = document.getElementById('view-total-weight');
  if (totalWeightEl) {
    totalWeightEl.classList.toggle('is-editable', isOwn);
    if (isOwn) {
      totalWeightEl.onclick = () => editRecipe(recipe);
    } else {
      totalWeightEl.onclick = null;
    }
  }

  updateStarsUI(recipe.rating || 0);

  const notesField = document.getElementById('view-notes');
  if (notesField) notesField.value = recipe.notes || '';

  // --- ІНГРЕДІЄНТИ ---
  const list = document.getElementById('view-ingredients-list');
  if (list) {
    list.innerHTML = '';

    // Показуємо текст автора як є, але розкладаємо назву зліва / міру справа.
    // parseFoodInput надійно витягує число+одиницю незалежно від розділювача
    // ("молоко 1 л", "молоко — 1 л", "300 г борошна").
    if (recipe.ingredients) {
      const ingLines = recipe.ingredients.split('\n').filter((l) => l.trim().length > 0);
      ingLines.forEach((line) => {
        const { name, measure } = splitIngredientLine(line.trim());

        const li = document.createElement('li');
        li.className = 'ingredient-item-row';
        li.innerHTML = measure
          ? `<span>• ${name}</span> <span class="ing-count">${measure}</span>`
          : `<span>• ${name}</span>`;
        list.appendChild(li);
      });
    } else {
      // Fallback: product_recipe (для старих рецептів без текстового поля)
      const { data: productRecipes } = await supabase
        .from('product_recipe')
        .select(
          `
        amount, unit, ingredient_id,
        products!product_recipe_ingredient_id_fkey (name_ua, name_en, name_pl)
      `,
        )
        .eq('recipe_id', recipeId);

      if (productRecipes && productRecipes.length > 0) {
        const lang = getLang();
        productRecipes.forEach((pr) => {
          const productName =
            lang === 'pl'
              ? pr.products?.name_pl
              : lang === 'en'
                ? pr.products?.name_en
                : pr.products?.name_ua;
          const li = document.createElement('li');
          li.className = 'ingredient-item-row';
          li.innerHTML = `<span>• ${productName || ''}</span> <span class="ing-count">${pr.amount || ''} ${pr.unit || ''}</span>`;
          list.appendChild(li);
        });
      }
    }
  }

  // --- КРОКИ ПРИГОТУВАННЯ ---
  const stepsContainer = document.getElementById('view-steps');
  if (stepsContainer) {
    stepsContainer.innerHTML = '';

    const stepLines = (recipe.steps || '')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => /[a-zA-Zа-яА-ЯіїєґІЇЄҐ0-9]/.test(s));

    stepLines.forEach((text, i) => {
      const cleanText = text.replace(/^\d+[\s.)-]*\s*/, '');
      const stepDiv = document.createElement('div');
      stepDiv.className = 'step-item';
      stepDiv.innerHTML = `
        <span class="step-num">${i + 1}</span>
        <p>${cleanText}</p>
      `;
      stepsContainer.appendChild(stepDiv);
    });
  }

  updateRecipeViewActions(recipe, isOwn);

  if (viewModal) {
    viewModal.classList.add('is-active');
    lockScroll('recipe-view-modal');
  }
}

// =============================================================
// 5.1 ПАНЕЛЬ ДІЙ В ПЕРЕГЛЯДІ РЕЦЕПТУ (меню 3 крапки)
// =============================================================

function updateRecipeViewActions(recipe, isOwn) {
  const actionsContainer = document.querySelector('.recipe-view__actions');
  if (!actionsContainer) return;

  const name = getRecipeName(recipe);

  actionsContainer.innerHTML = `
    <div class="recipe-actions-menu">
      <button class="recipe-actions-menu__trigger" aria-label="Дії з рецептом">
        ${iconMoreVertical}
      </button>
      
      <div class="recipe-actions-menu__dropdown" id="recipe-actions-dropdown">
        ${
          isOwn
            ? `
          <button class="recipe-actions-menu__item" id="action-edit">
            ${iconEdit}
            <span>Редагувати</span>
          </button>
        `
            : ''
        }
        
        <button class="recipe-actions-menu__item" id="action-save-to-book">
          ${iconBookmark}
          <span>Зберегти в книгу</span>
        </button>
        
        ${
          isOwn
            ? `
          <div class="recipe-actions-menu__divider"></div>
          <button class="recipe-actions-menu__item recipe-actions-menu__item--danger" id="action-delete">
            ${iconTrash}
            <span>Видалити</span>
          </button>
        `
            : `
          <div class="recipe-actions-menu__divider"></div>
          <button class="recipe-actions-menu__item recipe-actions-menu__item--warning" id="action-report">
            ${iconFlag}
            <span>Поскаржитись</span>
          </button>
        `
        }
      </div>
    </div>
  `;

  const trigger = actionsContainer.querySelector('.recipe-actions-menu__trigger');
  const dropdown = actionsContainer.querySelector('#recipe-actions-dropdown');

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('is-open');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.recipe-actions-menu')) {
      dropdown?.classList.remove('is-open');
    }
  });

  actionsContainer.querySelector('#action-edit')?.addEventListener('click', () => {
    dropdown.classList.remove('is-open');
    editRecipe(recipe);
  });

  actionsContainer.querySelector('#action-save-to-book')?.addEventListener('click', () => {
    dropdown.classList.remove('is-open');
    if (!currentUser) {
      showToast('Увійдіть, щоб зберігати рецепти', 'error');
      return;
    }
    openBookSelector(recipe.id);
  });

  actionsContainer.querySelector('#action-delete')?.addEventListener('click', () => {
    dropdown.classList.remove('is-open');
    openDeleteConfirm(recipe.id);
  });

  actionsContainer.querySelector('#action-report')?.addEventListener('click', () => {
    dropdown.classList.remove('is-open');
    openReportModal(recipe.id, name);
  });
}

// =============================================================
// 5.2 РЕДАГУВАННЯ РЕЦЕПТУ
// =============================================================

function editRecipe(recipe) {
  if (!isOwnRecipe(recipe)) {
    showToast('Редагувати можна лише власні рецепти', 'error');
    return;
  }

  if (viewModal) {
    viewModal.classList.remove('is-active');
    unlockScroll('recipe-view-modal');
  }

  openRecipeModalForEdit(recipe, async () => {
    await loadAndDisplayRecipes(true);
  });
}

// =============================================================
// 6. ВИДАЛЕННЯ
// =============================================================

function openDeleteConfirm(recipeId) {
  showConfirmModal({
    title: 'Видалити рецепт?',
    message: 'Цю дію неможливо буде скасувати.',
    confirmText: 'Так, видалити',
    onConfirm: async () => {
      const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
      if (error) {
        console.error('Помилка видалення:', error);
        showToast('Помилка видалення', 'error');
      } else {
        showToast('Рецепт видалено', 'info');
        if (viewModal) {
          viewModal.classList.remove('is-active');
          unlockScroll('recipe-view-modal');
        }
        loadAndDisplayRecipes(true);
      }
    },
  });
}

// Зробити приватний рецепт публічним → відправити на модерацію.
// Дзеркалить валідацію публікації з recipe-modal.js (назва + інгредієнти/кроки).
function openMakePublicConfirm(recipe) {
  const hasIngredients = !!(recipe.ingredients && recipe.ingredients.trim());
  const hasSteps = !!(recipe.steps && recipe.steps.trim());

  if (!recipe.name_ua || !recipe.name_ua.trim()) {
    showToast('Для публікації потрібна назва рецепту', 'error');
    return;
  }
  if (!hasIngredients && !hasSteps) {
    showToast('Додайте інгредієнти або кроки приготування', 'error');
    return;
  }

  showConfirmModal({
    title: 'Зробити публічним?',
    message: 'Рецепт побачить спільнота. Він пройде модерацію перед публікацією.',
    confirmText: 'Так, опублікувати',
    onConfirm: async () => {
      // Shadow banned юзери — теж pending (як при створенні)
      const { error } = await supabase
        .from('recipes')
        .update({ is_public: true, status: 'pending' })
        .eq('id', recipe.id);

      if (error) {
        console.error('Помилка публікації:', error);
        showToast('Помилка публікації', 'error');
      } else {
        showToast('Рецепт відправлено на модерацію', 'info');
        loadAndDisplayRecipes(true);
      }
    },
  });
}

// =============================================================
// 7. МОДАЛЬНЕ ВІКНО — ВІДКРИТТЯ/ЗАКРИТТЯ
// =============================================================

const closeViewModal = () => {
  if (viewModal) {
    viewModal.classList.remove('is-active');
    unlockScroll('recipe-view-modal');
    currentViewingId = null;

    const from = new URLSearchParams(window.location.search).get('from');
    if (from) {
      history.back();
    }
  }
};

// =============================================================
// 14. ПОШУК ТА ФІЛЬТРАЦІЯ
// =============================================================

const searchInput = document.getElementById('recipe-search-input');
const searchModeBtn = document.getElementById('search-mode-btn');
const clearSearchBtn = document.getElementById('clear-search-btn');

if (searchModeBtn) searchModeBtn.innerHTML = iconSearch;

async function filterRecipes(query) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Будуємо запит з одним .or() для статусу — так само як applyRecipeFilters.
  // Текстовий пошук робимо клієнтськи, щоб уникнути проблеми з двома .or() у Supabase JS,
  // де другий виклик може перезаписати перший замість AND.
  let dbQuery = supabase.from('recipes').select('*');

  if (user) {
    dbQuery = dbQuery.or(`status.eq.published,user_id.eq.${user.id}`);
  } else {
    dbQuery = dbQuery.eq('status', 'published');
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error('Помилка пошуку:', error);
    return;
  }

  // Клієнтський текстовий фільтр
  const q = query.toLowerCase();
  const filtered = (data || []).filter((r) =>
    (r.name_ua   || '').toLowerCase().includes(q) ||
    (r.name_en   || '').toLowerCase().includes(q) ||
    (r.name_pl   || '').toLowerCase().includes(q) ||
    (r.ingredients || '').toLowerCase().includes(q)
  );

  searchOwnShowAll = false;
  searchCommunityShowAll = false;
  displayRecipes(filtered, true);
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (clearSearchBtn) clearSearchBtn.style.display = query.length > 0 ? 'flex' : 'none';

    if (query.length > 0) {
      if (searchModeBtn) {
        searchModeBtn.innerHTML = iconGlobal;
        searchModeBtn.classList.add('is-active');
      }
      filterRecipes(query);
    } else {
      if (searchModeBtn) {
        searchModeBtn.innerHTML = iconSearch;
        searchModeBtn.classList.remove('is-active');
      }
      loadAndDisplayRecipes();
    }
  });
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    if (searchModeBtn) {
      searchModeBtn.innerHTML = iconSearch;
      searchModeBtn.classList.remove('is-active');
    }
    loadAndDisplayRecipes();
    searchInput.focus();
  });
}

// =============================================================
// 15. СЛУХАЧІ ПОДІЙ ТА ІНІЦІАЛІЗАЦІЯ
// =============================================================

// =============================================================
// 14.5 DRAWER "НОВІ РЕЦЕПТИ"
// =============================================================

function formatTimeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} хв тому`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} год тому`;
  return `${Math.floor(diffH / 24)} дн тому`;
}

async function loadNewRecipes() {
  const body = document.getElementById('new-recipes-body');
  if (!body) return;

  showLoading(body);

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from('recipes')
    .select('*')
    .gte('created_at', since24h)
    .order('created_at', { ascending: false });

  if (user) {
    query = query.or(`status.eq.published,user_id.eq.${user.id}`);
  } else {
    query = query.eq('status', 'published');
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    body.innerHTML =
      '<p class="new-recipes-drawer__empty">Нових рецептів за останні 24 години немає</p>';
    return;
  }

  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  const fresh = data.filter((r) => now - new Date(r.created_at).getTime() < TWO_HOURS);
  const today = data.filter((r) => now - new Date(r.created_at).getTime() >= TWO_HOURS);

  // Власний рецепт першим у fresh-групі
  fresh.sort((a, b) => {
    if (user) {
      if (a.user_id === user.id && b.user_id !== user.id) return -1;
      if (b.user_id === user.id && a.user_id !== user.id) return 1;
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  // Сортування решти за рейтингом
  today.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  body.innerHTML = '';

  function renderGroup(label, items) {
    if (items.length === 0) return;

    const group = document.createElement('div');
    group.className = 'new-recipes-group';
    group.innerHTML = `<div class="new-recipes-group__label">${label}</div>`;

    items.forEach((recipe) => {
      const isOwn = user && recipe.user_id === user.id;
      const name = getRecipeName(recipe);
      const rating = recipe.rating || 0;

      const item = document.createElement('div');
      item.className = `new-recipe-item${isOwn ? ' new-recipe-item--own' : ''}`;
      item.innerHTML = `
        <div class="new-recipe-item__info">
          <div class="new-recipe-item__name">${name}${isOwn ? ' <span style="font-size:11px;opacity:.7;">(Мій)</span>' : ''}</div>
          <div class="new-recipe-item__meta">
            <span>${recipe.category ? getCategoryLabel(recipe.category) : ''}</span>
            <span>·</span>
            <span>${formatTimeAgo(recipe.created_at)}</span>
          </div>
        </div>
        ${rating > 0 ? `<div class="new-recipe-item__rating"><span>${iconStarFilled}</span>${rating.toFixed(1)}</div>` : ''}
      `;

      item.addEventListener('click', () => {
        closeNewRecipesDrawer();
        openRecipeView(recipe.id);
      });

      group.appendChild(item);
    });

    body.appendChild(group);
  }

  renderGroup('Щойно (до 2 год)', fresh);
  renderGroup('Сьогодні', today);
}

function openNewRecipesDrawer() {
  const drawer = document.getElementById('new-recipes-drawer');
  if (!drawer) return;
  const panel = drawer.querySelector('.new-recipes-drawer__panel');
  drawer.classList.add('is-open');
  panel?.removeAttribute('inert');
  lockScroll('new-recipes-drawer');
  loadNewRecipes();
}

function closeNewRecipesDrawer() {
  const drawer = document.getElementById('new-recipes-drawer');
  if (!drawer) return;
  const panel = drawer.querySelector('.new-recipes-drawer__panel');
  drawer.classList.remove('is-open');
  panel?.setAttribute('inert', '');
  unlockScroll('new-recipes-drawer');
}

document.addEventListener('DOMContentLoaded', async () => {
  await initAuth(async (event) => {
    // Після логіну перебудовуємо фільтри та рецепти з контекстом юзера
    if (event === 'SIGNED_IN') {
      buildFilterPanel();
      loadAndDisplayRecipes();
    }
    // Після логауту також оновлюємо
    if (event === 'SIGNED_OUT') {
      buildFilterPanel();
      loadAndDisplayRecipes();
    }
  });
  await initBookSelector();
  await initRecipeModal();
  buildFilterPanel();
  initOwnFilter();
  loadAndDisplayRecipes();

  // Закриваємо підфільтри при кліку поза панеллю
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#recipe-filters-panel')) {
      document.querySelectorAll('#recipe-filters-panel .subfilter-group').forEach((g) => g.classList.remove('active'));
      document.querySelectorAll('#recipe-filters-panel .product-filters__item').forEach((b) => b.classList.remove('is-active'));
      _activeFilterTab = null;
    }
  });

  // Drawer "Нові рецепти"
  document.getElementById('btn-new-recipes')?.addEventListener('click', openNewRecipesDrawer);
  document.getElementById('new-recipes-close')?.addEventListener('click', closeNewRecipesDrawer);
  document.getElementById('new-recipes-backdrop')?.addEventListener('click', closeNewRecipesDrawer);

  const recipeParam = new URLSearchParams(window.location.search).get('recipe');
  if (recipeParam) {
    await openRecipeView(recipeParam);
  }

  const ratingContainer = document.querySelector('.recipe-rating');
  if (ratingContainer) {
    ratingContainer.addEventListener('click', async (e) => {
      if (e.target.classList.contains('star')) {
        const newRating = Number(e.target.dataset.value);

        if (currentViewingId !== null) {
          const { error } = await supabase
            .from('recipes')
            .update({ rating: newRating })
            .eq('id', currentViewingId);

          if (!error) {
            updateStarsUI(newRating);
            loadAndDisplayRecipes(true);
            showToast('Оцінку збережено!');
          }
        }
      }
    });
  }
});

if (addBtn) {
  addBtn.addEventListener('click', () => {
    openRecipeModal(async () => {
      await loadAndDisplayRecipes(true);
    });
  });
}

if (closeViewModalBtn) closeViewModalBtn.addEventListener('click', closeViewModal);
if (closeViewBtn) closeViewBtn.addEventListener('click', closeViewModal);

if (saveNotesBtn) {
  saveNotesBtn.addEventListener('click', async () => {
    const notesValue = document.getElementById('view-notes')?.value;
    if (currentViewingId !== null) {
      const { error } = await supabase
        .from('recipes')
        .update({ notes: notesValue })
        .eq('id', currentViewingId);

      if (!error) showToast('Нотатку збережено!');
    }
  });
}


window.addEventListener('click', (e) => {
  if (e.target === viewModal) closeViewModal();
});
