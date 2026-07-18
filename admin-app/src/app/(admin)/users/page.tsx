import { createClient } from '@/lib/supabase/server'
import UsersClient from './UsersClient'

const PAGE_SIZE = 100

type UserRow = {
  id: string
  email: string | null
  full_name: string | null
  is_admin: boolean
  is_banned: boolean
  is_shadow_banned: boolean
  strikes: number | null
  freeze_until: string | null
  created_at: string | null
}

type RecipeOwnerRow = {
  user_id: string
}

type MealActivityRow = {
  user_id: string
  created_at: string
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string | string[] }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q
  const query = (rawQuery ?? '').trim().slice(0, 200)
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let users: UserRow[] = []
  let count = 0
  let searchError: string | null = null

  if (query) {
    const { data, error } = await supabase.rpc('admin_search_users', {
      p_query: query,
      p_limit: PAGE_SIZE,
    })

    if (error) {
      console.error('Failed to search admin users', error)
      searchError = 'Не вдалося виконати пошук. Перевірте, чи застосована міграція пошуку користувачів.'
    } else {
      users = (data ?? []) as UserRow[]
      count = users.length
    }
  } else {
    const { data, count: profilesCount } = await supabase
      .from('profiles')
      .select('id, full_name, is_admin, is_banned, is_shadow_banned, strikes, freeze_until, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    users = ((data ?? []) as Omit<UserRow, 'email'>[]).map(user => ({ ...user, email: null }))
    count = profilesCount ?? 0
  }

  const userIds = users.map(user => user.id)

  const recipeCounts: Record<string, number> = {}
  const lastActiveMap: Record<string, string> = {}

  if (userIds.length) {
    const [{ data: recipeRows }, { data: mealRows }] = await Promise.all([
      supabase.from('recipes').select('user_id').in('user_id', userIds).is('deleted_at', null),
      supabase.from('meals').select('user_id, created_at').in('user_id', userIds).order('created_at', { ascending: false }).limit(500),
    ])

    recipeRows?.forEach((r: RecipeOwnerRow) => {
      recipeCounts[r.user_id] = (recipeCounts[r.user_id] ?? 0) + 1
    })
    mealRows?.forEach((m: MealActivityRow) => {
      if (!lastActiveMap[m.user_id]) lastActiveMap[m.user_id] = m.created_at
    })
  }

  const enriched = users.map(user => ({
    ...user,
    recipeCount: recipeCounts[user.id] ?? 0,
    lastActive: lastActiveMap[user.id] ?? null,
  }))

  const totalCount = count
  const totalPages = query ? 1 : Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <UsersClient
      users={enriched}
      page={query ? 1 : page}
      totalPages={totalPages}
      totalCount={totalCount}
      query={query}
      searchError={searchError}
    />
  )
}
