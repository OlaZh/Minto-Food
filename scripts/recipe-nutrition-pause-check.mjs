// Actual recipe form + ingredient modules, minimal DOM and mocked services.
// Not a browser/live database test. No network calls or production writes.
// Run: node --experimental-vm-modules --no-warnings --test scripts/recipe-nutrition-pause-check.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function harness(local = new Map()) {
  const elements = new Map();
  const requests = [];
  const forbiddenCalls = [];
  const stored = new Map();
  const session = new Map();
  let user = { id: 'qa-owner' };
  class Element {
    constructor(id = '') {
      this.id = id;
      this.value = '';
      this.dataset = {};
      this.style = {};
      this.files = [];
      this.listeners = new Map();
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    set innerHTML(html) {
      this.html = html;
      for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
        const el = new Element(match[1]);
        el.disabled = /\sdisabled(?:\s|>)/.test(match[0]);
        el.hidden = /\shidden(?:\s|>)/.test(match[0]);
        el.readOnly = /\sreadonly(?:\s|>)/.test(match[0]);
        elements.set(el.id, el);
      }
    }
    get innerHTML() { return this.html || ''; }
    appendChild() {}
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    querySelector(selector) {
      if (selector === '.btn-save') return new Element();
      return null;
    }
    querySelectorAll() { return []; }
    reset() { for (const el of elements.values()) el.value = ''; }
    setCustomValidity(message) { this.validationMessage = message; }
    reportValidity() { return !this.validationMessage; }
    async dispatch(type, event = {}) { return this.listeners.get(type)?.({ preventDefault() {}, ...event }); }
    async click() { if (!this.disabled) return this.dispatch('click'); }
  }
  const document = {
    body: new Element(),
    createElement: () => new Element(),
    getElementById: id => elements.get(id) || null,
    querySelector: selector => elements.get(selector.replace(/^#/, '')) || null,
    querySelectorAll: () => [],
  };
  const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, val) => map.set(key, val), removeItem: key => map.delete(key) });
  const context = vm.createContext({
    console, document,
    localStorage: storage(local), sessionStorage: storage(session),
    fetch: async (url, options) => {
      assert.equal(url, '/api/save-recipe');
      const body = JSON.parse(options.body);
      requests.push(body);
      const id = body.editingRecipeId ?? 100;
      const recipe = { id, user_id: user.id, status: 'draft', ...stored.get(id), ...body.recipe };
      stored.set(id, recipe);
      return { ok: true, json: async () => ({ recipe }) };
    },
  });
  const blocked = name => () => { forbiddenCalls.push(name); throw new Error(`Unexpected calculation/service call: ${name}`); };
  const empty = () => {};
  const services = {
    './recipe-media.js': {
      createRecipeMediaEditor: () => ({ reset: empty, load: async () => {}, save: async () => {}, snapshot: () => [], restore: empty }),
      saveMediaDraft: async () => {}, loadMediaDraft: async () => [], clearMediaDraft: async () => {}, mediaText: key => key,
    },
    './supabaseClient.js': { supabase: {
      auth: { getUser: async () => ({ data: { user } }), getSession: async () => ({ data: { session: { access_token: 'qa-only' } } }) },
      from: blocked('supabase.from'), rpc: blocked('supabase.rpc'),
    } },
    './parse-food.js': Object.fromEntries(['parseIngredientsText', 'findProductMatch', 'findAllMatches', 'resolveScannedProduct', 'isDirectUnit', 'learnAlias'].map(key => [key, blocked(key)])),
    './icons.js': Object.fromEntries(['iconCheck', 'iconClose', 'iconScan', 'iconBarcode', 'iconCamera', 'iconLock', 'iconGlobe', 'iconBookOpen'].map(key => [key, ''])),
    './barcode-scanner.js': { scanBarcode: blocked('scanBarcode') },
    './utils.js': { escapeHTML: String, showToast: empty, toBase64: blocked('toBase64'), setInputVal: (id, val) => { document.getElementById(id).value = val || ''; }, withButtonLoading: async (_, action) => action() },
    './auth.js': { requireAuth: empty },
    './storage.js': { getLang: () => 'ua' },
    './i18n-apply.js': { t: key => key, formatText: key => key },
    './scroll-lock.js': { lockScroll: empty, unlockScroll: empty },
    './book-selector.js': {
      initBookSelector: empty, createInlineBookSelector: empty, getRecipeBooks: async () => [], getSelectedBooksFromContainer: () => [],
      saveRecipeToBooks: async () => true, saveRecipeToBook: async () => true,
      ensureDefaultBook: async () => ({ id: 1, name: 'QA' }), getBookName: () => 'QA', refreshBooks: empty,
    },
    './ui-components.js': { initCustomSelect: empty, setSelectValue: (_, id, value) => { document.getElementById(id).value = value; }, initSelectsGlobalListener: empty },
    './analytics.js': { track: empty },
  };
  const modules = new Map();
  for (const [id, exports] of Object.entries(services)) {
    modules.set(id, new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context, identifier: id }));
  }
  const link = async id => {
    if (!modules.has(id)) throw new Error(`Unmocked import ${id}`);
    return modules.get(id);
  };
  for (const name of ['recipe-ingredients', 'recipe-modal']) {
    const source = await readFile(new URL(`../js/${name}.js`, import.meta.url), 'utf8');
    const mod = new vm.SourceTextModule(source, {
      context, identifier: `./${name}.js`,
      importModuleDynamically: async id => {
        const dynamic = await link(id);
        if (dynamic.status === 'unlinked') await dynamic.link(link);
        if (dynamic.status === 'linked') await dynamic.evaluate();
        return dynamic;
      },
    });
    modules.set(`./${name}.js`, mod);
    await mod.link(link);
    await mod.evaluate();
  }
  const form = modules.get('./recipe-modal.js').namespace;
  const ingredients = modules.get('./recipe-ingredients.js').namespace;
  await form.initRecipeModal();
  return { form, ingredients, elements, requests, forbiddenCalls, stored, session, setUser: value => { user = value; } };
}

test('paused builder restores/preserves raw text and cannot start parsing, scans or product requests', async () => {
  const local = new Map();
  const h = await harness(local);
  assert.equal(h.elements.get('rm-macros-note').hidden, true);
  await h.form.openRecipeModal();
  assert.equal(h.elements.get('rm-macros-note').hidden, false);
  const text = 'борошно — 200 г\nперець на смак\nневідомий продукт';
  await h.ingredients.setIngredientsFromText(text);
  assert.equal(h.ingredients.getIngredientsText(), text);
  assert.equal(h.elements.get('rm-macros-note').hidden, false);
  assert.equal(h.elements.get('ingredientList').hidden, true);
  assert.equal(h.elements.get('ingredientList').innerHTML, '');
  assert.equal(h.elements.get('parseIngredientsBtn').disabled, true);
  assert.equal(h.elements.get('scanIngredientBtn').disabled, true);
  assert.equal(h.elements.get('ingredientTotal').hidden, true);
  // Force handlers too: guards must work independently of the disabled markup.
  await h.elements.get('parseIngredientsBtn').dispatch('click');
  await h.elements.get('scanIngredientBtn').dispatch('click');
  await h.elements.get('ingredientTextarea').dispatch('keydown', { key: 'Enter', ctrlKey: true });
  assert.deepEqual(h.forbiddenCalls, []);
  assert.equal(h.ingredients.getIngredientsText(), text);
  for (const lang of ['ua', 'pl', 'en']) {
    h.ingredients.setLanguage(lang);
    assert.equal(h.elements.get('parseIngredientsBtn').disabled, true);
    assert.equal(h.elements.has('ingredientCalculationNotice'), false);
  }
  h.form.closeRecipeModal();
  await h.form.openRecipeModal();
  assert.equal(h.elements.get('rm-macros-note').hidden, true);
  assert.equal(h.elements.get('rm-macros-note').textContent, '');
  const reloaded = await harness(local);
  await reloaded.form.openRecipeModal();
  assert.equal(reloaded.elements.get('rm-macros-note').hidden, true);
});

test('new recipe submits raw text without calculated zeros or product writes', async () => {
  const h = await harness();
  await h.form.openRecipeModal();
  h.elements.get('rm-name').value = 'QA raw recipe';
  h.elements.get('rm-steps').value = 'Змішати';
  h.elements.get('ingredientTextarea').value = 'сіль на смак\nщо є вдома';
  await h.elements.get('ingredientTextarea').dispatch('input');
  assert.equal(h.elements.get('rm-calories').value, '');
  await h.elements.get('recipe-modal-form').dispatch('submit');
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].recipe.ingredients, 'сіль на смак\nщо є вдома');
  for (const key of ['kcal', 'protein', 'fat', 'carbs', 'fiber']) assert.equal(key in h.requests[0].recipe, false);
  assert.deepEqual(h.forbiddenCalls, []);
});

test('editing text/weight retains stored nutrition and does not delete product associations', async () => {
  const h = await harness();
  const original = { id: 42, user_id: 'qa-owner', name_ua: 'Existing', ingredients: 'Раніше', steps: '', kcal: 125, protein: 0, fat: 5, carbs: 20, fiber: 2, total_weight: 800, status: 'draft' };
  h.stored.set(42, original);
  await h.form.openRecipeModalForEdit(original);
  h.elements.get('ingredientTextarea').value = 'Новий довільний текст';
  await h.elements.get('ingredientTextarea').dispatch('input');
  h.elements.get('rm-total-weight').value = '900';
  await h.elements.get('rm-total-weight').dispatch('input');
  assert.equal(h.elements.get('rm-calories').value, 125);
  assert.equal(h.elements.get('rm-proteins').value, 0);
  assert.equal(h.elements.get('rm-macros-note').textContent, 'rmNutritionManual');
  await h.elements.get('recipe-modal-form').dispatch('submit');
  assert.equal(h.requests[0].editingRecipeId, 42);
  assert.equal(h.stored.get(42).ingredients, 'Новий довільний текст');
  for (const key of ['kcal', 'protein', 'fat', 'carbs', 'fiber']) assert.equal(h.stored.get(42)[key], original[key]);
  assert.deepEqual(h.forbiddenCalls, []);
});

test('guest draft restoration preserves ingredients without running recognition', async () => {
  const h = await harness();
  await h.form.openRecipeModal();
  h.setUser(null);
  h.elements.get('rm-name').value = 'Draft';
  h.elements.get('ingredientTextarea').value = 'довільний список\nбез кількостей';
  h.elements.get('rm-calories').value = '154,5';
  h.elements.get('rm-proteins').value = '12.25';
  await h.elements.get('recipe-modal-form').dispatch('submit');
  assert.equal(h.requests.length, 0);
  assert.equal(JSON.parse(h.session.get('mintofood:pending-recipe')).ingredients, 'довільний список\nбез кількостей');
  h.setUser({ id: 'qa-owner' });
  await h.form.initRecipeModal();
  assert.equal(h.ingredients.getIngredientsText(), 'довільний список\nбез кількостей');
  assert.equal(h.elements.get('rm-name').value, 'Draft');
  assert.equal(h.elements.get('rm-calories').value, '154,5');
  assert.equal(h.elements.get('rm-proteins').value, '12.25');
  assert.deepEqual(h.forbiddenCalls, []);
});

test('manual values per 100 g survive ingredient/weight changes, save and reopening without scaling', async () => {
  const h = await harness();
  await h.form.openRecipeModal();
  const values = { 'rm-calories': '154,5', 'rm-proteins': '12.25', 'rm-fats': '0', 'rm-carbs': '17,123' };
  for (const [id, value] of Object.entries(values)) {
    assert.equal(h.elements.get(id).readOnly, false);
    h.elements.get(id).value = value;
    await h.elements.get(id).dispatch('input');
  }
  h.elements.get('rm-name').value = 'Manual';
  h.elements.get('rm-total-weight').value = '850';
  await h.elements.get('rm-total-weight').dispatch('input');
  await h.ingredients.setIngredientsFromText('Будь-який текст');
  for (const [id, value] of Object.entries(values)) assert.equal(h.elements.get(id).value, value);
  await h.elements.get('recipe-modal-form').dispatch('submit');
  const payload = h.requests[0].recipe;
  assert.equal(payload.kcal, 154.5);
  assert.equal(payload.protein, 12.25);
  assert.equal(payload.fat, 0);
  assert.equal(payload.carbs, 17.123);
  assert.equal(payload.total_weight, 850);
  assert.equal('fiber' in payload, false);
  await h.form.openRecipeModalForEdit(h.stored.get(100));
  assert.equal(h.elements.get('rm-calories').value, 154.5);
  assert.equal(h.elements.get('rm-fats').value, 0);
  h.elements.get('rm-calories').value = '180';
  await h.elements.get('recipe-modal-form').dispatch('submit');
  assert.equal(h.stored.get(100).kcal, 180);
  assert.equal(h.stored.get(100).protein, 12.25);
  assert.deepEqual(h.forbiddenCalls, []);
  await h.form.openRecipeModal();
  assert.equal(h.elements.get('rm-calories').value, '');
});

test('invalid manual values never submit; correcting the input allows saving', async () => {
  const h = await harness();
  await h.form.openRecipeModal();
  h.elements.get('rm-name').value = 'Numbers';
  const input = h.elements.get('rm-calories');
  for (const value of ['-1', 'NaN', 'Infinity', '12 kcal', '1,2,3', '0x10', '9'.repeat(400)]) {
    input.value = value;
    await h.elements.get('recipe-modal-form').dispatch('submit');
    assert.equal(h.requests.length, 0, value);
    assert.equal(input.validationMessage, 'rmNutritionInvalid');
  }
  input.value = '0';
  await input.dispatch('input');
  assert.equal(input.validationMessage, '');
  await h.elements.get('recipe-modal-form').dispatch('submit');
  assert.equal(h.requests[0].recipe.kcal, 0);
});

test('blank manual fields keep existing nutrition; partial values need no total dish weight', async () => {
  const h = await harness();
  const original = { id: 42, user_id: 'qa-owner', name_ua: 'Existing', kcal: 125, protein: 10, fat: 5, carbs: 20, fiber: 2, status: 'draft' };
  h.stored.set(42, original);
  await h.form.openRecipeModalForEdit(original);
  h.elements.get('rm-calories').value = '';
  h.elements.get('rm-proteins').value = '13,5';
  await h.elements.get('recipe-modal-form').dispatch('submit');
  assert.equal('kcal' in h.requests[0].recipe, false);
  assert.equal(h.stored.get(42).kcal, 125);
  assert.equal(h.stored.get(42).protein, 13.5);
  assert.equal(h.stored.get(42).fiber, 2);
  assert.equal(h.requests[0].recipe.total_weight, null);
});
