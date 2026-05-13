import { createClient } from '@/lib/supabase/server'
import ModerationClient from './ModerationClient'

export default async function ModerationPage() {
  const supabase = await createClient()

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name_ua, name_en, image, status, created_at, category, user_id, kcal, steps')
    .eq('status', 'pending')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const userIds = [...new Set((recipes ?? []).map((r: any) => r.user_id).filter(Boolean))]
  let profilesMap: Record<string, any> = {}
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, is_shadow_banned, strikes')
      .in('id', userIds)
    profilesMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
  }

  const enriched = (recipes ?? []).map((r: any) => ({
    ...r,
    author: profilesMap[r.user_id] ?? null,
  }))

  return <ModerationClient recipes={enriched} />
}
