import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RecipeForm from '@/components/recipes/RecipeForm'
import type { IngredientRow, Recipe } from '@/lib/types'

interface EditRecipePageProps {
  params: Promise<{ id: string }>
}

interface RawIngredientRow {
  ingredient_id: number
  amount: number
  unit: string | null
  product: {
    name_ua: string | null
    name_en: string | null
  } | null
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
    .from('product_recipe')
    .select(`
      ingredient_id, amount, unit,
      product:products(id, name_ua, name_en)
    `)
    .eq('recipe_id', id)

  const ingredients: IngredientRow[] = ((rawIngredients ?? []) as RawIngredientRow[]).map((r) => ({
    product_id: r.ingredient_id,
    product_name: r.product?.name_ua || r.product?.name_en || '',
    quantity: r.amount,
    unit: r.unit ?? 'г',
  }))

  return <RecipeForm recipe={recipe as Recipe} initialIngredients={ingredients} />
}
