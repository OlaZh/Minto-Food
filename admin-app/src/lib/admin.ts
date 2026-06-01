import type { User } from '@supabase/supabase-js'

type AdminSupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

export function assertNoError(
  error: { message?: string } | null,
  fallbackMessage = 'Сталася помилка під час виконання адмін-дії.'
) {
  if (error) {
    throw new Error(error.message || fallbackMessage)
  }
}

export async function requireAdminUser(
  supabase: AdminSupabaseClient
): Promise<User> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  assertNoError(sessionError, 'Не вдалося перевірити адмін-сесію.')

  if (!session?.user) {
    throw new Error('Потрібно увійти в адмін-акаунт.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .maybeSingle()

  assertNoError(profileError, 'Не вдалося перевірити права доступу.')

  if (!profile?.is_admin) {
    throw new Error('Недостатньо прав для цієї дії.')
  }

  return session.user
}

export async function logAdminAction(
  supabase: AdminSupabaseClient,
  adminId: string,
  table: string,
  targetId: string,
  action: string,
  payload?: object
) {
  const { error } = await supabase.from('admin_actions').insert({
    admin_id: adminId,
    target_table: table,
    target_id: targetId,
    action_type: action,
    payload: payload ?? null,
  })

  assertNoError(error, 'Не вдалося записати дію в аудит.')
}
