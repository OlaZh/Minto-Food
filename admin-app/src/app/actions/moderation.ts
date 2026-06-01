'use server'

import { createClient } from '@/lib/supabase/server'
import { assertNoError, logAdminAction, requireAdminUser } from '@/lib/admin'
import { revalidatePath } from 'next/cache'

// ─── REPORTS ──────────────────────────────────────────────────

export async function resolveReport(reportId: string, status: 'resolved' | 'dismissed') {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.from('recipe_reports').update({
    status,
    resolved_by: admin.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', reportId)

  assertNoError(error, 'Не вдалося оновити статус скарги.')
  await logAdminAction(supabase, admin.id, 'recipe_reports', reportId, status)
  revalidatePath('/reports')
}

export async function hideRecipeFromReport(reportId: string, recipeId: string) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)

  const { error: recipeError } = await supabase
    .from('recipes')
    .update({ status: 'draft' })
    .eq('id', recipeId)
  assertNoError(recipeError, 'Не вдалося приховати рецепт.')

  const { error: reportError } = await supabase.from('recipe_reports').update({
    status: 'resolved',
    resolved_by: admin.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', reportId)

  assertNoError(reportError, 'Не вдалося закрити скаргу після приховування рецепта.')
  await logAdminAction(supabase, admin.id, 'recipes', recipeId, 'set_draft', { from: 'admin_report' })
  revalidatePath('/reports')
  revalidatePath('/moderation')
}

export async function deleteRecipeFromReport(
  reportId: string,
  recipeId: string,
  reason?: { category: string; comment: string }
) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)

  const { error: recipeError } = await supabase.from('recipes').update({
    deleted_at: new Date().toISOString(), status: 'draft',
  }).eq('id', recipeId)

  assertNoError(recipeError, 'Не вдалося видалити рецепт.')

  const { error: reportError } = await supabase.from('recipe_reports').update({
    status: 'resolved',
    resolved_by: admin.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', reportId)

  assertNoError(reportError, 'Не вдалося закрити скаргу після видалення рецепта.')
  await logAdminAction(supabase, admin.id, 'recipes', recipeId, 'soft_delete', {
    from: 'admin_report',
    reason,
  })
  revalidatePath('/reports')
  revalidatePath('/archive')
}

// ─── RECIPE MODERATION ────────────────────────────────────────

export async function approveRecipe(recipeId: string) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.from('recipes').update({ status: 'published' }).eq('id', recipeId)
  assertNoError(error, 'Не вдалося опублікувати рецепт.')
  await logAdminAction(supabase, admin.id, 'recipes', recipeId, 'approve')
  revalidatePath('/moderation')
  revalidatePath('/recipes')
}

export async function rejectRecipe(recipeId: string, note: string) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.from('recipes').update({
    status: 'rejected',
    moderation_note: note || null,
  }).eq('id', recipeId)
  assertNoError(error, 'Не вдалося відхилити рецепт.')
  await logAdminAction(supabase, admin.id, 'recipes', recipeId, 'reject', { note })
  revalidatePath('/moderation')
  revalidatePath('/recipes')
}

// ─── USERS ────────────────────────────────────────────────────

export async function banUser(userId: string, reason?: { category: string; comment: string }) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)

  const { error: profileError } = await supabase.from('profiles').update({ is_banned: true }).eq('id', userId)
  assertNoError(profileError, 'Не вдалося заблокувати користувача.')

  const { error: recipeError } = await supabase.from('recipes').update({ status: 'draft' })
    .eq('user_id', userId).eq('status', 'published')
  assertNoError(recipeError, 'Не вдалося приховати опубліковані рецепти користувача.')

  const { data: userRecipes } = await supabase.from('recipes').select('id').eq('user_id', userId)
  if (userRecipes?.length) {
    const { error: reportError } = await supabase.from('recipe_reports').update({
      status: 'resolved',
      resolved_by: admin.id,
      resolved_at: new Date().toISOString(),
    }).in('recipe_id', userRecipes.map(r => r.id)).eq('status', 'pending')
    assertNoError(reportError, 'Не вдалося закрити відкриті скарги на рецепти користувача.')
  }
  await logAdminAction(supabase, admin.id, 'profiles', userId, 'ban', { reason })
  revalidatePath('/users')
  revalidatePath('/reports')
  revalidatePath('/moderation')
}

export async function unbanUser(userId: string) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.from('profiles').update({ is_banned: false }).eq('id', userId)
  assertNoError(error, 'Не вдалося розблокувати користувача.')
  await logAdminAction(supabase, admin.id, 'profiles', userId, 'unban')
  revalidatePath('/users')
}

export async function addStrike(userId: string, currentStrikes: number) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const newStrikes = currentStrikes + 1
  const update: Record<string, unknown> = { strikes: newStrikes }
  if (newStrikes === 2) update.freeze_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  if (newStrikes >= 3) {
    update.is_banned = true
    const { error: recipeError } = await supabase.from('recipes').update({ status: 'draft' })
      .eq('user_id', userId).eq('status', 'published')
    assertNoError(recipeError, 'Не вдалося приховати рецепти після автобану.')
  }
  const { error } = await supabase.from('profiles').update(update).eq('id', userId)
  assertNoError(error, 'Не вдалося видати страйк користувачу.')
  await logAdminAction(supabase, admin.id, 'profiles', userId, 'strike', {
    strikes: newStrikes,
    auto_ban: newStrikes >= 3,
  })
  revalidatePath('/users')
  revalidatePath('/moderation')
  revalidatePath('/reports')
}

export async function toggleShadowBan(userId: string, current: boolean) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.from('profiles').update({ is_shadow_banned: !current }).eq('id', userId)
  assertNoError(error, 'Не вдалося змінити shadow ban.')
  await logAdminAction(supabase, admin.id, 'profiles', userId, current ? 'shadow_unban' : 'shadow_ban')
  revalidatePath('/users')
}

export async function toggleAdmin(userId: string, current: boolean) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.rpc('admin_set_user_admin', {
    p_user_id: userId,
    p_is_admin: !current,
  })
  assertNoError(error, current ? 'Не вдалося зняти права адміна.' : 'Не вдалося надати права адміна.')
  await logAdminAction(supabase, admin.id, 'profiles', userId, current ? 'revoke_admin' : 'grant_admin')
  revalidatePath('/users')
}

// ─── PRODUCTS ─────────────────────────────────────────────────

export async function approveProduct(productId: number, rawEdible: string) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase
    .from('products')
    .update({ user_id: null, raw_edible: rawEdible })
    .eq('id', productId)
  assertNoError(error, 'Не вдалося схвалити продукт.')
  await logAdminAction(supabase, admin.id, 'products', String(productId), 'approve', { raw_edible: rawEdible })
  revalidatePath('/products')
}

export async function updateProductNutrition(
  productId: number,
  nutrition: { kcal?: number; protein?: number; fat?: number; carbs?: number; fiber?: number; label_type?: string; food_state?: string }
) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.from('products').update(nutrition).eq('id', productId)
  assertNoError(error, 'Не вдалося оновити КБЖУ продукту.')
  await logAdminAction(supabase, admin.id, 'products', String(productId), 'edit_kcal', nutrition)
  revalidatePath('/products')
}

export async function softDeleteProduct(productId: number) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', productId)
  assertNoError(error, 'Не вдалося видалити продукт.')
  await logAdminAction(supabase, admin.id, 'products', String(productId), 'soft_delete')
  revalidatePath('/products')
  revalidatePath('/archive')
}

export async function mergeProduct(fromId: number, toId: number) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.rpc('merge_product', { p_from_id: fromId, p_to_id: toId })
  if (error) return { error: error.message }
  await logAdminAction(supabase, admin.id, 'products', String(fromId), 'merge', { merged_into: toId })
  revalidatePath('/products')
  return { ok: true }
}

// ─── ARCHIVE ──────────────────────────────────────────────────

export async function restoreRecipe(recipeId: string) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.from('recipes').update({ deleted_at: null }).eq('id', recipeId)
  assertNoError(error, 'Не вдалося відновити рецепт.')
  await logAdminAction(supabase, admin.id, 'recipes', recipeId, 'restore')
  revalidatePath('/archive')
}

export async function purgeRecipe(recipeId: string) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId)
  assertNoError(error, 'Не вдалося видалити рецепт назавжди.')
  await logAdminAction(supabase, admin.id, 'recipes', recipeId, 'purge')
  revalidatePath('/archive')
}

export async function restoreProduct(productId: number) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.from('products').update({ deleted_at: null }).eq('id', productId)
  assertNoError(error, 'Не вдалося відновити продукт.')
  await logAdminAction(supabase, admin.id, 'products', String(productId), 'restore')
  revalidatePath('/archive')
}

export async function purgeProduct(productId: number) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.from('products').delete().eq('id', productId)
  assertNoError(error, 'Не вдалося видалити продукт назавжди.')
  await logAdminAction(supabase, admin.id, 'products', String(productId), 'purge')
  revalidatePath('/archive')
}
