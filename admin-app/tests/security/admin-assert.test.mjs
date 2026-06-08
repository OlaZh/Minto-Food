import assert from 'node:assert/strict'
import test from 'node:test'
import { getAssertAdminErrorMessage } from '../../src/lib/security/admin-assert.ts'

test('returns session error message when session cannot be loaded', () => {
  const result = getAssertAdminErrorMessage({
    sessionErrorMessage: 'jwt expired',
    hasUser: false,
    profileErrorMessage: null,
    isAdmin: false,
  })

  assert.equal(result, 'Не вдалося отримати сесію: jwt expired')
})

test('requires signed-in admin session', () => {
  const result = getAssertAdminErrorMessage({
    sessionErrorMessage: null,
    hasUser: false,
    profileErrorMessage: null,
    isAdmin: false,
  })

  assert.equal(result, 'Потрібно увійти як адміністратор')
})

test('surfaces profile lookup failure', () => {
  const result = getAssertAdminErrorMessage({
    sessionErrorMessage: null,
    hasUser: true,
    profileErrorMessage: 'row not found',
    isAdmin: false,
  })

  assert.equal(result, 'Не вдалося перевірити права адміністратора: row not found')
})

test('blocks non-admin users', () => {
  const result = getAssertAdminErrorMessage({
    sessionErrorMessage: null,
    hasUser: true,
    profileErrorMessage: null,
    isAdmin: false,
  })

  assert.equal(result, 'Дію дозволено лише адміністраторам')
})

test('returns null for valid admin session', () => {
  const result = getAssertAdminErrorMessage({
    sessionErrorMessage: null,
    hasUser: true,
    profileErrorMessage: null,
    isAdmin: true,
  })

  assert.equal(result, null)
})
