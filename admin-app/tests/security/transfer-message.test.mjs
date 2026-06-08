import assert from 'node:assert/strict'
import test from 'node:test'
import { validateTransferMessage } from '../../src/lib/security/transfer-message.ts'

const allowedOrigin = 'https://minto.example.com'

test('ignores messages from unexpected origins', () => {
  const result = validateTransferMessage({
    allowedOrigin,
    eventOrigin: 'https://evil.example.com',
    data: {
      type: 'MINTO_ADMIN_SESSION_TRANSFER',
      accessToken: 'a',
      refreshToken: 'b',
    },
  })

  assert.deepEqual(result, { status: 'ignore' })
})

test('ignores unrelated postMessage payloads', () => {
  const result = validateTransferMessage({
    allowedOrigin,
    eventOrigin: allowedOrigin,
    data: {
      type: 'SOMETHING_ELSE',
      accessToken: 'a',
      refreshToken: 'b',
    },
  })

  assert.deepEqual(result, { status: 'ignore' })
})

test('returns readable error when tokens are missing', () => {
  const result = validateTransferMessage({
    allowedOrigin,
    eventOrigin: allowedOrigin,
    data: {
      type: 'MINTO_ADMIN_SESSION_TRANSFER',
      accessToken: 'a',
    },
  })

  assert.deepEqual(result, {
    status: 'error',
    message: 'Не вистачає токенів для входу в адмінку',
  })
})

test('accepts valid secure transfer payload', () => {
  const result = validateTransferMessage({
    allowedOrigin,
    eventOrigin: allowedOrigin,
    data: {
      type: 'MINTO_ADMIN_SESSION_TRANSFER',
      accessToken: 'access',
      refreshToken: 'refresh',
    },
  })

  assert.deepEqual(result, {
    status: 'accept',
    accessToken: 'access',
    refreshToken: 'refresh',
  })
})
