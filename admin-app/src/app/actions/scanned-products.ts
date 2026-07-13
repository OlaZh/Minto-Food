'use server'

import { assertAdmin } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ScannedProductValues {
  name_ua: string | null
  name_en: string | null
  name_pl: string | null
  brand: string | null
  kcal: number
  protein: number
  fat: number
  carbs: number
  fiber: number
  sugar: number
  salt: number
  label_type: string | null
}

async function logAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminId: string,
  barcode: string,
  actionType: string,
  payload?: object
) {
  const { error } = await supabase.from('admin_actions').insert({
    admin_id: adminId,
    target_table: 'scanned_products',
    target_id: barcode,
    action_type: actionType,
    payload: payload ?? null,
  })

  if (error) {
    console.error('Failed to write scanned product admin log', error)
  }
}

export async function updateScannedProduct(barcode: string, values: ScannedProductValues) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)

  const { error } = await supabase.rpc('admin_update_scanned_product', {
    p_barcode: barcode,
    p_name_ua: values.name_ua,
    p_name_en: values.name_en,
    p_name_pl: values.name_pl,
    p_brand: values.brand,
    p_kcal: values.kcal,
    p_protein: values.protein,
    p_fat: values.fat,
    p_carbs: values.carbs,
    p_fiber: values.fiber,
    p_sugar: values.sugar,
    p_salt: values.salt,
    p_label_type: values.label_type,
  })

  if (error) {
    throw new Error(`Не вдалося оновити відсканований продукт: ${error.message}`)
  }

  await logAction(supabase, admin.id, barcode, 'update_scanned_product', values)
  revalidatePath('/scanned-products')
  return { ok: true as const }
}

export async function deleteScannedProduct(barcode: string) {
  const supabase = await createClient()
  const admin = await assertAdmin(supabase)

  const { error } = await supabase.rpc('admin_delete_scanned_product', {
    p_barcode: barcode,
  })

  if (error) {
    throw new Error(`Не вдалося видалити відсканований продукт: ${error.message}`)
  }

  await logAction(supabase, admin.id, barcode, 'delete_scanned_product')
  revalidatePath('/scanned-products')
  return { ok: true as const }
}
