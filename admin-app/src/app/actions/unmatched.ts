'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type UnmatchedStatus = 'pending' | 'resolved' | 'ignored'

export async function setUnmatchedStatus(id: string, status: UnmatchedStatus) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_unmatched_status', {
    p_id: id,
    p_status: status,
  })
  if (error) return { error: error.message }

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    await supabase.from('admin_actions').insert({
      admin_id: session.user.id,
      target_table: 'unmatched_terms',
      target_id: id,
      action_type: `set_status_${status}`,
    })
  }

  revalidatePath('/unmatched')
  return { ok: true }
}
