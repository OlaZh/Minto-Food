import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function assertAdmin(supabase: SupabaseClient) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    throw new Error(`Не вдалося отримати сесію: ${sessionError.message}`)
  }

  if (!session?.user) {
    throw new Error('Потрібно увійти як адміністратор')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (profileError) {
    throw new Error(`Не вдалося перевірити права адміністратора: ${profileError.message}`)
  }

  if (!profile?.is_admin) {
    throw new Error('Дію дозволено лише адміністраторам')
  }

  return session.user
}
