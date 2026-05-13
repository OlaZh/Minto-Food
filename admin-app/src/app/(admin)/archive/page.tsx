import { createClient } from '@/lib/supabase/server'
import ArchiveClient from './ArchiveClient'

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

    const userIds = [...new Set((products ?? []).map((p: any) => p.user_id).filter(Boolean))]
    let profilesMap: Record<string, any> = {}
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name').in('id', userIds)
      profilesMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
    }

    const enriched = (products ?? []).map((p: any) => ({
      ...p, author: profilesMap[p.user_id] ?? null,
    }))

    return <ArchiveClient tab="products" recipes={[]} products={enriched} />
  }

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name_ua, name_en, image, deleted_at, user_id, category')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(100)

  const authorIds = [...new Set((recipes ?? []).map((r: any) => r.user_id).filter(Boolean))]
  let profilesMap: Record<string, any> = {}
  if (authorIds.length) {
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name').in('id', authorIds)
    profilesMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
  }

  const enriched = (recipes ?? []).map((r: any) => ({
    ...r, author: profilesMap[r.user_id] ?? null,
  }))

  return <ArchiveClient tab="recipes" recipes={enriched} products={[]} />
}
