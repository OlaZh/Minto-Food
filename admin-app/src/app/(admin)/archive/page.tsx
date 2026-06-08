import { createClient } from '@/lib/supabase/server'
import ArchiveClient from './ArchiveClient'

type ArchiveProfile = {
  id: string
  full_name: string | null
}

type ArchivedProductRow = {
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

type ArchivedRecipeRow = {
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

    const userIds = [...new Set((products ?? []).map((product: ArchivedProductRow) => product.user_id).filter((value): value is string => Boolean(value)))]
    let profilesMap: Record<string, ArchiveProfile> = {}
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name').in('id', userIds)
      profilesMap = Object.fromEntries((profiles ?? []).map((profile: ArchiveProfile) => [profile.id, profile]))
    }

    const enriched = (products ?? []).map((product: ArchivedProductRow) => ({
      ...product, author: product.user_id ? (profilesMap[product.user_id] ?? null) : null,
    }))

    return <ArchiveClient tab="products" recipes={[]} products={enriched} />
  }

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name_ua, name_en, image, deleted_at, user_id, category')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(100)

  const authorIds = [...new Set((recipes ?? []).map((recipe: ArchivedRecipeRow) => recipe.user_id).filter((value): value is string => Boolean(value)))]
  let profilesMap: Record<string, ArchiveProfile> = {}
  if (authorIds.length) {
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name').in('id', authorIds)
    profilesMap = Object.fromEntries((profiles ?? []).map((profile: ArchiveProfile) => [profile.id, profile]))
  }

  const enriched = (recipes ?? []).map((recipe: ArchivedRecipeRow) => ({
    ...recipe, author: recipe.user_id ? (profilesMap[recipe.user_id] ?? null) : null,
  }))

  return <ArchiveClient tab="recipes" recipes={enriched} products={[]} />
}
