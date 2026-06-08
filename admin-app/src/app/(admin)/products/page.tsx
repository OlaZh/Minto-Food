import { createClient } from '@/lib/supabase/server'
import ProductsClient from './ProductsClient'

const PAGE_SIZE = 100

type ProductRow = {
  id: number
  name_ua: string | null
  name_en: string | null
  category_id: string | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  fiber: number | null
  label_type: string | null
  food_state: string | null
  raw_edible: string | null
  created_at: string | null
  user_id: string | null
}

type ProfileRow = {
  id: string
  full_name: string | null
}

function normalizeFoodState(value: string | null): 'raw' | 'dry' | 'cooked' | null {
  return value === 'raw' || value === 'dry' || value === 'cooked' ? value : null
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: products, count } = await supabase
    .from('products')
    .select('id, name_ua, name_en, category_id, kcal, protein, fat, carbs, fiber, label_type, food_state, raw_edible, created_at, user_id', { count: 'exact' })
    .not('user_id', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  const userIds = [...new Set((products ?? []).map((p: ProductRow) => p.user_id).filter(Boolean))] as string[]
  let profilesMap: Record<string, ProfileRow> = {}
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
    profilesMap = Object.fromEntries((profiles ?? []).map((p: ProfileRow) => [p.id, p]))
  }

  const enriched = (products ?? []).map((p: ProductRow) => ({
    ...p,
    food_state: normalizeFoodState(p.food_state),
    author: p.user_id ? (profilesMap[p.user_id] ?? null) : null,
  }))

  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return <ProductsClient products={enriched} page={page} totalPages={totalPages} totalCount={totalCount} />
}
