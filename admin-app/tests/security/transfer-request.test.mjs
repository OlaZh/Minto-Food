import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getTransferRequestFormat,
  isAllowedTransferOrigin,
} from '../../src/lib/security/transfer-request.ts'

const mainSiteOrigin = 'https://minto.example.com'
const adminOrigin = 'https://admin.example.com'

test('recognizes navigation forms and legacy JSON requests', () => {
  assert.equal(getTransferRequestFormat('application/x-www-form-urlencoded'), 'form')
  assert.equal(getTransferRequestFormat('multipart/form-data; boundary=test'), 'form')
  assert.equal(getTransferRequestFormat('application/json; charset=utf-8'), 'json')
  assert.equal(getTransferRequestFormat('text/plain'), 'unsupported')
})

test('allows form transfer only from the configured main site', () => {
  assert.equal(isAllowedTransferOrigin({
    format: 'form',
    requestOrigin: mainSiteOrigin,
    mainSiteOrigin,
    adminOrigin,
  }), true)

  assert.equal(isAllowedTransferOrigin({
    format: 'form',
    requestOrigin: 'https://evil.example.com',
    mainSiteOrigin,
    adminOrigin,
  }), false)
})

test('allows legacy JSON transfer only from the admin origin', () => {
  assert.equal(isAllowedTransferOrigin({
    format: 'json',
    requestOrigin: adminOrigin,
    mainSiteOrigin,
    adminOrigin,
  }), true)

  assert.equal(isAllowedTransferOrigin({
    format: 'json',
    requestOrigin: mainSiteOrigin,
    mainSiteOrigin,
    adminOrigin,
  }), false)
})
