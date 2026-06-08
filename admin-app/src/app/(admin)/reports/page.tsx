import { createClient } from '@/lib/supabase/server'
import ReportsClient from './ReportsClient'

type ReportRecipeRow = {
  id: string
  slug: string | null
  name_ua: string | null
  name_en: string | null
  image: string | null
  status: string
  user_id: string | null
  category: string | null
}

type ReportRow = {
  id: string
  reason: string | null
  admin_notes: string | null
  created_at: string | null
  status: string
  recipe_id: string | null
  reporter_id: string | null
  recipe: ReportRecipeRow | ReportRecipeRow[] | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  is_banned: boolean
  strikes: number | null
  created_at: string | null
}

type RecipeOwnerRow = {
  id: string
  user_id: string
}

type ReportCountRow = {
  recipe_id: string
}

type EnrichedProfile = ProfileRow & {
  recipe_count: number
  report_count: number
}

function getRecipe(value: ReportRow['recipe']): ReportRecipeRow | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
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

  const normalizedReports = (reports ?? []).map((report: ReportRow) => ({
    ...report,
    recipe: getRecipe(report.recipe),
  }))

  const authorIds = [...new Set(normalizedReports.map(report => report.recipe?.user_id).filter((value): value is string => Boolean(value)))]
  const reporterIds = [...new Set(normalizedReports.map(report => report.reporter_id).filter((value): value is string => Boolean(value)))]
  const allIds = [...new Set([...authorIds, ...reporterIds])]

  let profilesMap: Record<string, EnrichedProfile> = {}

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
    for (const r of (recipesData ?? []) as RecipeOwnerRow[]) {
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
      for (const rep of (reportsData ?? []) as ReportCountRow[]) {
        const uid = recipeIdToUserId[rep.recipe_id]
        if (uid) reportCountMap[uid] = (reportCountMap[uid] ?? 0) + 1
      }
    }

    profilesMap = Object.fromEntries(
      (profiles ?? []).map((p: ProfileRow) => [p.id, {
        ...p,
        recipe_count: recipeCountMap[p.id] ?? 0,
        report_count: reportCountMap[p.id] ?? 0,
      }])
    )
  }

  const enriched = normalizedReports.map(report => ({
    ...report,
    recipe: report.recipe ? { ...report.recipe, author: report.recipe.user_id ? (profilesMap[report.recipe.user_id] ?? null) : null } : null,
    reporter: report.reporter_id ? (profilesMap[report.reporter_id] ?? null) : null,
  }))

  return <ReportsClient reports={enriched} currentStatus={status} />
}
