import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const sql = readFileSync(
  resolve(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260713_1300_scanned_product_name_corrections.sql',
  ),
  'utf8',
)

test('users can read only their own name proposals and cannot write the table directly', () => {
  assert.match(sql, /ALTER TABLE scanned_product_name_corrections ENABLE ROW LEVEL SECURITY/i)
  assert.match(sql, /FOR SELECT\s+USING \(auth\.uid\(\) = user_id\)/i)
  assert.match(
    sql,
    /REVOKE ALL ON TABLE scanned_product_name_corrections FROM public, anon, authenticated/i,
  )
  assert.match(sql, /GRANT SELECT ON TABLE scanned_product_name_corrections TO authenticated/i)
})

test('submission fixes the author to auth uid and cannot update the shared catalogue', () => {
  const submitFunction = sql.split('CREATE OR REPLACE FUNCTION get_scanned_name_corrections')[0]

  assert.match(submitFunction, /v_user_id uuid := auth\.uid\(\)/i)
  assert.match(submitFunction, /barcode, user_id, language, proposed_name, proposed_brand/i)
  assert.match(submitFunction, /p_barcode, v_user_id, p_language, v_name, v_brand/i)
  assert.match(submitFunction, /status = 'pending'/i)
  assert.doesNotMatch(submitFunction, /UPDATE scanned_products/i)
})

test('only admin-reviewed functions can change or reject shared name data', () => {
  for (const functionName of [
    'get_scanned_name_corrections',
    'approve_scanned_name_correction',
    'reject_scanned_name_correction',
  ]) {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${functionName}`)
    const next = sql.indexOf('CREATE OR REPLACE FUNCTION', start + 1)
    const body = sql.slice(start, next === -1 ? undefined : next)

    assert.ok(start >= 0, `${functionName} is present`)
    assert.match(body, /id = auth\.uid\(\) AND is_admin = true/i)
  }
})
