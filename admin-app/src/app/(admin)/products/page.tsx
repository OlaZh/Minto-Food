import { createClient } from '@/lib/supabase/server'
import ProductsClient from './ProductsClient'

const PAGE_SIZE = 50

interface ProductRow {
  id: number
  name_ua: string | null
  name_en: string | null
  name_pl: string | null
  category_id: number | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  fiber: number | null
  label_type: string | null
  food_state: 'raw' | 'dry' | 'cooked' | null
  raw_edible: string | null
  created_at: string
  user_id: string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const query = params.q?.trim() ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let productsQuery = supabase
    .from('products')
    .select(
      'id, name_ua, name_en, name_pl, category_id, kcal, protein, fat, carbs, fiber, label_type, food_state, raw_edible, created_at, user_id',
      { count: 'exact' }
    )
    .not('user_id', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (query) {
    productsQuery = productsQuery.or(
      `name_ua.ilike.%${query}%,name_en.ilike.%${query}%,name_pl.ilike.%${query}%`
    )
  }

  const { data: products, count, error } = await productsQuery

  const rows = (products ?? []) as ProductRow[]
  const userIds = [...new Set(rows.map((p) => p.user_id).filter(Boolean))] as string[]
  let profilesMap: Record<string, ProfileRow> = {}
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
    profilesMap = Object.fromEntries(
      ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p])
    )
  }

  const enriched = rows.map((p) => ({
    ...p,
    author: p.user_id ? profilesMap[p.user_id] ?? null : null,
  }))

  return (
    <ProductsClient
      products={enriched}
      errorMessage={error?.message ?? null}
      searchQuery={query}
      page={page}
      pageSize={PAGE_SIZE}
      totalCount={count ?? 0}
    />
  )
}
