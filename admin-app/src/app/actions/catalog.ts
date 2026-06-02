'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProduct(productId: number, data: Record<string, unknown>) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('products')
    .update(data)
    .eq('id', productId)
  if (error) throw new Error(error.message)

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    await supabase.from('admin_actions').insert({
      admin_id: session.user.id,
      target_table: 'products',
      target_id: String(productId),
      action_type: 'catalog_edit',
      payload: data,
    })
  }

  revalidatePath('/catalog')
}
