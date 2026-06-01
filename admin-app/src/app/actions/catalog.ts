'use server'

import { createClient } from '@/lib/supabase/server'
import { assertNoError, logAdminAction, requireAdminUser } from '@/lib/admin'
import { revalidatePath } from 'next/cache'

export async function updateProduct(productId: number, data: Record<string, unknown>) {
  const supabase = await createClient()
  const admin = await requireAdminUser(supabase)
  const { error } = await supabase
    .from('products')
    .update(data)
    .eq('id', productId)
  assertNoError(error, 'Не вдалося оновити продукт.')

  await logAdminAction(supabase, admin.id, 'products', String(productId), 'catalog_edit', data)

  revalidatePath('/catalog')
}
