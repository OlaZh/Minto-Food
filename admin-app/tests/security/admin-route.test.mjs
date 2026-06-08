import assert from 'node:assert/strict'
import test from 'node:test'
import { getAdminRouteDecision, isPublicAdminPath } from '../../src/lib/security/admin-route.ts'

test('public admin paths bypass auth checks', () => {
  assert.equal(isPublicAdminPath('/login'), true)
  assert.equal(isPublicAdminPath('/unauthorized'), true)
  assert.equal(isPublicAdminPath('/auth/transfer'), true)
  assert.equal(isPublicAdminPath('/dashboard'), false)
})

test('anonymous user is redirected to login on protected routes', () => {
  const decision = getAdminRouteDecision({
    pathname: '/dashboard',
    hasUser: false,
    isAdmin: false,
  })

  assert.equal(decision, 'redirect-login')
})

test('logged-in non-admin is redirected to unauthorized on protected routes', () => {
  const decision = getAdminRouteDecision({
    pathname: '/reports',
    hasUser: true,
    isAdmin: false,
  })

  assert.equal(decision, 'redirect-unauthorized')
})

test('admin can access protected routes', () => {
  const decision = getAdminRouteDecision({
    pathname: '/users',
    hasUser: true,
    isAdmin: true,
  })

  assert.equal(decision, 'allow')
})
