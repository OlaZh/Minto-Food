// Runtime behaviour test for api/save-recipe.js (Phase 18 image moderation).
// Mocks global.fetch to stand in for: Supabase auth, REST reads/writes, RPCs,
// and the Sightengine provider. Drives the handler end-to-end and asserts the
// OBSERVED behaviour of each branch — the class of check that static tools miss.
// Run: node scripts/save-recipe-check.mjs

import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Force the Sightengine provider ON so we exercise real scoring math, and set a
// low rate limit we can trip.
process.env.SIGHTENGINE_USER = 'u';
process.env.SIGHTENGINE_SECRET = 's';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
process.env.IMAGE_MOD_RATE_PER_HOUR = '2';

const __dir = dirname(fileURLToPath(import.meta.url));
const modUrl = pathToFileURL(resolve(__dir, '../api/save-recipe.js')).href;
const { default: handler } = await import(modUrl);

let scenario = {};
const calls = [];

// Programmable fetch mock. `scenario` controls provider score + reservation.
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  calls.push({ url: u, method: opts.method || 'GET' });
  const json = (o, headers = {}) => ({
    ok: true, status: 200,
    json: async () => o, text: async () => JSON.stringify(o),
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  });
  const fail = (status, body) => ({
    ok: false, status,
    json: async () => body, text: async () => JSON.stringify(body),
    headers: { get: () => null },
  });

  // Supabase auth: verify JWT → user
  if (u.includes('/auth/v1/user')) return json({ id: 'user-1', email: 'a@b.c' });

  // Sightengine
  if (u.includes('sightengine.com')) {
    return json({ status: 'success', nudity: { sexual_display: scenario.score ?? 0, none: 1 - (scenario.score ?? 0) } });
  }

  // RPC: reserve slot — scenario.reserveFails simulates a missing GRANT
  // (permission denied) so we can prove the fail-open behaviour is observable.
  if (u.includes('/rpc/reserve_moderation_slot')) {
    if (scenario.reserveFails) return fail(403, { message: 'permission denied for function reserve_moderation_slot' });
    return json(scenario.overLimit ? null : 'resv-1');
  }
  if (u.includes('/rpc/finalize_moderation_slot')) {
    if (scenario.finalizeFails) return fail(403, { message: 'permission denied for function finalize_moderation_slot' });
    return json(null);
  }
  if (u.includes('/rpc/stage_recipe_update')) {
    if (scenario.stageFails) return fail(403, { message: 'permission denied for function stage_recipe_update' });
    return json(null);
  }

  // REST: profiles (shadow ban)
  if (u.includes('/rest/v1/profiles')) return json([{ is_shadow_banned: false }]);

  // REST: recipes GET (edit fetch) → return the "original"
  if (u.includes('/rest/v1/recipes?id=eq.') && (opts.method || 'GET') === 'GET') {
    return json([scenario.original ?? {}]);
  }
  // REST: recipes POST (create) / PATCH (edit) → echo back a saved row
  if (u.includes('/rest/v1/recipes')) {
    const body = opts.body ? JSON.parse(opts.body) : {};
    const row = Array.isArray(body) ? body[0] : body;
    return json([{ id: 42, ...row }]);
  }
  // image_moderation_log insert
  if (u.includes('/rest/v1/image_moderation_log')) return json(null);

  return json(null);
};

function mockRes() {
  return {
    _status: 0, _json: null, _headers: {},
    status(c) { this._status = c; return this; },
    json(o) { this._json = o; return this; },
    setHeader(k, v) { this._headers[k] = v; },
  };
}

let passed = 0, failed = 0;
function assert(name, cond, detail) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const IMG = 'data:image/png;base64,' + 'A'.repeat(40);

// ── 1. Threshold actually works: high score → flagged ──
scenario = { score: 0.95 };
{
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'X', steps: 'boil', image: IMG }, editingRecipeId: null, isPublicSubmission: true } }, res);
  assert('high score → flagged:true', res._json?.flagged === true, JSON.stringify(res._json));
  assert('high score → provider sightengine', res._json?.provider === 'sightengine', res._json?.provider);
}

// ── 2. Threshold: low score → not flagged ──
scenario = { score: 0.1 };
{
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'X', steps: 'boil', image: IMG }, editingRecipeId: null, isPublicSubmission: true } }, res);
  assert('low score → flagged:false', res._json?.flagged === false, JSON.stringify(res._json));
}

// ── 3. Server decides imageIsNew: edit with SAME photo → provider NOT called ──
scenario = { score: 0.95, original: { id: 42, user_id: 'user-1', status: 'draft', image: IMG } };
{
  calls.length = 0;
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'X', steps: 'boil', image: IMG }, editingRecipeId: 42, isPublicSubmission: false } }, res);
  const providerCalled = calls.some(c => c.url.includes('sightengine.com'));
  assert('edit, unchanged photo → provider NOT called', !providerCalled);
  assert('edit, unchanged photo → flagged:false', res._json?.flagged === false, JSON.stringify(res._json));
}

// ── 4. imageIsNew bypass impossible: client can't say "not new" for a NEW photo ──
// (handler ignores any client imageIsNew; a create with a photo is always new)
scenario = { score: 0.95 };
{
  calls.length = 0;
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'X', steps: 'boil', image: IMG }, editingRecipeId: null, isPublicSubmission: true, imageIsNew: false } }, res);
  const providerCalled = calls.some(c => c.url.includes('sightengine.com'));
  assert('create with photo → provider CALLED despite imageIsNew:false', providerCalled);
  assert('create with photo → flagged:true (bypass closed)', res._json?.flagged === true);
}

// ── 5. Invalid image (malformed data URI) → 400, NOT stored ──
scenario = { score: 0 };
{
  calls.length = 0;
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'X', steps: 'boil', image: 'data:image/png;base64,!!!!' }, editingRecipeId: null, isPublicSubmission: false } }, res);
  assert('invalid image → 400', res._status === 400, `status=${res._status}`);
  assert('invalid image → error invalid_image', res._json?.error === 'invalid_image', JSON.stringify(res._json));
  const wrote = calls.some(c => c.url.includes('/rest/v1/recipes') && c.method === 'POST');
  assert('invalid image → recipe NOT written', !wrote);
}

// ── 5b. Not-an-image (plain junk string) → 400, NOT stored ──
scenario = { score: 0 };
{
  calls.length = 0;
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'X', steps: 'boil', image: 'not-an-image' }, editingRecipeId: null, isPublicSubmission: false } }, res);
  assert('junk-string image → 400', res._status === 400, `status=${res._status}`);
  const wrote = calls.some(c => c.url.includes('/rest/v1/recipes') && c.method === 'POST');
  assert('junk-string image → recipe NOT written', !wrote);
}

// ── 6. Create status: private → draft, public → pending ──
scenario = { score: 0.1 };
{
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'X', steps: 'boil', image: IMG }, editingRecipeId: null, isPublicSubmission: false } }, res);
  assert('create private → status draft', res._json?.recipe?.status === 'draft', res._json?.recipe?.status);
}
{
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'X', steps: 'boil', image: IMG }, editingRecipeId: null, isPublicSubmission: true } }, res);
  assert('create public → status pending', res._json?.recipe?.status === 'pending', res._json?.recipe?.status);
}

// ── 7. Edit draft → public: status recomputed to pending ──
scenario = { score: 0.1, original: { id: 42, user_id: 'user-1', status: 'draft', image: IMG } };
{
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'X', steps: 'boil', image: IMG }, editingRecipeId: 42, isPublicSubmission: true } }, res);
  assert('edit draft→public → status pending', res._json?.recipe?.status === 'pending', JSON.stringify(res._json?.recipe?.status));
}

// ── 8. Rate limit: over limit → provider NOT called, queued (flagged) ──
scenario = { score: 0.1, overLimit: true };
{
  calls.length = 0;
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'X', steps: 'boil', image: IMG }, editingRecipeId: null, isPublicSubmission: true } }, res);
  const providerCalled = calls.some(c => c.url.includes('sightengine.com'));
  assert('over rate limit → provider NOT called', !providerCalled);
  assert('over rate limit → flagged (queued)', res._json?.flagged === true, JSON.stringify(res._json));
  assert('over rate limit → provider rate_limited', res._json?.provider === 'rate_limited');
}

// ── 9. reserve RPC fails (missing GRANT) → fail-open: provider STILL called,
//       recipe saved. This documents the observable fail-open behaviour so a
//       future regression (e.g. accidental fail-closed) is caught. ──
scenario = { score: 0.1, reserveFails: true };
{
  calls.length = 0;
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'X', steps: 'boil', image: IMG }, editingRecipeId: null, isPublicSubmission: true } }, res);
  const providerCalled = calls.some(c => c.url.includes('sightengine.com'));
  assert('reserve RPC fails → provider still called (fail-open)', providerCalled);
  assert('reserve RPC fails → recipe still saved (200)', res._status === 200, `status=${res._status}`);
}

// ── 10. published edit with NEW flagged photo → stage RPC called, recipe flagged ──
scenario = { score: 0.95, original: { id: 42, user_id: 'user-1', status: 'published', is_public: true, image: 'https://old/p.jpg', name_ua: 'Old' } };
{
  calls.length = 0;
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'Old', steps: 'boil', image: IMG }, editingRecipeId: 42, isPublicSubmission: true } }, res);
  const stageCalled = calls.some(c => c.url.includes('/rpc/stage_recipe_update'));
  assert('published edit, new photo → stage_recipe_update called', stageCalled);
  assert('published edit, new flagged photo → flagged:true', res._json?.flagged === true, JSON.stringify(res._json));
}

// ── 11. When stage_recipe_update RPC responds 403, the handler returns 500
//       (does NOT silently succeed). NOTE: this proves handler error-handling
//       only — the mock returns 403 on command; it does NOT read the SQL GRANT.
//       Verifying the grant itself requires running the migration on Postgres
//       (a live-DB E2E task, not this mock). ──
scenario = { score: 0.1, stageFails: true, original: { id: 42, user_id: 'user-1', status: 'published', is_public: true, image: 'https://old/p.jpg' } };
{
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'New', steps: 'boil', image: IMG }, editingRecipeId: 42, isPublicSubmission: true } }, res);
  assert('stage RPC fails → 500 (grant protected)', res._status === 500, `status=${res._status}`);
}

// ── 12. finalize_moderation_slot fails → save still succeeds (finalize is
//       best-effort audit only). Documents that finalize is NOT save-critical. ──
scenario = { score: 0.1, finalizeFails: true };
{
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer x' },
    body: { recipe: { name_ua: 'X', steps: 'boil', image: IMG }, editingRecipeId: null, isPublicSubmission: true } }, res);
  assert('finalize fails → save still 200 (best-effort audit)', res._status === 200, `status=${res._status}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
