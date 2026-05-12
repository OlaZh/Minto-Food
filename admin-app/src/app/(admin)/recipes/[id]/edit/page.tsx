import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RecipeForm from '@/components/recipes/RecipeForm'
import type { IngredientRow } from '@/lib/types'

interface EditRecipePageProps {
  params: Promise<{ id: string }>
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: recipe, error } = await supabase
    .from('recipes')
    .select(`
      *,
      author_profile:recipe_author_profiles(*)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !recipe) notFound()

  const { data: rawIngredients } = await supabase
    .from('recipe_ingredients_raw')
    .select(`
      product_id, quantity, unit,
      product:products(id, name_ua, name_en)
    `)
    .eq('recipe_id', id)
    .eq('parsed_success', true)

  const ingredients: IngredientRow[] = (rawIngredients ?? []).map((r: any) => ({
    product_id: r.product_id,
    product_name: r.product?.name_ua || r.product?.name_en || '',
    quantity: r.quantity,
    unit: r.unit ?? 'г',
  }))

  return <RecipeForm recipe={recipe as any} initialIngredients={ingredients} />
}
