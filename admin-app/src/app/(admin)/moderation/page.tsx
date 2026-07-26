import { createClient } from '@/lib/supabase/server'
import ModerationClient from './ModerationClient'

type ModerationRecipeRow = {
  id: string
  slug: string | null
  name_ua: string | null
  name_en: string | null
  image: string | null
  status: string
  created_at: string | null
  category: string | null
  user_id: string | null
  kcal: number | null
  steps: unknown
  is_public: boolean | null
  is_image_flagged: boolean | null
  image_nsfw_score: number | null
  has_pending_update: boolean | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  is_banned: boolean
  is_shadow_banned: boolean
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

export default async function ModerationPage() {
  const supabase = await createClient()

  // Queue = everything pending, PLUS any auto-flagged photo (even a private
  // draft), PLUS any recipe with staged changes awaiting review
  // (has_pending_update) — a clean new photo or edited name/steps on a published
  // recipe must be visible to the admin, not silently stuck in the DB.
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, slug, name_ua, name_en, image, status, created_at, category, user_id, kcal, steps, is_public, is_image_flagged, image_nsfw_score, has_pending_update')
    .or('status.eq.pending,is_image_flagged.eq.true,has_pending_update.eq.true')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const userIds = [...new Set((recipes ?? []).map((recipe: ModerationRecipeRow) => recipe.user_id).filter((value): value is string => Boolean(value)))]
  let profilesMap: Record<string, EnrichedProfile> = {}

  if (userIds.length) {
    const [{ data: profiles }, { data: recipesData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, is_banned, is_shadow_banned, strikes, created_at')
        .in('id', userIds),
      supabase
        .from('recipes')
        .select('id, user_id')
        .in('user_id', userIds)
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

  // Staged photos: when a PUBLISHED recipe is edited with a new photo, the new
  // photo lives in recipe_pending_updates.changes.image (not the live recipe).
  // Pull the latest staged image per recipe so the admin reviews the exact
  // photo that was moderated, not the old live one.
  const stagedImageMap: Record<string, string> = {}
  const flaggedIds = (recipes ?? [])
    .filter((r: ModerationRecipeRow) => r.is_image_flagged || r.has_pending_update)
    .map((r: ModerationRecipeRow) => r.id)
  if (flaggedIds.length) {
    const { data: pending } = await supabase
      .from('recipe_pending_updates')
      .select('recipe_id, changes, created_at')
      .in('recipe_id', flaggedIds)
      .order('created_at', { ascending: false })
    for (const row of (pending ?? []) as { recipe_id: number; changes: { image?: string } | null }[]) {
      const key = String(row.recipe_id)
      // first (newest) staged image wins
      if (!(key in stagedImageMap) && row.changes?.image) {
        stagedImageMap[key] = row.changes.image
      }
    }
  }

  const enriched = (recipes ?? []).map((recipe: ModerationRecipeRow) => ({
    ...recipe,
    author: recipe.user_id ? (profilesMap[recipe.user_id] ?? null) : null,
    staged_image: stagedImageMap[String(recipe.id)] ?? null,
  }))

  return <ModerationClient recipes={enriched} />
}
