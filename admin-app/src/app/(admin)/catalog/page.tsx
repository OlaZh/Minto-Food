import { createClient } from '@/lib/supabase/server'
import CatalogClient from './CatalogClient'

export default async function CatalogPage() {
  const supabase = await createClient()

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name_ua, name_en, name_pl, category_id, kcal, protein, fat, carbs, fiber, food_state, raw_edible, label_type')
      .is('deleted_at', null)
      .order('name_ua', { ascending: true }),
    supabase
      .from('categories')
      .select('id, name_ua')
      .order('id'),
  ])

  return <CatalogClient products={products ?? []} categories={categories ?? []} />
}
