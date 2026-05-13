'use server'

import { createClient } from '@/lib/supabase/server'
import { generateRecipeTags } from '@/lib/auto-tags'
import { revalidatePath } from 'next/cache'
import type { IngredientRow } from '@/lib/types'

export interface RecipePayload {
  name_ua: string
  name_en?: string
  name_pl?: string
  short_desc?: string
  short_desc_en?: string
  short_desc_pl?: string
  steps?: string
  steps_en?: string
  steps_pl?: string
  type?: string
  category?: string
  cooking_method?: string
  difficulty?: string
  prep_time_min?: number
  cook_time_min?: number
  kcal?: number
  protein?: number
  fat?: number
  carbs?: number
  total_weight?: number
  yield_ratio?: number
  recipe_yield?: number
  status: 'draft' | 'scheduled' | 'published' | 'pending' | 'rejected'
  is_public?: boolean
  image?: string
  available_locales?: string[]
  publish_at?: string | null
  author_profile_id?: string | null
}

export async function createRecipe(
  payload: RecipePayload,
  ingredients: IngredientRow[]
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()

  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert({ ...payload, user_id: null })
    .select('id')
    .single()

  if (error || !recipe) return { error: error?.message ?? 'Insert failed' }

  await syncIngredients(recipe.id, ingredients)
  await syncTags(recipe.id, payload, ingredients)

  revalidatePath('/recipes')
  return { id: recipe.id }
}

export async function updateRecipe(
  id: string,
  payload: Partial<RecipePayload>,
  ingredients: IngredientRow[]
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('recipes')
    .update(payload)
    .eq('id', id)

  if (error) return { error: error.message }

  await syncIngredients(id, ingredients)
  await syncTags(id, payload as RecipePayload, ingredients)

  revalidatePath('/recipes')
  revalidatePath(`/recipes/${id}/edit`)
  return { ok: true }
}

async function syncIngredients(recipeId: string, ingredients: IngredientRow[]) {
  const supabase = await createClient()

  await supabase.from('product_recipe').delete().eq('recipe_id', recipeId)

  if (!ingredients.length) return

  const rows = ingredients
    .filter(ing => ing.product_id)
    .map(ing => ({
      recipe_id: recipeId,
      ingredient_id: ing.product_id,
      amount: ing.quantity,
      unit: ing.unit,
    }))

  if (rows.length) await supabase.from('product_recipe').insert(rows)
}

async function syncTags(
  recipeId: string,
  payload: Partial<RecipePayload>,
  ingredients: IngredientRow[]
) {
  const supabase = await createClient()

  const slugs = generateRecipeTags(
    ingredients,
    payload.category ?? '',
    payload.type ?? '',
    payload.cooking_method ?? ''
  )

  if (!slugs.length) {
    await supabase.from('recipe_tags').delete().eq('recipe_id', recipeId)
    return
  }

  const { data: tags } = await supabase
    .from('tags')
    .select('id, slug')
    .in('slug', slugs)

  if (!tags?.length) return

  await supabase.from('recipe_tags').delete().eq('recipe_id', recipeId)
  await supabase.from('recipe_tags').insert(
    tags.map(t => ({ recipe_id: recipeId, tag_id: t.id }))
  )
}

export async function deleteRecipe(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('recipes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/recipes')
  return { ok: true }
}

export async function publishScheduledRecipes(): Promise<{ count: number } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('publish_scheduled_recipes')
  if (error) return { error: error.message }
  revalidatePath('/recipes')
  return { count: data ?? 0 }
}
