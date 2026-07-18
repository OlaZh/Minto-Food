import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const migration = readFileSync(
  resolve(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260718_1300_admin_user_search.sql',
  ),
  'utf8',
)

const usersPage = readFileSync(
  resolve(process.cwd(), 'src', 'app', '(admin)', 'users', 'page.tsx'),
  'utf8',
)

test('user search reads auth emails only inside an admin-guarded security definer function', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_search_users/i)
  assert.match(migration, /SECURITY DEFINER/i)
  assert.match(migration, /auth\.uid\(\) IS NULL OR NOT EXISTS/i)
  assert.match(migration, /admin_profile\.id = auth\.uid\(\)[\s\S]*admin_profile\.is_admin = true/i)
  assert.match(migration, /FROM auth\.users auth_user[\s\S]*JOIN public\.profiles profile/i)
})

test('user search is unavailable to public and anonymous callers', () => {
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.admin_search_users\(text, integer\) FROM PUBLIC, anon/i,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.admin_search_users\(text, integer\) TO authenticated/i,
  )
})

test('admin users page delegates global name and email search to the guarded RPC', () => {
  assert.match(usersPage, /supabase\.rpc\('admin_search_users'/i)
  assert.match(usersPage, /p_query: query/i)
  assert.match(usersPage, /query = \(rawQuery \?\? ''\)\.trim\(\)\.slice\(0, 200\)/i)
})
