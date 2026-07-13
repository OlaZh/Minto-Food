import { createClient } from '@/lib/supabase/server'
import ScannedProductsClient, { type ScannedProductListItem } from './ScannedProductsClient'

const PAGE_SIZE = 100

export default async function ScannedProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, count, error } = await supabase
    .from('scanned_products')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to)

  const products = (data ?? []) as ScannedProductListItem[]
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <ScannedProductsClient
      products={products}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
      error={error?.message ?? null}
    />
  )
}
