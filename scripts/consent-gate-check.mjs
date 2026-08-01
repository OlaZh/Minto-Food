// Unit tests for js/analytics-consent-gate.js — the PostHog last-write-wins
// consent arbitration logic. This module has ZERO document/supabase/CDN
// dependencies (everything is injected via `deps`), so these tests import
// the REAL production module directly — no DOM mocks, no module-cache
// workarounds, no https:// specifiers to fight with node:test's loader.
//
// Covers the core state transitions and regressions called out in review:
//   1. true → false while SDK is still loading: no init, no capture
//   2. true → false → true: exactly one init, final state is opt-in
//   3. consent revoked while getSession() is in flight: no identify after
//   4. SIGNED_IN while analytics:false: no identify (no network call even)
//   5. no API key: the CDN loader is never invoked
//   6. SDK load failure: the next attempt can retry (loadInFlight clears)
//   7. repeated analytics:true does not create a duplicate $pageview
//   8. SIGNED_OUT invalidates an in-flight identify
//   9. product capture after revoke is blocked by the gate itself
//  10. concurrent same-state true calls share one load and one init
//
// Run: node --test scripts/consent-gate-check.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const gateUrl = pathToFileURL(resolve(__dir, '../js/analytics-consent-gate.js')).href;
const { createConsentGate } = await import(gateUrl);

// Deferred promise helper — lets a test control exactly when an async dep
// (loadModule, getSession) resolves, to land other calls "in the middle."
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function makeSdkInstance() {
  const calls = { optIn: 0, optOut: 0, capture: [], identify: [], reset: 0 };
  const instance = {
    opt_in_capturing: () => calls.optIn++,
    opt_out_capturing: () => calls.optOut++,
    capture: (event, props) => calls.capture.push({ event, props }),
    identify: (uid) => calls.identify.push(uid),
    reset: () => calls.reset++,
  };
  return { instance, calls };
}

test('1. true → false while SDK is still loading: no init, no capture', async () => {
  const loadModuleDeferred = deferred();
  let initCalled = 0;
  const { instance, calls } = makeSdkInstance();

  const gate = createConsentGate({
    loadModule: () => loadModuleDeferred.promise,
    getApiKey: () => 'test-key',
    initSdk: () => { initCalled++; return instance; },
    getSession: async () => ({ userId: null }),
  });

  // Fire true, then false WHILE the module import is still pending.
  const p1 = gate.applyConsent({ analytics: true });
  const p2 = gate.applyConsent({ analytics: false });

  // Now let the import resolve — this is what a real CDN fetch completing
  // late (after the user already revoked) looks like.
  loadModuleDeferred.resolve({ default: {} });
  await Promise.all([p1, p2]);

  assert.equal(initCalled, 0, 'initSdk must NEVER be called — consent was false by the time import resolved');
  assert.equal(calls.optIn, 0, 'no opt_in_capturing');
  assert.equal(calls.capture.length, 0, 'no $pageview or any capture');
});

test('2. true → false → true: exactly one init, final state is opt-in', async () => {
  const loadModuleDeferred = deferred();
  let initCalled = 0;
  const { instance, calls } = makeSdkInstance();

  const gate = createConsentGate({
    loadModule: () => loadModuleDeferred.promise,
    getApiKey: () => 'test-key',
    initSdk: () => { initCalled++; return instance; },
    getSession: async () => ({ userId: null }),
  });

  const p1 = gate.applyConsent({ analytics: true });
  const p2 = gate.applyConsent({ analytics: false });
  const p3 = gate.applyConsent({ analytics: true });

  loadModuleDeferred.resolve({ default: {} });
  await Promise.all([p1, p2, p3]);

  assert.equal(initCalled, 1, 'initSdk must be called EXACTLY once, by the winning (3rd) call');
  assert.equal(calls.optIn, 1, 'exactly one opt_in_capturing');
  assert.ok(calls.capture.some((c) => c.event === '$pageview'), 'must capture $pageview');
  assert.equal(gate._getState().hasInstance, true, 'final state: SDK instance exists');
});

test('2b. repeated analytics:true is idempotent: no duplicate opt-in or $pageview', async () => {
  let initCalled = 0;
  const { instance, calls } = makeSdkInstance();

  const gate = createConsentGate({
    loadModule: async () => ({ default: {} }),
    getApiKey: () => 'test-key',
    initSdk: () => { initCalled++; return instance; },
    getSession: async () => ({ userId: null }),
  });

  await gate.applyConsent({ analytics: true });
  await gate.applyConsent({ analytics: true });

  assert.equal(initCalled, 1, 'SDK initializes once');
  assert.equal(calls.optIn, 1, 'same consent state must not opt in twice');
  assert.deepEqual(calls.capture.map((c) => c.event), ['$pageview'], 'same consent state must not create a second pageview');
});

test('2c. concurrent analytics:true calls share one load and initialize once', async () => {
  const loadModuleDeferred = deferred();
  let loadModuleCalls = 0;
  let initCalled = 0;
  const { instance, calls } = makeSdkInstance();

  const gate = createConsentGate({
    loadModule: () => { loadModuleCalls++; return loadModuleDeferred.promise; },
    getApiKey: () => 'test-key',
    initSdk: () => { initCalled++; return instance; },
    getSession: async () => ({ userId: null }),
  });

  const p1 = gate.applyConsent({ analytics: true });
  const p2 = gate.applyConsent({ analytics: true });
  loadModuleDeferred.resolve({ default: {} });
  await Promise.all([p1, p2]);

  assert.equal(loadModuleCalls, 1, 'same-state waiters share the in-flight module load');
  assert.equal(initCalled, 1, 'only one waiter initializes the SDK');
  assert.equal(calls.optIn, 1, 'only one opt-in is emitted');
  assert.deepEqual(calls.capture.map((c) => c.event), ['$pageview'], 'only one initial pageview is emitted');
});

test('3. consent revoked while getSession() is in flight: no identify after', async () => {
  const { instance, calls } = makeSdkInstance();
  const getSessionStarted = deferred(); // resolves the INSTANT getSession() is called
  const getSessionDeferred = deferred(); // controls WHEN getSession() resolves

  const gate = createConsentGate({
    loadModule: async () => ({ default: {} }), // resolves promptly — SDK activates fully first
    getApiKey: () => 'test-key',
    initSdk: () => instance,
    getSession: () => {
      getSessionStarted.resolve();
      return getSessionDeferred.promise;
    },
  });

  // Step 1: kick off full activation (init + opt_in + $pageview, then
  // identifyCurrentUser() calls getSession() and blocks on it).
  const acceptPromise = gate.applyConsent({ analytics: true });

  // Step 2: wait for the EXACT moment getSession() starts — no timing
  // guesses (setImmediate counts, arbitrary delays). getSessionStarted only
  // resolves from inside the getSession() call itself.
  await getSessionStarted.promise;
  assert.equal(calls.optIn, 1, 'setup check: SDK must be fully active before revoking');

  // Step 3: revoke NOW, while that getSession() call is provably still pending.
  await gate.applyConsent({ analytics: false });
  assert.equal(calls.optOut, 1, 'revoke while SDK already active must opt out immediately');

  // Step 4: let the stale getSession() resolve with a real user.
  getSessionDeferred.resolve({ userId: 'user-1' });
  await acceptPromise;

  assert.equal(calls.identify.length, 0, 'identify must NOT fire — consent was revoked before getSession() resolved');
});

test('3b. SIGNED_IN after true→false: instance is still in memory (opt_out does not clear it), but identify must NOT fire — real privacy bug found in review', async () => {
  const { instance, calls } = makeSdkInstance();
  let getSessionCalls = 0;

  const gate = createConsentGate({
    loadModule: async () => ({ default: {} }),
    getApiKey: () => 'test-key',
    initSdk: () => instance,
    getSession: async () => { getSessionCalls++; return { userId: 'user-1' }; },
  });

  // 1. analytics:true — SDK created and identified once.
  await gate.applyConsent({ analytics: true });
  assert.equal(gate._getState().hasInstance, true, 'setup: SDK instance exists');
  assert.equal(calls.identify.length, 1, 'setup: initial consent flow identifies once');

  // 2. analytics:false — instance stays in memory (opt_out does not null it
  // out, by design, so a later re-accept can reuse it), but it received opt_out.
  await gate.applyConsent({ analytics: false });
  assert.equal(calls.optOut, 1, 'setup: revoke opted out');
  assert.equal(gate._getState().hasInstance, true, 'setup: instance is STILL in memory — this is what makes the bug possible');

  // 3. SIGNED_IN fires (e.g. user logs into a different account in the same
  // tab). Naively checking only "!instance" would pass through here and
  // call getSession()+identify() on an opted-out SDK — this is the bug.
  calls.identify.length = 0; // reset counter from step 1
  const getSessionCallsBefore = getSessionCalls;
  await gate.onSignedIn();

  assert.equal(getSessionCalls, getSessionCallsBefore, 'getSession() must NOT be called — consent is currently false');
  assert.equal(calls.identify.length, 0, 'identify must NOT fire — consent is currently false, regardless of instance existing in memory');
});

test('3c. SIGNED_OUT while getSession() is in flight: stale user must not be re-identified', async () => {
  const { instance, calls } = makeSdkInstance();
  const getSessionStarted = deferred();
  const getSessionDeferred = deferred();

  const gate = createConsentGate({
    loadModule: async () => ({ default: {} }),
    getApiKey: () => 'test-key',
    initSdk: () => instance,
    getSession: () => {
      getSessionStarted.resolve();
      return getSessionDeferred.promise;
    },
  });

  const acceptPromise = gate.applyConsent({ analytics: true });
  await getSessionStarted.promise;

  gate.onSignedOut();
  assert.equal(calls.reset, 1, 'sign-out resets the current identity immediately');

  getSessionDeferred.resolve({ userId: 'signed-out-user' });
  await acceptPromise;

  assert.equal(calls.identify.length, 0, 'the stale pre-sign-out session must not identify again');
});

test('4. SIGNED_IN while analytics:false: no identify, no network call', async () => {
  let getSessionCalls = 0;
  const gate = createConsentGate({
    loadModule: async () => ({ default: {} }),
    getApiKey: () => 'test-key',
    initSdk: () => makeSdkInstance().instance,
    getSession: async () => { getSessionCalls++; return { userId: 'user-1' }; },
  });

  // No consent ever given — instance stays null.
  await gate.onSignedIn();

  assert.equal(getSessionCalls, 0, 'getSession() must not even be called when SDK is not active');
});

test('4b. product capture after analytics:false is blocked by the gate', async () => {
  const { instance, calls } = makeSdkInstance();
  const gate = createConsentGate({
    loadModule: async () => ({ default: {} }),
    getApiKey: () => 'test-key',
    initSdk: () => instance,
    getSession: async () => ({ userId: null }),
  });

  await gate.applyConsent({ analytics: true });
  await gate.applyConsent({ analytics: false });
  gate.capture('product_event_after_revoke');

  assert.equal(calls.optOut, 1, 'SDK receives opt-out');
  assert.deepEqual(calls.capture.map((c) => c.event), ['$pageview'], 'no product event is forwarded after revoke');
});

test('5. no API key: the CDN loader is never invoked', async () => {
  let loadModuleCalls = 0;
  const gate = createConsentGate({
    loadModule: () => { loadModuleCalls++; return Promise.resolve({ default: {} }); },
    getApiKey: () => null,
    initSdk: () => makeSdkInstance().instance,
    getSession: async () => ({ userId: null }),
  });

  await gate.applyConsent({ analytics: true });

  assert.equal(loadModuleCalls, 0, 'loadModule must never be called without an API key');
  assert.equal(gate._getState().hasInstance, false, 'no SDK instance without a key');
});

test('6. SDK load failure: the next attempt can retry', async () => {
  let loadModuleCalls = 0;
  let initCalled = 0;
  const { instance } = makeSdkInstance();

  const gate = createConsentGate({
    loadModule: () => {
      loadModuleCalls++;
      if (loadModuleCalls === 1) return Promise.reject(new Error('network error'));
      return Promise.resolve({ default: {} });
    },
    getApiKey: () => 'test-key',
    initSdk: () => { initCalled++; return instance; },
    getSession: async () => ({ userId: null }),
    onLoadError: () => {}, // silence expected warning in test output
  });

  await gate.applyConsent({ analytics: true });
  assert.equal(loadModuleCalls, 1, 'first attempt was made');
  assert.equal(initCalled, 0, 'init not called after a failed load');
  assert.equal(gate._getState().hasInstance, false, 'no instance after failure');

  // Consent flips off then on again — a fresh applyConsent(true) is the only
  // way this module retries (matches real usage: reject then accept again).
  await gate.applyConsent({ analytics: false });
  await gate.applyConsent({ analytics: true });

  assert.equal(loadModuleCalls, 2, 'retry attempted loadModule again — loadInFlight was cleared after the failure');
  assert.equal(initCalled, 1, 'second attempt succeeds and initializes');
});

test('bonus: API key becomes available between two applyConsent(true) calls', async () => {
  let hasKey = false;
  let loadModuleCalls = 0;
  const { instance, calls } = makeSdkInstance();

  const gate = createConsentGate({
    loadModule: () => { loadModuleCalls++; return Promise.resolve({ default: {} }); },
    getApiKey: () => (hasKey ? 'test-key' : null),
    initSdk: () => instance,
    getSession: async () => ({ userId: null }),
  });

  await gate.applyConsent({ analytics: true }); // no key yet
  assert.equal(loadModuleCalls, 0, 'first attempt with no key does not call loadModule');
  assert.equal(gate._getState().hasInstance, false);

  hasKey = true;
  await gate.applyConsent({ analytics: true }); // key now present
  assert.equal(loadModuleCalls, 1, 'second attempt, now with a key, does load the module');
  assert.equal(gate._getState().hasInstance, true);
  assert.equal(calls.optIn, 1);
});
