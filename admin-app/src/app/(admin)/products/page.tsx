import { createClient } from '@/lib/supabase/server'
import ProductsClient from './ProductsClient'

export default async function ProductsPage() {
  const supabase = await createClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, name_ua, name_en, category_id, kcal, protein, fat, carbs, fiber, label_type, food_state, raw_edible, created_at, user_id')
    .not('user_id', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const userIds = [...new Set((products ?? []).map((p: any) => p.user_id).filter(Boolean))]
  let profilesMap: Record<string, any> = {}
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
    profilesMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
  }

  const enriched = (products ?? []).map((p: any) => ({
    ...p,
    author: profilesMap[p.user_id] ?? null,
  }))

  return <ProductsClient products={enriched} />
}
