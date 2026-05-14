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
      recipe:recipes(id, slug, name_ua, name_en, image, status, user_id, category)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status !== 'all') query = query.eq('status', status)

  const { data: reports } = await query

  const authorIds = [...new Set((reports ?? []).map((r: any) => r.recipe?.user_id).filter(Boolean))]
  const reporterIds = [...new Set((reports ?? []).map((r: any) => r.reporter_id).filter(Boolean))]
  const allIds = [...new Set([...authorIds, ...reporterIds])]

  let profilesMap: Record<string, any> = {}

  if (allIds.length) {
    const [{ data: profiles }, { data: recipesData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, is_banned, strikes, created_at')
        .in('id', allIds),
      supabase
        .from('recipes')
        .select('id, user_id')
        .in('user_id', authorIds)
        .is('deleted_at', null),
    ])

    const recipeCountMap: Record<string, number> = {}
    const recipeIdToUserId: Record<string, string> = {}
    for (const r of recipesData ?? []) {
      recipeCountMap[r.user_id] = (recipeCountMap[r.user_id] ?? 0) + 1
      recipeIdToUserId[r.id] = r.user_id
    }

    const allRecipeIds = Object.keys(recipeIdToUserId)
    const reportCountMap: Record<string, number> = {}
    if (allRecipeIds.length) {
      const { data: reportsData } = await supabase
        .from('recipe_reports')
        .select('recipe_id')
        .in('recipe_id', allRecipeIds)
      for (const rep of reportsData ?? []) {
        const uid = recipeIdToUserId[rep.recipe_id]
        if (uid) reportCountMap[uid] = (reportCountMap[uid] ?? 0) + 1
      }
    }

    profilesMap = Object.fromEntries(
      (profiles ?? []).map((p: any) => [p.id, {
        ...p,
        recipe_count: recipeCountMap[p.id] ?? 0,
        report_count: reportCountMap[p.id] ?? 0,
      }])
    )
  }

  const enriched = (reports ?? []).map((r: any) => ({
    ...r,
    recipe: r.recipe ? { ...r.recipe, author: profilesMap[r.recipe.user_id] ?? null } : null,
    reporter: profilesMap[r.reporter_id] ?? null,
  }))

  return <ReportsClient reports={enriched} currentStatus={status} />
}
