import { createClient } from '@/lib/supabase/server'
import ReportsClient from './ReportsClient'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status = 'pending' } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('recipe_reports')
    .select(`
      id, reason, admin_notes, created_at, status, recipe_id, reporter_id,
      recipe:recipes(id, name_ua, name_en, image, status, user_id, category)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status !== 'all') query = query.eq('status', status)

  const { data: reports } = await query

  // Batch-load profiles
  const authorIds = [...new Set((reports ?? []).map((r: any) => r.recipe?.user_id).filter(Boolean))]
  const reporterIds = [...new Set((reports ?? []).map((r: any) => r.reporter_id).filter(Boolean))]
  const allIds = [...new Set([...authorIds, ...reporterIds])]

  let profilesMap: Record<string, any> = {}
  if (allIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, is_banned, strikes')
      .in('id', allIds)
    profilesMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
  }

  const enriched = (reports ?? []).map((r: any) => ({
    ...r,
    recipe: r.recipe ? { ...r.recipe, author: profilesMap[r.recipe.user_id] ?? null } : null,
    reporter: profilesMap[r.reporter_id] ?? null,
  }))

  return <ReportsClient reports={enriched} currentStatus={status} />
}
