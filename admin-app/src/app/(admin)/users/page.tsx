import { createClient } from '@/lib/supabase/server'
import UsersClient from './UsersClient'

export default async function UsersPage() {
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, is_admin, is_banned, is_shadow_banned, strikes, freeze_until, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const userIds = (users ?? []).map((u: any) => u.id)

  let recipeCounts: Record<string, number> = {}
  let lastActiveMap: Record<string, string> = {}

  if (userIds.length) {
    const [{ data: recipeRows }, { data: mealRows }] = await Promise.all([
      supabase.from('recipes').select('user_id').in('user_id', userIds).is('deleted_at', null),
      supabase.from('meals').select('user_id, created_at').in('user_id', userIds).order('created_at', { ascending: false }).limit(500),
    ])

    recipeRows?.forEach((r: any) => {
      recipeCounts[r.user_id] = (recipeCounts[r.user_id] ?? 0) + 1
    })
    mealRows?.forEach((m: any) => {
      if (!lastActiveMap[m.user_id]) lastActiveMap[m.user_id] = m.created_at
    })
  }

  const enriched = (users ?? []).map((u: any) => ({
    ...u,
    recipeCount: recipeCounts[u.id] ?? 0,
    lastActive: lastActiveMap[u.id] ?? null,
  }))

  return <UsersClient users={enriched} />
}
