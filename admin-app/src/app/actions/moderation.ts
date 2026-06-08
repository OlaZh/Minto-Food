'use server'

import { assertAdmin } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) {
    throw new Error(`${fallback}: ${error.message}`)
  }
}

async function logAction(
  supabase: SupabaseClient,
  adminId: string,
  table: string,
  targetId: string,
  action: string,
  payload?: object
) {
  const { error } = await supabase.from('admin_actions').insert({
    admin_id: adminId,
    target_table: table,
    target_id: targetId,
    action_type: action,
    payload: payload ?? null,
  })

  if (error) {
    console.error('Failed to write admin action log', error)
  }
}

// ─── REPORTS ──────────────────────────────────────────────────

export async function resolveReport(reportId: string, status: 'resolved' | 'dismissed') {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)

  const { error } = await supabase.from('recipe_reports').update({
    status,
    resolved_by: admin.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', reportId)

  throwIfError(error, 'Не вдалося оновити статус скарги')
  await logAction(supabase, admin.id, 'recipe_reports', reportId, status)
  revalidatePath('/reports')

  return { ok: true as const }
}

export async function hideRecipeFromReport(reportId: string, recipeId: string) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)

  const { error: recipeError } = await supabase.from('recipes').update({ status: 'draft' }).eq('id', recipeId)
  throwIfError(recipeError, 'Не вдалося приховати рецепт')

  const { error: reportError } = await supabase.from('recipe_reports').update({
    status: 'resolved',
    resolved_by: admin.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', reportId)

  throwIfError(reportError, 'Не вдалося закрити скаргу')
  await logAction(supabase, admin.id, 'recipes', recipeId, 'set_draft', { from: 'admin_report' })
  revalidatePath('/reports')

  return { ok: true as const }
}

export async function deleteRecipeFromReport(
  reportId: string,
  recipeId: string,
  reason?: { category: string; comment: string }
) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)

  const { error: recipeError } = await supabase.from('recipes').update({
    deleted_at: new Date().toISOString(), status: 'draft',
  }).eq('id', recipeId)

  throwIfError(recipeError, 'Не вдалося видалити рецепт')

  const { error: reportError } = await supabase.from('recipe_reports').update({
    status: 'resolved',
    resolved_by: admin.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', reportId)

  throwIfError(reportError, 'Не вдалося закрити скаргу після видалення рецепта')
  await logAction(supabase, admin.id, 'recipes', recipeId, 'soft_delete', { from: 'admin_report', reason })
  revalidatePath('/reports')

  return { ok: true as const }
}

// ─── RECIPE MODERATION ────────────────────────────────────────

export async function approveRecipe(recipeId: string) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const { error } = await supabase.from('recipes').update({ status: 'published' }).eq('id', recipeId)

  throwIfError(error, 'Не вдалося опублікувати рецепт')
  await logAction(supabase, admin.id, 'recipes', recipeId, 'approve')
  revalidatePath('/moderation')

  return { ok: true as const }
}

export async function rejectRecipe(recipeId: string, note: string) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const { error } = await supabase.from('recipes').update({
    status: 'rejected',
    moderation_note: note || null,
  }).eq('id', recipeId)

  throwIfError(error, 'Не вдалося відхилити рецепт')
  await logAction(supabase, admin.id, 'recipes', recipeId, 'reject', { note })
  revalidatePath('/moderation')

  return { ok: true as const }
}

// ─── USERS ────────────────────────────────────────────────────

export async function banUser(userId: string, reason?: { category: string; comment: string }) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)

  const { error: profileError } = await supabase.from('profiles').update({ is_banned: true }).eq('id', userId)
  throwIfError(profileError, 'Не вдалося забанити користувача')

  const { error: recipesError } = await supabase.from('recipes').update({ status: 'draft' })
    .eq('user_id', userId).eq('status', 'published')

  throwIfError(recipesError, 'Не вдалося приховати опубліковані рецепти користувача')

  const { data: userRecipes, error: recipesSelectError } = await supabase.from('recipes').select('id').eq('user_id', userId)
  throwIfError(recipesSelectError, 'Не вдалося отримати рецепти користувача')

  if (userRecipes?.length) {
    const { error: reportsError } = await supabase.from('recipe_reports').update({
      status: 'resolved',
      resolved_by: admin.id,
      resolved_at: new Date().toISOString(),
    }).in('recipe_id', userRecipes.map(r => r.id)).eq('status', 'pending')

    throwIfError(reportsError, 'Не вдалося закрити відкриті скарги користувача')
  }

  await logAction(supabase, admin.id, 'profiles', userId, 'ban', { reason })
  revalidatePath('/users')
  revalidatePath('/reports')

  return { ok: true as const }
}

export async function unbanUser(userId: string) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const { error } = await supabase.from('profiles').update({ is_banned: false }).eq('id', userId)

  throwIfError(error, 'Не вдалося розбанити користувача')
  await logAction(supabase, admin.id, 'profiles', userId, 'unban')
  revalidatePath('/users')

  return { ok: true as const }
}

export async function addStrike(userId: string, currentStrikes: number) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const newStrikes = currentStrikes + 1
  const update: Record<string, unknown> = { strikes: newStrikes }
  if (newStrikes === 2) update.freeze_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  if (newStrikes >= 3) {
    update.is_banned = true
    const { error: recipesError } = await supabase.from('recipes').update({ status: 'draft' })
      .eq('user_id', userId).eq('status', 'published')

    throwIfError(recipesError, 'Не вдалося приховати рецепти після автобану')
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', userId)
  throwIfError(error, 'Не вдалося додати страйк')

  await logAction(supabase, admin.id, 'profiles', userId, 'strike', { strikes: newStrikes, auto_ban: newStrikes >= 3 })
  revalidatePath('/users')

  return { ok: true as const }
}

export async function toggleShadowBan(userId: string, current: boolean) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const { error } = await supabase.from('profiles').update({ is_shadow_banned: !current }).eq('id', userId)

  throwIfError(error, 'Не вдалося змінити shadow ban')
  await logAction(supabase, admin.id, 'profiles', userId, current ? 'shadow_unban' : 'shadow_ban')
  revalidatePath('/users')

  return { ok: true as const }
}

export async function toggleAdmin(userId: string, current: boolean) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)

  if (current && userId === admin.id) {
    throw new Error('Не можна зняти адмін-права з власного акаунта')
  }

  if (current) {
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_admin', true)

    throwIfError(countError, 'Не вдалося перевірити кількість адміністраторів')

    if ((count ?? 0) <= 1) {
      throw new Error('Не можна зняти права з останнього адміністратора')
    }
  }

  const { error } = await supabase.from('profiles').update({ is_admin: !current }).eq('id', userId)
  throwIfError(error, 'Не вдалося змінити адмін-права')

  await logAction(supabase, admin.id, 'profiles', userId, current ? 'revoke_admin' : 'grant_admin')
  revalidatePath('/users')

  return { ok: true as const }
}

// ─── PRODUCTS ─────────────────────────────────────────────────

export async function approveProduct(productId: number, rawEdible: string) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const { error } = await supabase.from('products').update({ user_id: null, raw_edible: rawEdible }).eq('id', productId)

  throwIfError(error, 'Не вдалося схвалити продукт')
  await logAction(supabase, admin.id, 'products', String(productId), 'approve', { raw_edible: rawEdible })
  revalidatePath('/products')

  return { ok: true as const }
}

export async function updateProductNutrition(
  productId: number,
  nutrition: { kcal?: number; protein?: number; fat?: number; carbs?: number; fiber?: number; label_type?: string; food_state?: string }
) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const { error } = await supabase.from('products').update(nutrition).eq('id', productId)

  throwIfError(error, 'Не вдалося оновити КБЖУ продукту')
  await logAction(supabase, admin.id, 'products', String(productId), 'edit_kcal', nutrition)
  revalidatePath('/products')

  return { ok: true as const }
}

export async function softDeleteProduct(productId: number) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const { error } = await supabase.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', productId)

  throwIfError(error, 'Не вдалося видалити продукт')
  await logAction(supabase, admin.id, 'products', String(productId), 'soft_delete')
  revalidatePath('/products')

  return { ok: true as const }
}

export async function mergeProduct(fromId: number, toId: number) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const { error } = await supabase.rpc('merge_product', { p_from_id: fromId, p_to_id: toId })

  throwIfError(error, 'Не вдалося обʼєднати продукти')
  await logAction(supabase, admin.id, 'products', String(fromId), 'merge', { merged_into: toId })
  revalidatePath('/products')

  return { ok: true }
}

// ─── ARCHIVE ──────────────────────────────────────────────────

export async function restoreRecipe(recipeId: string) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const { error } = await supabase.from('recipes').update({ deleted_at: null }).eq('id', recipeId)

  throwIfError(error, 'Не вдалося відновити рецепт')
  await logAction(supabase, admin.id, 'recipes', recipeId, 'restore')
  revalidatePath('/archive')

  return { ok: true as const }
}

export async function purgeRecipe(recipeId: string) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId)

  throwIfError(error, 'Не вдалося остаточно видалити рецепт')
  await logAction(supabase, admin.id, 'recipes', recipeId, 'purge')
  revalidatePath('/archive')

  return { ok: true as const }
}

export async function restoreProduct(productId: number) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const { error } = await supabase.from('products').update({ deleted_at: null }).eq('id', productId)

  throwIfError(error, 'Не вдалося відновити продукт')
  await logAction(supabase, admin.id, 'products', String(productId), 'restore')
  revalidatePath('/archive')

  return { ok: true as const }
}

export async function purgeProduct(productId: number) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)
  const { error } = await supabase.from('products').delete().eq('id', productId)

  throwIfError(error, 'Не вдалося остаточно видалити продукт')
  await logAction(supabase, admin.id, 'products', String(productId), 'purge')
  revalidatePath('/archive')

  return { ok: true as const }
}
