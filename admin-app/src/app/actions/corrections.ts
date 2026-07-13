'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface CorrectionValues {
  kcal: number
  protein: number
  fat: number
  carbs: number
  fiber: number
  sugar: number
  salt: number
}

export async function applyCorrection(barcode: string, v: CorrectionValues) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('apply_scanned_correction', {
    p_barcode: barcode,
    p_kcal: v.kcal,
    p_protein: v.protein,
    p_fat: v.fat,
    p_carbs: v.carbs,
    p_fiber: v.fiber,
    p_sugar: v.sugar,
    p_salt: v.salt,
  })
  if (error) return { error: error.message }

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    await supabase.from('admin_actions').insert({
      admin_id: session.user.id,
      target_table: 'scanned_products',
      target_id: barcode,
      action_type: 'apply_correction',
      payload: v,
    })
  }

  revalidatePath('/corrections')
  return { ok: true }
}

export async function dismissCorrections(barcode: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('dismiss_scanned_corrections', { p_barcode: barcode })
  if (error) return { error: error.message }

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    await supabase.from('admin_actions').insert({
      admin_id: session.user.id,
      target_table: 'scanned_products',
      target_id: barcode,
      action_type: 'dismiss_corrections',
    })
  }

  revalidatePath('/corrections')
  return { ok: true }
}

export async function approveNameCorrection(proposalId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('approve_scanned_name_correction', {
    p_proposal_id: proposalId,
  })
  if (error) return { error: error.message }

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    await supabase.from('admin_actions').insert({
      admin_id: session.user.id,
      target_table: 'scanned_product_name_corrections',
      target_id: proposalId,
      action_type: 'approve_name_correction',
    })
  }

  revalidatePath('/corrections')
  revalidatePath('/scanned-products')
  return { ok: true }
}

export async function rejectNameCorrection(proposalId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reject_scanned_name_correction', {
    p_proposal_id: proposalId,
  })
  if (error) return { error: error.message }

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    await supabase.from('admin_actions').insert({
      admin_id: session.user.id,
      target_table: 'scanned_product_name_corrections',
      target_id: proposalId,
      action_type: 'reject_name_correction',
    })
  }

  revalidatePath('/corrections')
  return { ok: true }
}
