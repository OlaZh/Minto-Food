'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function logAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  targetId: string,
  action: string,
  payload?: object
) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return
  await supabase.from('admin_actions').insert({
    admin_id: session.user.id,
    target_table: table,
    target_id: targetId,
    action_type: action,
    payload: payload ?? null,
  })
}

// ─── REPORTS ──────────────────────────────────────────────────

export async function resolveReport(reportId: string, status: 'resolved' | 'dismissed') {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  await supabase.from('recipe_reports').update({
    status,
    resolved_by: session?.user?.id ?? null,
    resolved_at: new Date().toISOString(),
  }).eq('id', reportId)
  await logAction(supabase, 'recipe_reports', reportId, status)
  revalidatePath('/reports')
}

export async function hideRecipeFromReport(reportId: string, recipeId: string) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  await supabase.from('recipes').update({ status: 'draft' }).eq('id', recipeId)
  await supabase.from('recipe_reports').update({
    status: 'resolved',
    resolved_by: session?.user?.id ?? null,
    resolved_at: new Date().toISOString(),
  }).eq('id', reportId)
  await logAction(supabase, 'recipes', recipeId, 'set_draft', { from: 'admin_report' })
  revalidatePath('/reports')
}

export async function deleteRecipeFromReport(
  reportId: string,
  recipeId: string,
  reason?: { category: string; comment: string }
) {
  const supabase = await createClient()
  await supabase.from('recipes').update({
    deleted_at: new Date().toISOString(), status: 'draft',
  }).eq('id', recipeId)
  await logAction(supabase, 'recipes', recipeId, 'soft_delete', { from: 'admin_report', reason })
  revalidatePath('/reports')
}

// ─── RECIPE MODERATION ────────────────────────────────────────

export async function approveRecipe(recipeId: string) {
  const supabase = await createClient()
  await supabase.from('recipes').update({ status: 'published' }).eq('id', recipeId)
  await logAction(supabase, 'recipes', recipeId, 'approve')
  revalidatePath('/moderation')
}

export async function rejectRecipe(recipeId: string, note: string) {
  const supabase = await createClient()
  await supabase.from('recipes').update({
    status: 'rejected',
    moderation_note: note || null,
  }).eq('id', recipeId)
  await logAction(supabase, 'recipes', recipeId, 'reject', { note })
  revalidatePath('/moderation')
}

// ─── USERS ────────────────────────────────────────────────────

export async function banUser(userId: string, reason?: { category: string; comment: string }) {
  const supabase = await createClient()
  await supabase.from('profiles').update({ is_banned: true }).eq('id', userId)
  await supabase.from('recipes').update({ status: 'draft' })
    .eq('user_id', userId).eq('status', 'published')
  const { data: { session } } = await supabase.auth.getSession()
  const { data: userRecipes } = await supabase.from('recipes').select('id').eq('user_id', userId)
  if (userRecipes?.length) {
    await supabase.from('recipe_reports').update({
      status: 'resolved',
      resolved_by: session?.user?.id,
      resolved_at: new Date().toISOString(),
    }).in('recipe_id', userRecipes.map(r => r.id)).eq('status', 'pending')
  }
  await logAction(supabase, 'profiles', userId, 'ban', { reason })
  revalidatePath('/users')
  revalidatePath('/reports')
}

export async function unbanUser(userId: string) {
  const supabase = await createClient()
  await supabase.from('profiles').update({ is_banned: false }).eq('id', userId)
  await logAction(supabase, 'profiles', userId, 'unban')
  revalidatePath('/users')
}

export async function addStrike(userId: string, currentStrikes: number) {
  const supabase = await createClient()
  const newStrikes = currentStrikes + 1
  const update: Record<string, unknown> = { strikes: newStrikes }
  if (newStrikes === 2) update.freeze_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  if (newStrikes >= 3) {
    update.is_banned = true
    await supabase.from('recipes').update({ status: 'draft' })
      .eq('user_id', userId).eq('status', 'published')
  }
  await supabase.from('profiles').update(update).eq('id', userId)
  await logAction(supabase, 'profiles', userId, 'strike', { strikes: newStrikes, auto_ban: newStrikes >= 3 })
  revalidatePath('/users')
}

export async function toggleShadowBan(userId: string, current: boolean) {
  const supabase = await createClient()
  await supabase.from('profiles').update({ is_shadow_banned: !current }).eq('id', userId)
  await logAction(supabase, 'profiles', userId, current ? 'shadow_unban' : 'shadow_ban')
  revalidatePath('/users')
}

export async function toggleAdmin(userId: string, current: boolean) {
  const supabase = await createClient()
  await supabase.from('profiles').update({ is_admin: !current }).eq('id', userId)
  await logAction(supabase, 'profiles', userId, current ? 'revoke_admin' : 'grant_admin')
  revalidatePath('/users')
}

// ─── PRODUCTS ─────────────────────────────────────────────────

export async function approveProduct(productId: number) {
  const supabase = await createClient()
  await supabase.from('products').update({ user_id: null }).eq('id', productId)
  await logAction(supabase, 'products', String(productId), 'approve')
  revalidatePath('/products')
}

export async function updateProductNutrition(
  productId: number,
  nutrition: { kcal?: number; protein?: number; fat?: number; carbs?: number; fiber?: number; label_type?: string }
) {
  const supabase = await createClient()
  await supabase.from('products').update(nutrition).eq('id', productId)
  await logAction(supabase, 'products', String(productId), 'edit_kcal', nutrition)
  revalidatePath('/products')
}

export async function softDeleteProduct(productId: number) {
  const supabase = await createClient()
  await supabase.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', productId)
  await logAction(supabase, 'products', String(productId), 'soft_delete')
  revalidatePath('/products')
}

export async function mergeProduct(fromId: number, toId: number) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('merge_product', { p_from_id: fromId, p_to_id: toId })
  if (error) return { error: error.message }
  await logAction(supabase, 'products', String(fromId), 'merge', { merged_into: toId })
  revalidatePath('/products')
  return { ok: true }
}

// ─── ARCHIVE ──────────────────────────────────────────────────

export async function restoreRecipe(recipeId: string) {
  const supabase = await createClient()
  await supabase.from('recipes').update({ deleted_at: null }).eq('id', recipeId)
  await logAction(supabase, 'recipes', recipeId, 'restore')
  revalidatePath('/archive')
}

export async function purgeRecipe(recipeId: string) {
  const supabase = await createClient()
  await supabase.from('recipes').delete().eq('id', recipeId)
  await logAction(supabase, 'recipes', recipeId, 'purge')
  revalidatePath('/archive')
}

export async function restoreProduct(productId: number) {
  const supabase = await createClient()
  await supabase.from('products').update({ deleted_at: null }).eq('id', productId)
  await logAction(supabase, 'products', String(productId), 'restore')
  revalidatePath('/archive')
}

export async function purgeProduct(productId: number) {
  const supabase = await createClient()
  await supabase.from('products').delete().eq('id', productId)
  await logAction(supabase, 'products', String(productId), 'purge')
  revalidatePath('/archive')
}
