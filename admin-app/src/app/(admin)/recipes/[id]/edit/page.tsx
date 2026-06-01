import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RecipeForm from '@/components/recipes/RecipeForm'
import type { IngredientRow, Recipe } from '@/lib/types'

interface EditRecipePageProps {
  params: Promise<{ id: string }>
}

interface RawIngredientProduct {
  name_ua: string | null
  name_en: string | null
}

interface RawIngredientRow {
  ingredient_id: number
  amount: number
  unit: string | null
  product: RawIngredientProduct | RawIngredientProduct[] | null
}

function getIngredientProduct(product: RawIngredientRow['product']) {
  if (Array.isArray(product)) return product[0] ?? null
  return product
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

  const ingredients: IngredientRow[] = ((rawIngredients ?? []) as unknown as RawIngredientRow[]).map((row) => {
    const product = getIngredientProduct(row.product)

    return {
      product_id: row.ingredient_id,
      product_name: product?.name_ua || product?.name_en || '',
      quantity: row.amount,
      unit: row.unit ?? 'г',
    }
  })

  return <RecipeForm recipe={recipe as Recipe} initialIngredients={ingredients} />
}
