import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RecipeForm from '@/components/recipes/RecipeForm'
import type { IngredientRow, Recipe, RecipeAuthorProfile } from '@/lib/types'

type IngredientProductRow = {
  id: number
  name_ua: string | null
  name_en: string | null
}

type ProductRecipeRow = {
  ingredient_id: number
  amount: number
  unit: string | null
  product: IngredientProductRow | IngredientProductRow[] | null
}

function getIngredientProduct(value: ProductRecipeRow['product']): IngredientProductRow | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getAuthorProfile(value: unknown): RecipeAuthorProfile | undefined {
  if (Array.isArray(value)) return value[0] as RecipeAuthorProfile | undefined
  return value as RecipeAuthorProfile | undefined
}

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
    .from('product_recipe')
    .select(`
      ingredient_id, amount, unit,
      product:products(id, name_ua, name_en)
    `)
    .eq('recipe_id', id)

  const ingredients: IngredientRow[] = (rawIngredients ?? []).map((row: ProductRecipeRow) => {
    const product = getIngredientProduct(row.product)

    return {
      product_id: row.ingredient_id,
      product_name: product?.name_ua || product?.name_en || '',
      quantity: row.amount,
      unit: row.unit ?? 'г',
    }
  })

  const normalizedRecipe: Recipe = {
    ...(recipe as Recipe),
    author_profile: getAuthorProfile((recipe as { author_profile?: unknown }).author_profile),
  }

  return <RecipeForm recipe={normalizedRecipe} initialIngredients={ingredients} />
}
