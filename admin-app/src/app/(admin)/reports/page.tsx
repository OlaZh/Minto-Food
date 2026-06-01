import { createClient } from '@/lib/supabase/server'
import ReportsClient from './ReportsClient'

interface ReportRecipeRow {
  id: string
  slug: string | null
  name_ua: string | null
  name_en: string | null
  image: string | null
  status: string
  user_id: string | null
  category: string | null
}

interface ReportRow {
  id: string
  reason: string | null
  admin_notes: string | null
  created_at: string
  status: string
  recipe_id: string | null
  reporter_id: string | null
  recipe: ReportRecipeRow | ReportRecipeRow[] | null
}

interface ProfileSummary {
  id: string
  full_name: string | null
  is_banned: boolean
  strikes: number
  created_at: string
}

function getReportRecipe(recipe: ReportRow['recipe']) {
  if (Array.isArray(recipe)) return recipe[0] ?? null
  return recipe ?? null
}

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
  const rows = (reports ?? []) as unknown as ReportRow[]

  const authorIds = [...new Set(rows.map((r) => getReportRecipe(r.recipe)?.user_id).filter(Boolean))] as string[]
  const reporterIds = [...new Set(rows.map((r) => r.reporter_id).filter(Boolean))] as string[]
  const allIds = [...new Set([...authorIds, ...reporterIds])]

  let profilesMap: Record<string, ProfileSummary & { recipe_count: number; report_count: number }> = {}

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
      if (!r.user_id) continue
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
      ((profiles ?? []) as ProfileSummary[]).map((p) => [p.id, {
        ...p,
        recipe_count: recipeCountMap[p.id] ?? 0,
        report_count: reportCountMap[p.id] ?? 0,
      }])
    )
  }

  const enriched = rows.map((r) => {
    const recipe = getReportRecipe(r.recipe)
    const recipeAuthorId = recipe?.user_id ?? null

    return {
      ...r,
      recipe: recipe
        ? {
            ...recipe,
            author: recipeAuthorId ? profilesMap[recipeAuthorId] ?? null : null,
          }
        : null,
      reporter: r.reporter_id ? profilesMap[r.reporter_id] ?? null : null,
    }
  })

  return <ReportsClient reports={enriched} currentStatus={status} />
}
