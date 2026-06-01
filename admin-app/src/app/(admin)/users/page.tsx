import { createClient } from '@/lib/supabase/server'
import UsersClient from './UsersClient'

const PAGE_SIZE = 50

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const query = params.q?.trim() ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const [
    { data: users, error },
    { count: adminCount },
    { data: { session } },
  ] = await Promise.all([
    supabase.rpc('admin_search_users', {
      p_query: query || null,
      p_offset: offset,
      p_limit: PAGE_SIZE,
    }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', true),
    supabase.auth.getSession(),
  ])

  const rows = users ?? []
  const totalCount = rows[0]?.total_count ?? 0

  return (
    <UsersClient
      users={rows}
      errorMessage={error?.message ?? null}
      searchQuery={query}
      page={page}
      pageSize={PAGE_SIZE}
      totalCount={totalCount}
      currentUserId={session?.user?.id ?? null}
      adminCount={adminCount ?? 0}
    />
  )
}
