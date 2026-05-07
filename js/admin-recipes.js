// ============================================================
// admin-recipes.js — Секція 2: Нові рецепти (proactive moderation)
// ============================================================

import { supabase } from './supabaseClient.js';
import {
  confirm, confirmWithReason, withUndo, openDrawer, logAction, clearStatsCache,
  formatDate, emptyState, skeletonList,
} from './admin-utils.js';
import { loadStats } from './admin-stats.js';

let _filters = { days: '7', sort: 'date_desc', search: '', lang: '', photo: '', category: '', ingredients: '' };
let _searchTimer = null;

let _activeTab = 'new'; // 'new' | 'updates'

export async function initRecipes() {
  document.getElementById('recipesTabNew')?.addEventListener('click', () => {
    _activeTab = 'new';
    _syncTabs();
    loadRecipes();
  });
  document.getElementById('recipesTabUpdates')?.addEventListener('click', () => {
    _activeTab = 'updates';
    _syncTabs();
    loadPendingUpdates();
  });

  document.getElementById('filterRecipesDays')?.addEventListener('change', (e) => {
    _filters.days = e.target.value; loadRecipes();
  });
  document.getElementById('filterRecipesSort')?.addEventListener('change', (e) => {
    _filters.sort = e.target.value; loadRecipes();
  });
  document.getElementById('filterRecipesLang')?.addEventListener('change', (e) => {
    _filters.lang = e.target.value; loadRecipes();
  });
  document.getElementById('filterRecipesPhoto')?.addEventListener('change', (e) => {
    _filters.photo = e.target.value; loadRecipes();
  });
  document.getElementById('filterRecipesCategory')?.addEventListener('change', (e) => {
    _filters.category = e.target.value; loadRecipes();
  });
  document.getElementById('filterRecipesIngredients')?.addEventListener('change', (e) => {
    _filters.ingredients = e.target.value; loadRecipes();
  });
  document.getElementById('searchRecipes')?.addEventListener('input', (e) => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      _filters.search = e.target.value.trim();
      loadRecipes();
    }, 300);
  });

  _syncTabs();
  await loadRecipes();
}

function _syncTabs() {
  document.getElementById('recipesTabNew')?.classList.toggle('admin-tab--active', _activeTab === 'new');
  document.getElementById('recipesTabUpdates')?.classList.toggle('admin-tab--active', _activeTab === 'updates');
  const filtersRow = document.getElementById('recipesFiltersRow');
  if (filtersRow) filtersRow.style.display = _activeTab === 'new' ? '' : 'none';
}

export async function loadRecipes() {
  const listEl = document.getElementById('recipesList');
  if (!listEl) return;
  listEl.innerHTML = skeletonList(4);

  let query = supabase
    .from('recipes')
    .select('id, name_ua, name_en, image, status, created_at, user_id, kcal, protein, fat, carbs, steps, category, rating')
    .eq('status', 'pending');

  if (_filters.days !== '0') {
    const from = new Date(Date.now() - parseInt(_filters.days) * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', from);
  }

  if (_filters.search) {
    query = query.or(`name_ua.ilike.%${_filters.search}%,name_en.ilike.%${_filters.search}%`);
  }
  if (_filters.lang === 'ua') query = query.not('name_ua', 'is', null);
  if (_filters.lang === 'en') query = query.is('name_ua', null).not('name_en', 'is', null);
  if (_filters.photo === 'yes') query = query.not('image', 'is', null);
  if (_filters.photo === 'no')  query = query.is('image', null);
  if (_filters.category)        query = query.eq('category', _filters.category);

  if (_filters.sort === 'date_asc')    query = query.order('created_at', { ascending: true });
  else if (_filters.sort === 'author') query = query.order('user_id');
  else if (_filters.sort === 'rating') query = query.order('rating', { ascending: false, nullsFirst: false });
  else                                 query = query.order('created_at', { ascending: false });

  // Ingredients filter — resolve IDs before main query
  if (_filters.ingredients === 'yes' || _filters.ingredients === 'no') {
    const { data: prRows } = await supabase
      .from('product_recipe')
      .select('recipe_id');
    const withIngIds = [...new Set((prRows || []).map(r => r.recipe_id))];
    if (_filters.ingredients === 'yes') {
      if (!withIngIds.length) { listEl.innerHTML = emptyState('Нових рецептів не знайдено'); return; }
      query = query.in('id', withIngIds);
    } else {
      if (withIngIds.length) query = query.not('id', 'in', `(${withIngIds.join(',')})`);
    }
  }

  const { data, error } = await query.limit(100);

  if (error) {
    listEl.innerHTML = `<p style="color:var(--color-danger)">Помилка: ${error.message}</p>`;
    return;
  }

  if (!data?.length) {
    listEl.innerHTML = emptyState('Нових рецептів не знайдено');
    return;
  }

  // Batch-завантаження авторів
  const authorIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
  let authorsMap = {};
  if (authorIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, is_banned')
      .in('id', authorIds);
    authorsMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  }

  const enriched = data.map(r => ({ ...r, author: authorsMap[r.user_id] || null }));

  // Auto-flagging
  const authorDayCount = {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  enriched.forEach((r) => {
    if (new Date(r.created_at) >= today) {
      authorDayCount[r.user_id] = (authorDayCount[r.user_id] || 0) + 1;
    }
  });

  listEl.innerHTML = '';
  enriched.forEach((recipe) => {
    const flags = _detectFlags(recipe, authorDayCount);
    listEl.appendChild(_buildRow(recipe, flags));
  });
}

function _detectFlags(recipe, authorDayCount) {
  const flags = [];

  if ((authorDayCount[recipe.user_id] || 0) > 10) {
    flags.push({ key: 'spam', label: '⚠️ >10/день', color: '#ef4444' });
  }

  const allText = [recipe.steps || '', recipe.name_ua || '', recipe.name_en || ''].join(' ');
  if (/https?:\/\/|www\.|t\.me\/|telegram|viber|whatsapp/i.test(allText)) {
    flags.push({ key: 'links', label: '🔗 Посилання', color: '#f59e0b' });
  }

  if (/купити|замовити|знижка|безкоштовно|перейди|click here|subscribe|канал|реклама|прайс/i.test(allText)) {
    flags.push({ key: 'promo', label: '🚨 Реклама', color: '#ef4444' });
  }

  const nameText = (recipe.name_ua || recipe.name_en || '').trim();
  const hasAlpha = /[a-zA-ZА-ЯІЄЇа-яієї]/.test(nameText);
  if (nameText.length >= 5 && hasAlpha && nameText === nameText.toUpperCase() && nameText !== nameText.toLowerCase()) {
    flags.push({ key: 'caps', label: '🔤 КАПСЛОК', color: '#f59e0b' });
  }

  const stepsLen = (recipe.steps || '').replace(/\s+/g, '').length;
  if (stepsLen === 0)       flags.push({ key: 'no_steps',    label: '⚠️ Немає кроків',    color: '#9ca3af' });
  else if (stepsLen < 30)   flags.push({ key: 'short_steps', label: '⚠️ Короткі кроки',   color: '#9ca3af' });

  return flags;
}

function _buildRow(recipe, flags) {
  const row = document.createElement('div');
  const isSpam = flags.some(f => f.key === 'spam' || f.key === 'promo');
  row.className = 'admin-recipe-row' + (isSpam ? ' admin-recipe-row--spam-author' : '');
  row.dataset.id = recipe.id;

  const name   = recipe.name_ua || recipe.name_en || 'Без назви';
  const author = recipe.author;
  const thumb  = recipe.image
    ? `<img class="admin-recipe-row__thumb" src="${recipe.image}" alt="" loading="lazy">`
    : `<div class="admin-recipe-row__thumb"></div>`;

  row.innerHTML = `
    ${thumb}
    <div class="admin-recipe-row__info">
      <div class="admin-recipe-row__name">${name}</div>
      <div class="admin-recipe-row__meta">
        <span class="admin-recipe-row__author">${author?.full_name || '—'}</span>
        ${flags.map(f => `<span style="font-size:11px;color:${f.color};font-weight:600;margin-left:4px">${f.label}</span>`).join('')}
        <span>${formatDate(recipe.created_at)}</span>
        ${recipe.rating > 0 ? `<span>★ ${Number(recipe.rating).toFixed(1)}</span>` : ''}
        ${recipe.status !== 'published' ? `<span style="color:var(--color-text-muted)">(${recipe.status})</span>` : ''}
      </div>
    </div>
    <div class="admin-recipe-row__actions">
      <button class="btn btn--sm btn--ghost" data-action="preview" title="Переглянути">👁</button>
      <button class="btn btn--sm btn--outline" data-action="edit" title="Редагувати">✏</button>
      <button class="btn btn--sm btn--primary" data-action="approve" title="Схвалити та опублікувати">Схвалити</button>
      <button class="btn btn--sm btn--outline" data-action="draft" title="Відхилити (лишається у автора в чернетках)">Відхилити</button>
      <button class="btn btn--sm btn--danger" data-action="delete" title="Видалити назавжди">×</button>
    </div>
  `;

  row.querySelector('.admin-recipe-row__name')?.addEventListener('click', () =>
    _openDrawer(recipe));
  row.querySelector('.admin-recipe-row__thumb')?.addEventListener('click', () =>
    _openDrawer(recipe));
  row.querySelector('[data-action="preview"]')?.addEventListener('click', () =>
    _openDrawer(recipe));
  row.querySelector('[data-action="edit"]')?.addEventListener('click', () =>
    _openEditDrawer(recipe));
  row.querySelector('[data-action="approve"]')?.addEventListener('click', () =>
    _approve(recipe));
  row.querySelector('[data-action="draft"]')?.addEventListener('click', () =>
    _setDraft(recipe));
  row.querySelector('[data-action="delete"]')?.addEventListener('click', () =>
    _delete(recipe));

  return row;
}

async function _approve(recipe) {
  const name = recipe.name_ua || recipe.name_en || 'Без назви';
  const ok = await confirm('Схвалити рецепт', `Рецепт "${name}" буде опубліковано у спільноті.`, 'Схвалити');
  if (!ok) return;
  await supabase.from('recipes').update({ status: 'published' }).eq('id', recipe.id);
  await logAction('recipes', recipe.id, 'approve');
  clearStatsCache();
  await loadStats();
  await loadRecipes();
}

const REJECTION_TEMPLATES = [
  {
    value: 'duplicate',
    adminLabel: 'Схожий рецепт вже є',
    userMessage:
      'Схожий рецепт вже є в загальній базі, тому ми не дублювали його для спільноти 🌿 Ваш рецепт залишився у вашій книзі рецептів',
  },
  {
    value: 'incomplete',
    adminLabel: 'Неповний рецепт',
    userMessage:
      'Схоже, у рецепті ще не вистачає кількох деталей — кроків або інгредієнтів 🌱 Доповніть його і надсилайте знову!',
  },
  {
    value: 'no_photo',
    adminLabel: 'Немає фото',
    userMessage:
      'Рецепти з фото привертають більше уваги спільноти 📸 Якщо додасте фото — рецепт виглядатиме ще апетитніше!',
  },
  {
    value: 'quality',
    adminLabel: 'Потрібно доопрацювати',
    userMessage:
      'Рецепт поки не готовий для спільноти. Якщо додасте більше деталей або фото — надсилайте ще раз, із задоволенням розглянемо 🌱',
  },
  {
    value: 'inappropriate',
    adminLabel: 'Не відповідає правилам',
    userMessage:
      'Цей рецепт не вдалося додати до спільноти через порушення правил платформи. Ваш рецепт залишився у вашій особистій книзі рецептів 🌿',
  },
  {
    value: 'other',
    adminLabel: 'Інше (власний текст)',
    userMessage: '',
  },
];

function _confirmReject(recipeName) {
  return new Promise((resolve) => {
    const options = REJECTION_TEMPLATES.map(t =>
      `<option value="${t.value}">${t.adminLabel}</option>`
    ).join('');

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;inset:0;z-index:1100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)';
    wrapper.innerHTML = `
      <div style="background:var(--color-bg-primary);border-radius:16px;padding:28px;width:440px;max-width:92vw;box-shadow:0 8px 32px rgba(0,0,0,.2)">
        <h3 style="margin:0 0 6px;font-size:1rem">Відхилити рецепт</h3>
        <p style="margin:0 0 16px;font-size:.875rem;color:var(--color-text-secondary)">«${recipeName}» залишиться у автора в чернетках</p>

        <label style="font-size:.8125rem;font-weight:600;display:block;margin-bottom:4px">Причина</label>
        <select id="rejectTemplateSelect" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-surface);color:var(--color-text-primary);font-size:.875rem;margin-bottom:12px">
          ${options}
        </select>

        <label style="font-size:.8125rem;font-weight:600;display:block;margin-bottom:4px">Повідомлення для автора</label>
        <textarea id="rejectUserMessage" rows="3"
          style="width:100%;box-sizing:border-box;padding:8px 12px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-surface);color:var(--color-text-primary);font-size:.875rem;resize:vertical;margin-bottom:20px"></textarea>

        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="rejectCancel" class="btn btn--sm btn--ghost">Скасувати</button>
          <button id="rejectOk" class="btn btn--sm btn--danger">Відхилити</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);

    const select = wrapper.querySelector('#rejectTemplateSelect');
    const textarea = wrapper.querySelector('#rejectUserMessage');

    const fillTemplate = () => {
      const tpl = REJECTION_TEMPLATES.find(t => t.value === select.value);
      textarea.value = tpl?.userMessage || '';
    };
    fillTemplate();
    select.addEventListener('change', fillTemplate);

    const close = (confirmed) => {
      const result = confirmed
        ? { reason: select.value, userMessage: textarea.value.trim() }
        : null;
      wrapper.remove();
      resolve(result);
    };

    wrapper.querySelector('#rejectOk').addEventListener('click', () => close(true));
    wrapper.querySelector('#rejectCancel').addEventListener('click', () => close(false));
    wrapper.addEventListener('click', (e) => { if (e.target === wrapper) close(false); });
  });
}

async function _setDraft(recipe) {
  const name = recipe.name_ua || recipe.name_en || 'Без назви';
  const result = await _confirmReject(name);
  if (!result) return;
  await withUndo(`Рецепт "${name}" відхилено`, async () => {
    await supabase.from('recipes').update({
      status: 'draft',
      moderation_note: result.userMessage || null,
    }).eq('id', recipe.id);
    await logAction('recipes', recipe.id, 'reject', { reason: result.reason, from: 'admin_recipes' });
    clearStatsCache(); await loadStats(); await loadRecipes();
  });
}

async function _delete(recipe) {
  const name = recipe.name_ua || recipe.name_en || 'Без назви';
  const result = await confirmWithReason('Видалити рецепт', `Рецепт "${name}" буде видалено назавжди.`, 'Видалити');
  if (!result) return;
  await withUndo(`Рецепт "${name}" видалено`, async () => {
    await supabase.from('recipes').update({ deleted_at: new Date().toISOString(), status: 'draft' }).eq('id', recipe.id);
    await logAction('recipes', recipe.id, 'soft_delete', { from: 'admin_recipes', ...result });
    clearStatsCache(); await loadStats(); await loadRecipes();
  });
}

async function _openDrawer(recipe) {
  const name  = recipe.name_ua || recipe.name_en || 'Без назви';
  const thumb = recipe.image
    ? `<img src="${recipe.image}" alt="${name}" style="width:100%;border-radius:8px;margin-bottom:16px">`
    : `<div style="width:100%;height:160px;background:var(--color-bg-secondary);border-radius:8px;margin-bottom:16px;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:13px">Без фото</div>`;

  const kcalBlock = (recipe.kcal != null)
    ? `<div style="display:flex;gap:16px;margin:12px 0;padding:10px 14px;background:var(--color-bg-secondary);border-radius:8px;font-size:13px">
        <span><b>${recipe.kcal}</b> ккал</span>
        <span>Б: <b>${recipe.protein ?? '—'}</b>г</span>
        <span>Ж: <b>${recipe.fat ?? '—'}</b>г</span>
        <span>В: <b>${recipe.carbs ?? '—'}</b>г</span>
      </div>`
    : '';

  const { data: ingRows } = await supabase
    .from('product_recipe')
    .select('amount, unit, ingredient:products(name_ua, name_en)')
    .eq('recipe_id', recipe.id);

  let ingredientsBlock = '';
  if (ingRows?.length) {
    const items = ingRows.map(r => {
      const ingName = r.ingredient?.name_ua || r.ingredient?.name_en || '—';
      return `<li style="padding:2px 0">${ingName} — ${r.amount}${r.unit || 'г'}</li>`;
    }).join('');
    ingredientsBlock = `<p style="margin:12px 0 4px"><b>Інгредієнти:</b></p><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">${items}</ul>`;
  }

  const stepsBlock = recipe.steps
    ? `<p style="margin:12px 0 4px"><b>Приготування:</b></p><p style="font-size:13px;line-height:1.7;white-space:pre-wrap">${recipe.steps}</p>`
    : '';

  // Mini-history автора
  let authorHistoryBlock = '';
  if (recipe.user_id) {
    const [{ count: recipeCount }, { count: reportCount }, { data: actionRows }] = await Promise.all([
      supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('user_id', recipe.user_id),
      supabase.from('recipe_reports').select('*', { count: 'exact', head: true }).eq('recipe_id', recipe.id),
      supabase.from('admin_actions').select('created_at').eq('target_id', recipe.user_id).eq('action_type', 'ban').limit(3),
    ]);
    const banHistory = actionRows?.length
      ? `<span style="color:#ef4444">🚫 Банів: ${actionRows.length}</span>`
      : '<span style="color:var(--color-text-muted)">Банів не було</span>';
    authorHistoryBlock = `
      <div style="background:var(--color-bg-secondary);border-radius:8px;padding:10px 14px;margin:10px 0;font-size:12px;display:flex;gap:16px;flex-wrap:wrap">
        <span>📄 Рецептів: <b>${recipeCount ?? '—'}</b></span>
        <span>🚩 Скарг: <b>${reportCount ?? '—'}</b></span>
        ${banHistory}
      </div>`;
  }

  openDrawer(name, `
    ${thumb}
    <a href="recipes.html?recipe=${recipe.id}" target="_blank" class="btn btn--sm btn--ghost" style="margin-bottom:8px;display:inline-flex">👁 Відкрити як користувач</a>
    ${kcalBlock}
    <p style="font-size:12px;color:var(--color-text-muted)">Автор: ${recipe.author?.full_name || '—'} · ${formatDate(recipe.created_at)}${recipe.category ? ` · ${recipe.category}` : ''}</p>
    ${authorHistoryBlock}
    ${ingredientsBlock}
    ${stepsBlock}
  `);
}

const RECIPE_CATEGORIES = [
  ['', '— Без категорії —'], ['breakfast', 'Сніданок'], ['lunch', 'Обід'],
  ['dinner', 'Вечеря'], ['snack', 'Перекус'], ['dessert', 'Десерт'],
  ['drinks', 'Напої'], ['bakery', 'Випічка'], ['fast', 'Швидкі'], ['no_power', 'Без світла'],
];

async function _openEditDrawer(recipe) {
  const name = recipe.name_ua || recipe.name_en || 'Без назви';
  const catOptions = RECIPE_CATEGORIES
    .map(([v, l]) => `<option value="${v}" ${recipe.category === v ? 'selected' : ''}>${l}</option>`)
    .join('');

  const html = `
    <div id="adminRecipeEditForm" style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="font-size:12px;color:var(--color-text-muted);display:block;margin-bottom:4px">Назва (UA)</label>
        <input id="editRecipeNameUa" type="text" class="admin-input" value="${recipe.name_ua || ''}" placeholder="Назва українською">
      </div>
      <div>
        <label style="font-size:12px;color:var(--color-text-muted);display:block;margin-bottom:4px">Назва (EN)</label>
        <input id="editRecipeNameEn" type="text" class="admin-input" value="${recipe.name_en || ''}" placeholder="Name in English">
      </div>
      <div>
        <label style="font-size:12px;color:var(--color-text-muted);display:block;margin-bottom:4px">Категорія</label>
        <select id="editRecipeCategory" class="admin-select" style="width:100%">${catOptions}</select>
      </div>
      <div style="display:flex;gap:8px">
        <div style="flex:1"><label style="font-size:12px;color:var(--color-text-muted);display:block;margin-bottom:4px">Ккал</label>
          <input id="editRecipeKcal" type="number" class="admin-input" value="${recipe.kcal ?? ''}" min="0" max="9999"></div>
        <div style="flex:1"><label style="font-size:12px;color:var(--color-text-muted);display:block;margin-bottom:4px">Б</label>
          <input id="editRecipeProtein" type="number" class="admin-input" value="${recipe.protein ?? ''}" min="0" max="999"></div>
        <div style="flex:1"><label style="font-size:12px;color:var(--color-text-muted);display:block;margin-bottom:4px">Ж</label>
          <input id="editRecipeFat" type="number" class="admin-input" value="${recipe.fat ?? ''}" min="0" max="999"></div>
        <div style="flex:1"><label style="font-size:12px;color:var(--color-text-muted);display:block;margin-bottom:4px">В</label>
          <input id="editRecipeCarbs" type="number" class="admin-input" value="${recipe.carbs ?? ''}" min="0" max="999"></div>
      </div>
      <div id="editRecipeSaveStatus" style="font-size:12px;color:var(--color-text-muted)"></div>
      <button id="editRecipeSaveBtn" class="btn btn--primary">Зберегти</button>
    </div>
  `;

  openDrawer(`Редагування: ${name}`, html);

  document.getElementById('editRecipeSaveBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('editRecipeSaveBtn');
    const status = document.getElementById('editRecipeSaveStatus');
    btn.disabled = true;
    status.textContent = 'Збереження…';

    const payload = {
      name_ua:  document.getElementById('editRecipeNameUa')?.value.trim() || null,
      name_en:  document.getElementById('editRecipeNameEn')?.value.trim() || null,
      category: document.getElementById('editRecipeCategory')?.value || null,
      kcal:     parseFloat(document.getElementById('editRecipeKcal')?.value) || null,
      protein:  parseFloat(document.getElementById('editRecipeProtein')?.value) || null,
      fat:      parseFloat(document.getElementById('editRecipeFat')?.value) || null,
      carbs:    parseFloat(document.getElementById('editRecipeCarbs')?.value) || null,
    };

    const { error } = await supabase.from('recipes').update(payload).eq('id', recipe.id);
    if (error) {
      status.textContent = `Помилка: ${error.message}`;
      btn.disabled = false;
    } else {
      await logAction('recipes', recipe.id, 'edit', payload);
      status.style.color = 'var(--color-success)';
      status.textContent = 'Збережено';
      btn.disabled = false;
      Object.assign(recipe, payload);
      loadRecipes();
    }
  });
}

// ============================================================
// Pending Updates — оновлення опублікованих рецептів
// ============================================================

export async function loadPendingUpdates() {
  const listEl = document.getElementById('recipesList');
  if (!listEl) return;
  listEl.innerHTML = skeletonList(4);

  const { data, error } = await supabase
    .from('recipe_pending_updates')
    .select('id, recipe_id, user_id, changes, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    listEl.innerHTML = `<p style="color:var(--color-danger)">Помилка: ${error.message}</p>`;
    return;
  }

  if (!data?.length) {
    listEl.innerHTML = emptyState('Оновлень на перевірку немає 🌿');
    document.getElementById('recipesTabUpdates')?.querySelector('.admin-tab__badge')?.remove();
    return;
  }

  // Batch: рецепти + автори
  const recipeIds = [...new Set(data.map(u => u.recipe_id))];
  const authorIds = [...new Set(data.map(u => u.user_id).filter(Boolean))];

  const [{ data: recipes }, { data: profiles }] = await Promise.all([
    supabase.from('recipes').select('id, name_ua, name_en, image').in('id', recipeIds),
    supabase.from('profiles').select('id, full_name').in('id', authorIds),
  ]);

  const recipeMap = Object.fromEntries((recipes || []).map(r => [r.id, r]));
  const authorMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  // Оновлюємо badge на вкладці
  const tabBadge = document.getElementById('recipesTabUpdates');
  if (tabBadge) {
    let badge = tabBadge.querySelector('.admin-tab__badge');
    if (!badge) { badge = document.createElement('span'); badge.className = 'admin-tab__badge'; tabBadge.appendChild(badge); }
    badge.textContent = data.length;
  }

  listEl.innerHTML = '';
  data.forEach(update => {
    const recipe = recipeMap[update.recipe_id] || {};
    const author = authorMap[update.user_id] || {};
    listEl.appendChild(_buildUpdateRow(update, recipe, author));
  });
}

function _buildUpdateRow(update, recipe, author) {
  const row = document.createElement('div');
  row.className = 'admin-recipe-row';

  const name = recipe.name_ua || recipe.name_en || 'Рецепт';
  const changes = update.changes || {};
  const changedFields = Object.keys(changes);

  const fieldLabels = { image: '📸 Фото', steps: '📝 Кроки', name_ua: '🔤 Назва' };
  const changesList = changedFields.map(f => fieldLabels[f] || f).join(', ');

  const thumb = changes.image
    ? `<img class="admin-recipe-row__thumb" src="${changes.image}" alt="" loading="lazy">`
    : recipe.image
      ? `<img class="admin-recipe-row__thumb" src="${recipe.image}" alt="" loading="lazy">`
      : `<div class="admin-recipe-row__thumb"></div>`;

  row.innerHTML = `
    ${thumb}
    <div class="admin-recipe-row__info">
      <div class="admin-recipe-row__name">${name}</div>
      <div class="admin-recipe-row__meta">
        <span class="admin-recipe-row__author">${author.full_name || '—'}</span>
        <span style="color:var(--color-accent);font-weight:600">${changesList}</span>
        <span>${formatDate(update.created_at)}</span>
      </div>
    </div>
    <div class="admin-recipe-row__actions">
      <button class="btn btn--sm btn--ghost" data-action="preview-update" title="Переглянути зміни">👁</button>
      <button class="btn btn--sm btn--primary" data-action="approve-update" title="Застосувати зміни">Схвалити</button>
      <button class="btn btn--sm btn--outline" data-action="reject-update" title="Відхилити зміни">Відхилити</button>
    </div>
  `;

  row.querySelector('[data-action="preview-update"]')?.addEventListener('click', () =>
    _previewUpdate(update, recipe, changes));
  row.querySelector('[data-action="approve-update"]')?.addEventListener('click', () =>
    _approveUpdate(update, recipe, changes, row));
  row.querySelector('[data-action="reject-update"]')?.addEventListener('click', () =>
    _rejectUpdate(update, recipe, row));

  return row;
}

function _previewUpdate(update, recipe, changes) {
  const name = recipe.name_ua || recipe.name_en || 'Рецепт';
  const fieldLabels = { image: 'Нове фото', steps: 'Нові кроки приготування', name_ua: 'Нова назва' };

  const diffBlocks = Object.entries(changes).map(([field, newVal]) => {
    const label = fieldLabels[field] || field;
    const oldVal = recipe[field];
    if (field === 'image') {
      return `
        <p style="font-size:12px;font-weight:600;margin:12px 0 4px">${label}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:4px">Зараз</div>
            ${oldVal ? `<img src="${oldVal}" style="width:100%;border-radius:8px">` : '<div style="height:80px;background:var(--color-bg-secondary);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--color-text-muted)">Немає фото</div>'}
          </div>
          <div>
            <div style="font-size:11px;color:#a16207;margin-bottom:4px">Нове</div>
            <img src="${newVal}" style="width:100%;border-radius:8px">
          </div>
        </div>`;
    }
    return `
      <p style="font-size:12px;font-weight:600;margin:12px 0 4px">${label}</p>
      ${oldVal ? `<p style="font-size:12px;color:var(--color-text-muted);background:var(--color-bg-secondary);padding:8px 10px;border-radius:6px;white-space:pre-wrap">${oldVal}</p>` : ''}
      <p style="font-size:12px;background:rgba(166,214,184,.18);border-left:3px solid var(--color-accent);padding:8px 10px;border-radius:0 6px 6px 0;white-space:pre-wrap">${newVal}</p>`;
  }).join('');

  openDrawer(`Зміни: ${name}`, diffBlocks);
}

async function _approveUpdate(update, recipe, changes, row) {
  const name = recipe.name_ua || recipe.name_en || 'Рецепт';
  const ok = await confirm('Застосувати зміни', `Нові значення будуть опубліковані для рецепту «${name}».`, 'Застосувати');
  if (!ok) return;

  await supabase.from('recipes').update({ ...changes, has_pending_update: false }).eq('id', update.recipe_id);
  await supabase.from('recipe_pending_updates').update({ status: 'approved' }).eq('id', update.id);
  await logAction('recipes', update.recipe_id, 'approve_update', { fields: Object.keys(changes) });

  clearStatsCache();
  await loadStats();
  row.remove();
  if (!document.getElementById('recipesList')?.children.length) {
    document.getElementById('recipesList').innerHTML = emptyState('Оновлень на перевірку немає 🌿');
  }
}

async function _rejectUpdate(update, recipe, row) {
  const name = recipe.name_ua || recipe.name_en || 'Рецепт';
  const result = await _confirmReject(name);
  if (!result) return;

  await supabase.from('recipe_pending_updates').update({
    status: 'rejected',
    moderation_note: result.userMessage || null,
  }).eq('id', update.id);

  if (result.userMessage) {
    await supabase.from('recipes').update({
      has_pending_update: false,
      moderation_note: result.userMessage,
    }).eq('id', update.recipe_id);
  } else {
    await supabase.from('recipes').update({ has_pending_update: false }).eq('id', update.recipe_id);
  }

  await logAction('recipes', update.recipe_id, 'reject_update', { reason: result.reason });
  row.remove();
  if (!document.getElementById('recipesList')?.children.length) {
    document.getElementById('recipesList').innerHTML = emptyState('Оновлень на перевірку немає 🌿');
  }
}
