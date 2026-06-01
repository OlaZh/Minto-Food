import { createClient } from '@/lib/supabase/server'
import ArchiveClient from './ArchiveClient'

interface ProfileSummary {
  id: string
  full_name: string | null
}

interface ArchivedProductRow {
  id: number
  name_ua: string | null
  name_en: string | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  deleted_at: string | null
  user_id: string | null
}

interface ArchivedRecipeRow {
  id: string
  name_ua: string | null
  name_en: string | null
  image: string | null
  deleted_at: string | null
  user_id: string | null
  category: string | null
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'recipes' } = await searchParams
  const supabase = await createClient()

  if (tab === 'products') {
    const { data: products } = await supabase
      .from('products')
      .select('id, name_ua, name_en, kcal, protein, fat, carbs, deleted_at, user_id')
      .not('deleted_at', 'is', null)
      .not('user_id', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(100)

    const rows = (products ?? []) as ArchivedProductRow[]
    const userIds = [...new Set(rows.map((p) => p.user_id).filter(Boolean))] as string[]
    let profilesMap: Record<string, ProfileSummary> = {}
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name').in('id', userIds)
      profilesMap = Object.fromEntries(
        ((profiles ?? []) as ProfileSummary[]).map((p) => [p.id, p])
      )
    }

    const enriched = rows.map((p) => ({
      ...p,
      author: p.user_id ? profilesMap[p.user_id] ?? null : null,
    }))

    return <ArchiveClient tab="products" recipes={[]} products={enriched} />
  }

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name_ua, name_en, image, deleted_at, user_id, category')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(100)

  const rows = (recipes ?? []) as ArchivedRecipeRow[]
  const authorIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
  let profilesMap: Record<string, ProfileSummary> = {}
  if (authorIds.length) {
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name').in('id', authorIds)
    profilesMap = Object.fromEntries(
      ((profiles ?? []) as ProfileSummary[]).map((p) => [p.id, p])
    )
  }

  const enriched = rows.map((r) => ({
    ...r,
    author: r.user_id ? profilesMap[r.user_id] ?? null : null,
  }))

  return <ArchiveClient tab="recipes" recipes={enriched} products={[]} />
}
