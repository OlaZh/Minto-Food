import { createClient } from '@/lib/supabase/server'
import UnmatchedClient from './UnmatchedClient'

export default async function UnmatchedPage() {
  const supabase = await createClient()

  // Поки трафік малий — показуємо всі pending (min_seen=1).
  const { data, error } = await supabase.rpc('get_unmatched_terms', {
    p_status: 'pending',
    p_min_seen: 1,
  })

  return <UnmatchedClient rows={data ?? []} error={error?.message ?? null} />
}
