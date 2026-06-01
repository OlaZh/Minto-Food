'use server'

import { createClient } from '@/lib/supabase/server'
import { logAdminAction, requireAdminUser } from '@/lib/admin'
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
  const admin = await requireAdminUser(supabase)
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

  await logAdminAction(supabase, admin.id, 'scanned_products', barcode, 'apply_correction', v)

  revalidatePath('/corrections')
  return { ok: true }
}

export async function dismissCorrections(barcode: string) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase.rpc('dismiss_scanned_corrections', { p_barcode: barcode })
  if (error) return { error: error.message }

  await logAdminAction(supabase, admin.id, 'scanned_products', barcode, 'dismiss_corrections')

  revalidatePath('/corrections')
  return { ok: true }
}
