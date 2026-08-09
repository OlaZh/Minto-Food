// Live pre-production RLS regression for docs/qa-test-plan.md Round C.
//
// Creates two disposable users through the public signup flow, seeds isolated
// rows as User A, probes them as User B and anon, then schedules both users for
// GDPR deletion. Tokens, passwords and emails are never written to output.
//
// Run intentionally (this mutates pre-production):
//   $env:RLS_QA_CONFIRM='1'; node scripts/rls-round-c-check.mjs


import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const SUPABASE_URL = 'https://xpaibteyntflrixmigfx.supabase.co';
const APP_URL = 'https://minto-food.vercel.app';

if (process.env.RLS_QA_CONFIRM !== '1') {
  throw new Error('Refusing to mutate pre-production without RLS_QA_CONFIRM=1');
}

const sitemapSource = await readFile(new URL('../api/sitemap.js', import.meta.url), 'utf8');
const anonMatch = sitemapSource.match(/SUPABASE_ANON_KEY\s*\|\|\s*'([^']+)'/);
if (!anonMatch) throw new Error('Supabase publishable key was not found');
const ANON_KEY = anonMatch[1];

const runId = `${Date.now()}-${randomBytes(3).toString('hex')}`;
const password = `Qa!${randomBytes(18).toString('base64url')}9a`;
const today = new Date().toISOString().slice(0, 10);
const tag = `QA-RLS-${runId}`;

const state = {
  a: null,
  b: null,
  draftId: null,
  pendingId: null,
  publicRecipeId: null,
  bookId: null,
  shoppingListId: null,
  ratingCreated: false,
};

const results = [];
const cleanup = [];

function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${detail}`);
}

function bodyText(body) {
  if (typeof body === 'string') return body;
  try { return JSON.stringify(body); } catch { return ''; }
}

function isDenied(response) {
  const text = bodyText(response.body).toLowerCase();
  return response.status === 401 || response.status === 403 ||
    text.includes('permission denied') || text.includes('access denied') ||
    text.includes('not authorized') || text.includes('admin privileges required') ||
    text.includes('42501');
}

function isEmptyRows(response) {
  return response.ok && Array.isArray(response.body) && response.body.length === 0;
}

async function request(url, { method = 'GET', token = ANON_KEY, body, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let parsed = text;
  if (text) {
    try { parsed = JSON.parse(text); } catch {}
  } else {
    parsed = null;
  }

  return { ok: response.ok, status: response.status, body: parsed };
}

function rest(path, options = {}) {
  return request(`${SUPABASE_URL}/rest/v1/${path}`, options);
}

async function signup(label) {
  const email = `qa-rls-${label}-${runId}@example.com`;
  const response = await request(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    body: {
      email,
      password,
      data: {
        full_name: `${tag}-${label}`,
        consent_age_16: true,
        consent_terms: true,
      },
    },
  });

  const user = response.body?.user;
  const token = response.body?.access_token;
  if (!response.ok || !user?.id || !token) {
    throw new Error(`Disposable ${label} signup failed (${response.status}); immediate session is required`);
  }
  return { id: user.id, token };
}

async function insert(table, row, token) {
  const response = await rest(table, {
    method: 'POST',
    token,
    body: row,
    headers: { Prefer: 'return=representation' },
  });
  if (!response.ok || !Array.isArray(response.body) || !response.body[0]) {
    throw new Error(`Seed ${table} failed (${response.status}): ${bodyText(response.body)}`);
  }
  return response.body[0];
}

async function createRecipe(token, suffix, isPublicSubmission) {
  const response = await request(`${APP_URL}/api/save-recipe`, {
    method: 'POST',
    token,
    body: {
      recipe: {
        name_ua: `${tag}-${suffix}`,
        ingredients: 'QA ingredient 100 g',
        steps: 'QA-only RLS verification recipe.',
        kcal: 100,
        protein: 10,
        fat: 2,
        carbs: 12,
        total_weight: 100,
        category: 'QA',
        image: '',
      },
      editingRecipeId: null,
      isPublicSubmission,
      imageIsNew: false,
    },
  });
  if (!response.ok || !response.body?.recipe?.id) {
    throw new Error(`Create ${suffix} recipe failed (${response.status}): ${bodyText(response.body)}`);
  }
  return response.body.recipe;
}

async function seedPrivateData() {
  const a = state.a;

  const draft = await createRecipe(a.token, 'draft', false);
  const pending = await createRecipe(a.token, 'pending', true);
  state.draftId = draft.id;
  state.pendingId = pending.id;

  await insert('meals', {
    user_id: a.id, date: today, meal_type: 'breakfast', name: tag,
    weight: 100, kcal: 100, protein: 10, fat: 2, carbs: 12,
  }, a.token);
  await insert('water', { user_id: a.id, date: today, amount: 0.25 }, a.token);
  await insert('week_meals', {
    user_id: a.id, week_start: today, day: 'monday', meal_type: 'breakfast',
    name: tag, kcal: 100, protein: 10, fat: 2, carbs: 12,
  }, a.token);
  await insert('weight_records', { user_id: a.id, date: today, weight: 70 }, a.token);
  await insert('user_activities', {
    user_id: a.id, type: 'walking', label: tag, icon: 'walk', duration: 10,
    calories: 25, steps: 1000, distance_km: 0.8, performed_at: new Date().toISOString(),
  }, a.token);

  const list = await insert('shopping_lists', {
    user_id: a.id, name: tag, type: 'shopping',
  }, a.token);
  state.shoppingListId = list.id;
  await insert('shopping_items', {
    list_id: list.id, user_id: a.id, name: tag, amount: '1', unit: 'шт',
    category: 'Інше', is_checked: false,
  }, a.token);

  const book = await insert('cookbooks', {
    user_id: a.id, name: tag, icon: 'book', is_default: true,
  }, a.token);
  state.bookId = book.id;
  await insert('gdpr_requests', {
    user_id: a.id, type: 'export', status: 'pending',
  }, a.token);
}

async function testRls01() {
  const ids = [state.draftId, state.pendingId].join(',');
  const response = await rest(`recipes?select=id,status,user_id&id=in.(${ids})`, { token: state.b.token });
  record('RLS-01', isEmptyRows(response), `User B received ${Array.isArray(response.body) ? response.body.length : 'error'} private/pending rows`);
}

async function testRls02() {
  const original = await rest(`recipes?select=id,name_ua&id=eq.${state.draftId}`, { token: state.a.token });
  const originalName = original.body?.[0]?.name_ua;

  const update = await rest(`recipes?id=eq.${state.draftId}`, {
    method: 'PATCH', token: state.b.token, body: { name_ua: `${tag}-hijacked` },
    headers: { Prefer: 'return=representation' },
  });
  const remove = await rest(`recipes?id=eq.${state.draftId}`, {
    method: 'DELETE', token: state.b.token, headers: { Prefer: 'return=representation' },
  });
  const after = await rest(`recipes?select=id,name_ua&id=eq.${state.draftId}`, { token: state.a.token });
  const intact = after.body?.[0]?.name_ua === originalName && after.body?.[0]?.id === state.draftId;
  record('RLS-02', (isEmptyRows(update) || isDenied(update)) && (isEmptyRows(remove) || isDenied(remove)) && intact,
    `foreign update=${update.status}, delete=${remove.status}, owner row intact=${intact}`);
}

async function testRls03() {
  const tables = [
    'meals', 'water', 'week_meals', 'weight_records', 'user_activities',
    'user_streaks', 'shopping_lists', 'shopping_items', 'cookbooks', 'gdpr_requests',
  ];
  const checks = [];
  for (const table of tables) {
    const path = `${table}?select=*&user_id=eq.${state.a.id}`;
    const ownerResponse = await rest(path, { token: state.a.token });
    const response = await rest(path, { token: state.b.token });
    const ownerHasSeed = ownerResponse.ok && Array.isArray(ownerResponse.body) && ownerResponse.body.length > 0;
    checks.push({ table, ok: ownerHasSeed && (isEmptyRows(response) || isDenied(response)),
      ownerHasSeed, status: response.status,
      rows: Array.isArray(response.body) ? response.body.length : null });
  }
  const failed = checks.filter((item) => !item.ok);
  record('RLS-03', failed.length === 0,
    failed.length
      ? `failed: ${failed.map((x) => `${x.table}(seed=${x.ownerHasSeed},foreign=${x.rows})`).join(', ')}`
      : `owner seeds confirmed and 0 foreign rows across ${tables.length} private tables`);
}

async function findPublishedRecipe() {
  const response = await rest('recipes?select=id,user_id,status,is_public,deleted_at&status=eq.published&is_public=eq.true&deleted_at=is.null&limit=20');
  if (!response.ok || !Array.isArray(response.body)) throw new Error('Cannot read published recipe catalog');
  const recipe = response.body.find((row) => row.user_id !== state.b.id);
  if (!recipe) throw new Error('No published recipe available for rating tests');
  state.publicRecipeId = recipe.id;
}

async function testRls04And05() {
  await findPublishedRecipe();
  const rating = await insert('recipe_ratings', {
    recipe_id: state.publicRecipeId, user_id: state.b.id, rating: 4,
  }, state.b.token);
  state.ratingCreated = Boolean(rating);

  const own = await rest(`recipe_ratings?select=recipe_id,user_id,rating&recipe_id=eq.${state.publicRecipeId}`, { token: state.b.token });
  const other = await rest(`recipe_ratings?select=recipe_id,user_id,rating&recipe_id=eq.${state.publicRecipeId}`, { token: state.a.token });
  const anon = await rest(`recipe_ratings?select=recipe_id,user_id,rating&recipe_id=eq.${state.publicRecipeId}`);
  const forged = await rest('recipe_ratings', {
    method: 'POST', token: state.b.token,
    body: { recipe_id: state.publicRecipeId, user_id: state.a.id, rating: 5 },
    headers: { Prefer: 'return=representation' },
  });
  const rawOk = own.body?.length === 1 && own.body[0].user_id === state.b.id &&
    (isEmptyRows(other) || isDenied(other)) && (isEmptyRows(anon) || isDenied(anon)) && isDenied(forged);
  record('RLS-04', rawOk, `own rows=${own.body?.length ?? 'error'}, other/anon raw rows hidden, forged insert=${forged.status}`);

  const rpcBody = { p_recipe_ids: [state.publicRecipeId] };
  const summaryAnon = await rest('rpc/get_recipe_rating_summaries', { method: 'POST', body: rpcBody });
  const summaryAuth = await rest('rpc/get_recipe_rating_summaries', { method: 'POST', token: state.a.token, body: rpcBody });
  const anonRow = summaryAnon.body?.find?.((row) => row.recipe_id === state.publicRecipeId);
  const authRow = summaryAuth.body?.find?.((row) => row.recipe_id === state.publicRecipeId);
  const summaryOk = summaryAnon.ok && summaryAuth.ok && Number(anonRow?.rating_count) >= 1 && Number(authRow?.rating_count) >= 1;
  record('RLS-05', summaryOk, `aggregate visible to anon=${Boolean(anonRow)}, authenticated=${Boolean(authRow)}`);
}

async function testRls06() {
  const hidden = await rest(`recipes?select=id,status,is_public,deleted_at&id=in.(${state.draftId},${state.pendingId})`);
  const visible = await rest('recipes?select=id,status,is_public,deleted_at&limit=1000');
  const rows = Array.isArray(visible.body) ? visible.body : [];
  const invalid = rows.filter((row) => row.status !== 'published' || row.is_public !== true || row.deleted_at !== null);
  const groups = new Map();
  for (const row of invalid) {
    const key = `${row.status ?? 'null'}/${row.is_public ?? 'null'}/deleted=${row.deleted_at !== null}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  const distribution = [...groups.entries()].map(([key, count]) => `${key}:${count}`).join(', ');
  record('RLS-06', isEmptyRows(hidden) && visible.ok && invalid.length === 0,
    `anon hidden QA rows=${hidden.body?.length ?? 'error'}; catalog rows=${rows.length}; invalid visible rows=${invalid.length}${distribution ? ` (${distribution})` : ''}`);
}

async function testRls07() {
  const attemptedAt = new Date().toISOString();
  const moderationPatch = await rest(`recipes?id=eq.${state.draftId}`, {
    method: 'PATCH', token: state.a.token,
    body: { is_image_flagged: true, image_nsfw_score: 0.99, image_moderated_at: attemptedAt },
    headers: { Prefer: 'return=representation' },
  });
  const recipe = await rest(`recipes?select=id,is_image_flagged,image_nsfw_score,image_moderated_at&id=eq.${state.draftId}`, { token: state.a.token });
  const row = recipe.body?.[0];
  const moderationNotForged = row && !(row.is_image_flagged === true && Number(row.image_nsfw_score) === 0.99 && row.image_moderated_at === attemptedAt);

  const anonPatch = await rest(`recipes?id=eq.${state.draftId}`, {
    method: 'PATCH', body: { is_image_flagged: true },
    headers: { Prefer: 'return=representation' },
  });
  const logInsertAuth = await rest('image_moderation_log', {
    method: 'POST', token: state.a.token,
    body: { user_id: state.a.id, recipe_id: state.draftId, provider: 'qa', decision: 'approved' },
  });
  const logInsertAnon = await rest('image_moderation_log', {
    method: 'POST', body: { user_id: state.a.id, recipe_id: state.draftId, provider: 'qa', decision: 'approved' },
  });
  const logReadAuth = await rest('image_moderation_log?select=*&limit=1', { token: state.a.token });
  const ok = moderationPatch.ok && moderationNotForged && (isEmptyRows(anonPatch) || isDenied(anonPatch)) &&
    isDenied(logInsertAuth) && isDenied(logInsertAnon) && (isEmptyRows(logReadAuth) || isDenied(logReadAuth));
  record('RLS-07', ok, `moderation fields forged=${!moderationNotForged}; log writes auth/anon=${logInsertAuth.status}/${logInsertAnon.status}`);
}

async function testRls08() {
  const adminActions = await rest('admin_actions?select=*&limit=1', { token: state.b.token });
  const adminSearch = await rest('rpc/admin_search_users', {
    method: 'POST', token: state.b.token, body: { p_query: 'qa-rls', p_limit: 10 },
  });
  const override = await rest('rpc/override_image_flag', {
    method: 'POST', token: state.b.token, body: { p_recipe_id: state.draftId, p_flagged: false },
  });
  const ok = (isEmptyRows(adminActions) || isDenied(adminActions)) && isDenied(adminSearch) && isDenied(override);
  record('RLS-08', ok, `admin_actions=${adminActions.status}, admin_search_users=${adminSearch.status}, override_image_flag=${override.status}`);
}

async function testRls09AndScheduleDeletion() {
  const anon = await rest('rpc/soft_delete_user', { method: 'POST', body: { p_user_id: state.a.id } });
  const foreign = await rest('rpc/soft_delete_user', {
    method: 'POST', token: state.b.token, body: { p_user_id: state.a.id },
  });
  const ownA = await rest('rpc/soft_delete_user', {
    method: 'POST', token: state.a.token, body: { p_user_id: state.a.id },
  });
  const ownB = await rest('rpc/soft_delete_user', {
    method: 'POST', token: state.b.token, body: { p_user_id: state.b.id },
  });
  const ok = isDenied(anon) && isDenied(foreign) && ownA.ok && ownB.ok;
  record('RLS-09', ok, `anon=${anon.status}, foreign UUID=${foreign.status}, own A/B=${ownA.status}/${ownB.status}`);
  cleanup.push({ action: 'GDPR soft-delete scheduled for disposable A/B', ok: ownA.ok && ownB.ok });
}

async function removeOwnTestData() {
  if (!state.a || !state.b) return;

  if (state.ratingCreated && state.publicRecipeId) {
    const response = await rest(`recipe_ratings?recipe_id=eq.${state.publicRecipeId}&user_id=eq.${state.b.id}`, {
      method: 'DELETE', token: state.b.token,
    });
    cleanup.push({ action: 'rating row removed', ok: response.ok });
  }

  const aDeletes = [
    ['shopping_items', `user_id=eq.${state.a.id}`],
    ['shopping_lists', `user_id=eq.${state.a.id}`],
    ['cookbooks', `user_id=eq.${state.a.id}`],
    ['user_activities', `user_id=eq.${state.a.id}`],
    ['weight_records', `user_id=eq.${state.a.id}`],
    ['week_meals', `user_id=eq.${state.a.id}`],
    ['water', `user_id=eq.${state.a.id}`],
    ['meals', `user_id=eq.${state.a.id}`],
    ['recipes', `id=in.(${state.draftId},${state.pendingId})`],
  ];
  for (const [table, filter] of aDeletes) {
    const response = await rest(`${table}?${filter}`, { method: 'DELETE', token: state.a.token });
    cleanup.push({ action: `${table} QA rows removed`, ok: response.ok });
  }
}

let fatalError = null;
try {
  state.a = await signup('a');
  state.b = await signup('b');
  console.log('Created two disposable QA users (identifiers withheld).');

  await seedPrivateData();
  await testRls01();
  await testRls02();
  await testRls03();
  await testRls04And05();
  await testRls06();
  await testRls07();
  await testRls08();
  await removeOwnTestData();
  await testRls09AndScheduleDeletion();
} catch (error) {
  fatalError = error;
  console.error(`FATAL: ${error.message}`);
  try { await removeOwnTestData(); } catch (cleanupError) {
    console.error(`Cleanup error: ${cleanupError.message}`);
  }
  if (state.a && state.b) {
    try { await testRls09AndScheduleDeletion(); } catch (cleanupError) {
      console.error(`GDPR cleanup error: ${cleanupError.message}`);
    }
  }
}

const passed = results.filter((item) => item.ok).length;
const failed = results.filter((item) => !item.ok).length;
const cleanupFailed = cleanup.filter((item) => !item.ok);
console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total; cleanup failures=${cleanupFailed.length}`);

if (fatalError || failed > 0 || cleanupFailed.length > 0 || results.length !== 9) {
  process.exitCode = 1;
}
