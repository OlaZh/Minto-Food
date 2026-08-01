// Security regression tests for api/cron/gdpr-hard-delete.js.
// Proves that the destructive endpoint fails closed before any Supabase call.
// Run: node --test scripts/gdpr-cron-check.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const handlerUrl = pathToFileURL(resolve(scriptDir, '../api/cron/gdpr-hard-delete.js')).href;

function mockResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function importHandler(name, env) {
  const previous = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    const module = await import(`${handlerUrl}?test=${encodeURIComponent(name)}`);
    return module.default;
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function run(handler, authorization) {
  let fetchCalls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalls++;
    return {
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => '[]',
    };
  };

  try {
    const response = mockResponse();
    await handler({ headers: authorization ? { authorization } : {} }, response);
    return { response, fetchCalls };
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test('missing CRON_SECRET fails closed before Supabase access', async () => {
  const handler = await importHandler('missing-secret', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    CRON_SECRET: undefined,
  });
  const { response, fetchCalls } = await run(handler);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { error: 'Server misconfigured' });
  assert.equal(fetchCalls, 0);
});

test('missing Authorization is rejected before Supabase access', async () => {
  const handler = await importHandler('missing-auth', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    CRON_SECRET: 'test-cron-secret',
  });
  const { response, fetchCalls } = await run(handler);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Unauthorized' });
  assert.equal(fetchCalls, 0);
});

test('wrong Bearer token is rejected before Supabase access', async () => {
  const handler = await importHandler('wrong-auth', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    CRON_SECRET: 'test-cron-secret',
  });
  const { response, fetchCalls } = await run(handler, 'Bearer wrong-secret');

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Unauthorized' });
  assert.equal(fetchCalls, 0);
});

test('correct Bearer token reaches the cron handler', async () => {
  const handler = await importHandler('correct-auth', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    CRON_SECRET: 'test-cron-secret',
  });
  const { response, fetchCalls } = await run(handler, 'Bearer test-cron-secret');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { deleted: 0, message: 'No users pending deletion' });
  assert.equal(fetchCalls, 1);
});
