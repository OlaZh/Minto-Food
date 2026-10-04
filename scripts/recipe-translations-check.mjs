import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PGlite } from '../node_modules/.cache/recipe-media-qa/node_modules/@electric-sql/pglite/dist/index.js';
import { getRecipeDisplayIngredients, getRecipeDisplaySteps } from '../js/recipe-utils.js';

const texts = {
  ingredients: 'Для нагетсів:\nКурячий фарш — 700 г\n\nДля подавання:\nСоус — за смаком',
  ingredients_en: 'For the nuggets:\nMinced chicken — 700 g\n\nTo serve:\nSauce — to taste',
  ingredients_pl: 'Na nuggetsy:\nMielone mięso z kurczaka — 700 g\n\nDo podania:\nSos — do smaku',
  steps: '1. Змішайте.\n2. Посмажте.',
  steps_en: '1. Mix.\n2. Fry.',
  steps_pl: '1. Wymieszaj.\n2. Usmaż.',
};

test('language selection preserves complete ingredient and step translations', () => {
  const recipe = structuredClone(texts);
  for (const [lang, suffix] of [['ua', ''], ['uk', ''], ['en', '_en'], ['pl', '_pl']]) {
    assert.equal(getRecipeDisplayIngredients(recipe, lang), texts['ingredients' + suffix]);
    assert.equal(getRecipeDisplaySteps(recipe, lang), texts['steps' + suffix]);
  }
  assert.deepEqual(recipe, texts);
});

test('missing or cleared translations preserve the original-language fallback', () => {
  for (const empty of [undefined, null, '', ' \n\t']) {
    const recipe = { ...texts, ingredients_en: empty, ingredients_pl: empty, steps_en: empty, steps_pl: empty };
    for (const lang of ['en', 'pl']) {
      assert.equal(getRecipeDisplayIngredients(recipe, lang), texts.ingredients);
      assert.equal(getRecipeDisplaySteps(recipe, lang), texts.steps);
    }
  }
  assert.equal(getRecipeDisplayIngredients(null, 'en'), '');
  assert.equal(getRecipeDisplayIngredients({}, 'pl'), '');
  assert.equal(getRecipeDisplaySteps(null, 'en'), '');
});

test('admin saves and reopens complete translations without losing the original or duplicating products', async () => {
  const requireAdmin = createRequire(new URL('../admin-app/package.json', import.meta.url));
  const adminRoot = fileURLToPath(new URL('../admin-app/', import.meta.url));
  const ts = requireAdmin('typescript');
  const React = requireAdmin('react');
  const { renderToStaticMarkup } = requireAdmin('react-dom/server');
  const cache = new Map();
  let form, submit, saved;
  function load(file) {
    let full = resolve(adminRoot, file);
    if (!extname(full)) full = ['.tsx', '.ts'].map(ext => full + ext).find(existsSync);
    if (cache.has(full)) return cache.get(full).exports;
    const module = { exports: {} };
    cache.set(full, module);
    const code = ts.transpileModule(readFileSync(full, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
    } }).outputText;
    const localRequire = id => {
      if (id === 'next/navigation') return { useRouter: () => ({ push() {} }) };
      if (id === 'react-hook-form') {
        const hooks = requireAdmin(id);
        return { ...hooks, useForm(options) {
          form = hooks.useForm(options);
          return { ...form, handleSubmit(callback) { submit = form.handleSubmit(callback); return submit; } };
        } };
      }
      if (id === '@/app/actions/recipes') return {
        async updateRecipe(id, payload, rows) { saved = { id, payload, rows: structuredClone(rows) }; return { ok: true }; },
        async createRecipe(payload, rows) { saved = { id: 'new', payload, rows }; return { id: 'new' }; },
      };
      if (id === '@/lib/supabase/client') return { createClient() { throw new Error('Unexpected external request'); } };
      if (id === './ImageUpload') return { __esModule: true, default: () => null };
      if (id.startsWith('@/')) return load('src/' + id.slice(2));
      if (id.startsWith('.')) return load(resolve(dirname(full), id));
      return requireAdmin(id);
    };
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    return module.exports;
  }
  const Form = load('src/components/recipes/RecipeForm.tsx').default;
  const recipe = { ...texts, id: '42', name_ua: 'Нагетси', status: 'pending', is_public: true, tags: [], available_locales: ['ua', 'en', 'pl'] };
  const rows = [{ product_id: 42, product_name: 'Курячий фарш', quantity: 700, unit: 'г' }];
  renderToStaticMarkup(React.createElement(Form, { recipe, initialIngredients: rows }));
  const fields = ['ingredients', 'ingredients_en', 'ingredients_pl'];
  for (const field of fields) assert.equal(form.getValues(field), texts[field]);
  const expected = { ...texts, ingredients_en: texts.ingredients_en + '\nExtra sauce — to taste' };
  form.setValue('ingredients_en', expected.ingredients_en);
  await submit();
  assert.equal(saved.id, '42');
  for (const field of fields) assert.equal(saved.payload[field], expected[field]);
  assert.deepEqual(saved.rows, rows);
  renderToStaticMarkup(React.createElement(Form, { recipe: { ...recipe, ...saved.payload }, initialIngredients: saved.rows }));
  for (const field of fields) assert.equal(form.getValues(field), expected[field]);
  form.setValue('ingredients_en', '');
  await submit();
  assert.equal(saved.payload.ingredients_en, '');
  assert.equal(saved.payload.ingredients_pl, texts.ingredients_pl);
  renderToStaticMarkup(React.createElement(Form, {}));
  form.setValue('name_ua', 'New recipe');
  for (const field of fields) form.setValue(field, texts[field]);
  await submit();
  assert.equal(saved.id, 'new');
  for (const field of fields) assert.equal(saved.payload[field], texts[field]);
  assert.deepEqual(saved.rows, []);
});

test('migration saves three ingredient texts in one recipe and refuses a rollback that loses translations', async () => {
  const db = new PGlite();
  const sql = await readFile(new URL('../supabase/migrations/20261004_1000_recipe_ingredient_translations.sql', import.meta.url), 'utf8');
  const rollback = await readFile(new URL('../supabase/migrations/20261004_1000_recipe_ingredient_translations_rollback.sql', import.meta.url), 'utf8');
  try {
    await db.exec('CREATE TABLE recipes(id integer PRIMARY KEY, ingredients text); CREATE TABLE product_recipe(recipe_id integer, ingredient_id integer, amount numeric); INSERT INTO product_recipe VALUES(1,42,700);');
    await db.query('INSERT INTO recipes VALUES(1,$1)', [texts.ingredients]);
    await db.exec(sql);
    await db.exec(sql);
    assert.deepEqual((await db.query('SELECT * FROM recipes')).rows, [{ id: 1, ingredients: texts.ingredients, ingredients_en: null, ingredients_pl: null }]);
    await db.query('UPDATE recipes SET ingredients_en=$1,ingredients_pl=$2 WHERE id=1', [texts.ingredients_en, texts.ingredients_pl]);
    assert.deepEqual((await db.query('SELECT * FROM recipes')).rows, [{ id: 1, ingredients: texts.ingredients, ingredients_en: texts.ingredients_en, ingredients_pl: texts.ingredients_pl }]);
    assert.deepEqual((await db.query('SELECT * FROM product_recipe')).rows, [{ recipe_id: 1, ingredient_id: 42, amount: '700' }]);
    await assert.rejects(db.exec(rollback), /Ingredient translations exist/);
    await db.exec('ROLLBACK;');
    assert.equal((await db.query('SELECT ingredients_pl FROM recipes')).rows[0].ingredients_pl, texts.ingredients_pl);
    await db.exec("UPDATE recipes SET ingredients_en='',ingredients_pl='';");
    await db.exec(rollback);
    assert.deepEqual((await db.query('SELECT * FROM recipes')).rows, [{ id: 1, ingredients: texts.ingredients }]);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM product_recipe')).rows[0].count, 1);
  } finally {
    await db.close();
  }
});
