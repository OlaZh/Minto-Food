// Privacy and data-integrity regressions for the GDPR export endpoint.
// Run: node --no-warnings --test scripts/gdpr-export-check.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const uid = 'aaaaaaaa-1111-2222-3333-444444444444';
const ratings = [{ user_id: uid, recipe_id: 42, rating: 5 }];
const limits = [{ id: 7, user_id: uid, bucket: 'recipe_create', occurred_at: '2026-10-06T10:00:00Z' }];
const previousEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
let handler;
try {
  ({ default: handler } = await import('../api/gdpr-export.js'));
} finally {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function run({ authorization = 'Bearer owner-token', invalidToken = false, failedTable } = {}) {
  const calls = [];
  const response = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    calls.push({ url, options });
    if (url.pathname === '/auth/v1/user') {
      assert.equal(options.headers.Authorization, authorization);
      return { ok: !invalidToken, json: async () => ({ id: uid, email: 'owner@example.test' }) };
    }
    if (options.method === 'POST') return { ok: true };
    const table = url.pathname.split('/').at(-1);
    // Service-role queries must be scoped to the authenticated owner,
    // even if a caller supplies another user_id in the request query.
    assert.equal(url.searchParams.get(table === 'profiles' ? 'id' : 'user_id'), `eq.${uid}`);
    if (table === failedTable) {
      return { ok: false, status: 503, text: async () => 'test query failure' };
    }
    return { ok: true, json: async () => table === 'recipe_ratings' ? ratings : table === 'api_rate_limits' ? limits : [] };
  };
  try {
    await handler({ method: 'GET', headers: { authorization }, query: { user_id: 'another-user' } }, response);
    return { response, calls };
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test('export includes both new sections scoped to the authenticated owner', async () => {
  const { response, calls } = await run();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.recipe_ratings, ratings);
  assert.deepEqual(response.body.api_rate_limits, limits);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.match(response.headers['Content-Disposition'], /mintofood-export-aaaaaaaa\.json/);
  const audit = calls.filter(call => call.options.method === 'POST');
  assert.equal(audit.length, 1);
  assert.equal(JSON.parse(audit[0].options.body).status, 'completed');
});

for (const failedTable of ['recipe_ratings', 'api_rate_limits']) {
  test(`${failedTable} failure returns an error instead of a partial export`, async () => {
    const { response, calls } = await run({ failedTable });
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { error: 'Export failed. Please try again.' });
    const audit = calls.filter(call => call.options.method === 'POST');
    assert.equal(audit.length, 1);
    assert.equal(JSON.parse(audit[0].options.body).status, 'failed');
  });
}

test('missing token cannot read any data', async () => {
  const { response, calls } = await run({ authorization: '' });
  assert.equal(response.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('invalid token cannot access service-role data queries', async () => {
  const { response, calls } = await run({ invalidToken: true });
  assert.equal(response.statusCode, 401);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/auth/v1/user');
});
