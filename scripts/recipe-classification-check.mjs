// Cross-app classification compatibility and real PostgreSQL migration/RPC checks.
// Uses the same local PGlite installation as saved-recipe-sql-check.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../node_modules/.cache/recipe-media-qa/node_modules/@electric-sql/pglite/dist/index.js';
import { RECIPE_FILTER_GROUPS } from '../js/recipe-classification.js';
import { RECIPE_TYPES, RECIPE_CATEGORIES, COOKING_METHODS, RECIPE_CUISINES } from '../admin-app/src/lib/types.ts';
import { generateRecipeTags } from '../admin-app/src/lib/auto-tags.ts';

let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('PASS ' + name); }
await check('site and admin use identical dish types and cooking methods', () => {
  for (const [group, admin] of [['dish_type', RECIPE_TYPES], ['cooking_method', COOKING_METHODS]]) {
    assert.deepEqual(RECIPE_FILTER_GROUPS.find(g => g.id === group).options.map(o => ({ value: o.value, label: o.ua })), admin);
  }
  const categories = RECIPE_FILTER_GROUPS.find(g => g.id === 'category').options.map(o => o.value);
  assert.ok(categories.every(value => RECIPE_CATEGORIES.some(o => o.value === value)));
  assert.ok(!RECIPE_CATEGORIES.some(o => o.value === 'salad'));
  assert.ok(!RECIPE_CUISINES.some(cuisine => RECIPE_CATEGORIES.some(category => category.value === cuisine.value)));
});
await check('automatic dietary suggestions use the tag codes understood by the catalogue', () => {
  const tags = generateRecipeTags([{ product_id: 1, product_name: 'chicken', quantity: 100, unit: 'g' }], 'lunch', 'salad', 'fresh');
  assert.ok(tags.includes('high_protein'));
  assert.ok(tags.includes('low_carb'));
  assert.ok(tags.includes('gluten_free'));
  assert.ok(!tags.includes('vegetarian'));
});

const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const sql = await readFile(new URL('../supabase/migrations/20260929_1100_recipe_classification.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../supabase/migrations/20260929_1100_recipe_classification_rollback.sql', import.meta.url), 'utf8');
const baseline = await readFile(new URL('../supabase/migrations/20260724_1000_image_moderation.sql', import.meta.url), 'utf8');
const oldRpc = baseline.slice(baseline.indexOf('CREATE OR REPLACE FUNCTION stage_recipe_update(')).split('\n$$;')[0] + '\n$$;';
const snapshot = () => db.query('SELECT id,category,type,cooking_method FROM recipes ORDER BY id').then(r => r.rows);
const rpc = (id, user, direct, pending = {}) => db.query('SELECT public.stage_recipe_update($1,$2,$3::jsonb,$4::jsonb)', [id, user, JSON.stringify(direct), JSON.stringify(pending)]);
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE recipes(id integer PRIMARY KEY,user_id uuid,name_ua text,kcal numeric,protein numeric,
      fat numeric,carbs numeric,fiber numeric,total_weight numeric,category text,type text,cooking_method text,
      ingredients text,steps text,is_public boolean,status text,has_pending_update boolean DEFAULT false,
      is_image_flagged boolean DEFAULT false,image_nsfw_score numeric,image_moderated_at timestamptz,deleted_at timestamptz);
    CREATE TABLE recipe_pending_updates(recipe_id integer,user_id uuid,changes jsonb);
    INSERT INTO recipes(id,user_id,category,type,cooking_method,name_ua,status) VALUES
      (1,'${owner}','ukrainian','soup','boiled','Original','published'),
      (2,'${owner}','salad',NULL,'raw',NULL,'draft'),
      (3,'${owner}','european','lunch','baked',NULL,'draft'),
      (4,'${owner}','dinner','lunch','slow_cooked',NULL,'draft'),
      (5,'${owner}','fit','main_course','frying',NULL,'draft'),
      (6,'${owner}','salad','soup','fresh',NULL,'draft');
  `);
  await db.exec(oldRpc);
  const before = await snapshot();
  const definition = (await db.query("SELECT pg_get_functiondef('stage_recipe_update(integer,uuid,jsonb,jsonb,boolean,numeric)'::regprocedure) AS body")).rows[0].body;
  await db.exec(sql);
  await check('migration separates cuisine, transfers salad and converts only exact method aliases', async () => {
    const rows = (await db.query('SELECT id,category,type,cooking_method,cuisine FROM recipes ORDER BY id')).rows;
    assert.deepEqual(rows[0], { id: 1, category: null, type: 'soup', cooking_method: 'boiling', cuisine: 'ukrainian' });
    assert.deepEqual(rows[1], { id: 2, category: null, type: 'salad', cooking_method: 'fresh', cuisine: null });
    assert.deepEqual(rows[2], { id: 3, category: 'lunch', type: null, cooking_method: 'baking', cuisine: 'european' });
    assert.equal(rows[3].type, 'lunch');
    assert.equal(rows[3].category, 'dinner');
    assert.equal(rows[3].cooking_method, 'slow_cooked');
    assert.equal(rows[4].category, 'fit');
    assert.equal(rows[5].type, 'soup');
    assert.equal(rows[5].category, 'salad');
  });
  await check('only the save service can execute the published-edit RPC', async () => {
    const row = (await db.query(`SELECT
      has_function_privilege('anon','stage_recipe_update(integer,uuid,jsonb,jsonb,boolean,numeric)','EXECUTE') AS anon,
      has_function_privilege('authenticated','stage_recipe_update(integer,uuid,jsonb,jsonb,boolean,numeric)','EXECUTE') AS authenticated,
      has_function_privilege('service_role','stage_recipe_update(integer,uuid,jsonb,jsonb,boolean,numeric)','EXECUTE') AS service`)).rows[0];
    assert.deepEqual(row, { anon: false, authenticated: false, service: true });
    await db.exec(`SELECT set_config('request.jwt.claims','{"role":"service_role"}',false); SET ROLE service_role;`);
    await assert.rejects(rpc(1, other, { type: 'salad' }), /forbidden/);
  });
  await check('postflight identifies only unresolved legacy classifications', async () => {
    await db.exec('RESET ROLE;');
    const postflight = await readFile(new URL('../supabase/checks/recipe_classification_postflight.sql', import.meta.url), 'utf8');
    const [structure, unresolved] = await db.exec(postflight);
    assert.ok(Object.values(structure.rows[0]).every(value => value === true));
    assert.deepEqual(unresolved.rows.map(row => row.id), [4, 5, 6]);
    await db.exec('SET ROLE service_role;');
  });
  await check('published edit saves classification and stages text in the same transaction', async () => {
    await rpc(1, owner, { type: 'salad', cooking_method: 'fresh', cuisine: 'asian' }, { name_ua: 'Pending' });
    await db.exec('RESET ROLE;');
    const row = (await db.query('SELECT type,cooking_method,cuisine,name_ua,has_pending_update FROM recipes WHERE id=1')).rows[0];
    assert.deepEqual(row, { type: 'salad', cooking_method: 'fresh', cuisine: 'ukrainian', name_ua: 'Original', has_pending_update: true });
    assert.equal((await db.query('SELECT changes FROM recipe_pending_updates WHERE recipe_id=1')).rows[0].changes.name_ua, 'Pending');
    await db.exec('SET ROLE service_role;');
    await rpc(1, owner, {});
    await db.exec('RESET ROLE;');
    assert.equal((await db.query('SELECT type FROM recipes WHERE id=1')).rows[0].type, 'salad');
    await db.exec('SET ROLE service_role;');
    await rpc(1, owner, { type: null, cooking_method: null });
    await db.exec('RESET ROLE;');
    assert.deepEqual((await db.query('SELECT type,cooking_method FROM recipes WHERE id=1')).rows[0], { type: null, cooking_method: null });
  });
  await check('rollback refuses to overwrite classifications edited after migration', async () => {
    await assert.rejects(db.exec(rollback), /Classification changed/);
    await db.exec('ROLLBACK;');
    assert.equal((await db.query('SELECT cuisine FROM recipes WHERE id=1')).rows[0].cuisine, 'ukrainian');
  });
  await check('rollback restores original values and the original RPC without deleting recipes', async () => {
    await db.exec("UPDATE recipes SET type='soup',cooking_method='boiling' WHERE id=1;");
    await db.exec(rollback);
    assert.deepEqual(await snapshot(), before);
    assert.equal((await db.query("SELECT pg_get_functiondef('stage_recipe_update(integer,uuid,jsonb,jsonb,boolean,numeric)'::regprocedure) AS body")).rows[0].body, definition);
    await assert.rejects(db.query('SELECT cuisine FROM recipes'), /does not exist/);
  });
} finally { await db.close(); }
console.log(`${passed} checks passed`);
