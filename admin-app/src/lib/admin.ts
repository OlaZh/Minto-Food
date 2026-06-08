import { createClient } from '@/lib/supabase/server'
import { getAssertAdminErrorMessage } from '@/lib/security/admin-assert'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function assertAdmin(supabase: SupabaseClient) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  const { data: profile, error: profileError } = session?.user
    ? await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()
    : { data: null, error: null }

  const errorMessage = getAssertAdminErrorMessage({
    sessionErrorMessage: sessionError?.message,
    hasUser: Boolean(session?.user),
    profileErrorMessage: profileError?.message,
    isAdmin: Boolean(profile?.is_admin),
  })

  if (errorMessage) {
    throw new Error(errorMessage)
  }

  return session!.user
}
