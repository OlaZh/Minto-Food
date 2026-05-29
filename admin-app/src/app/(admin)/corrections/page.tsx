import { createClient } from '@/lib/supabase/server'
import CorrectionsClient from './CorrectionsClient'

export default async function CorrectionsPage() {
  const supabase = await createClient()

  // min_votes=1 — поки трафік малий, показуємо всі пропозиції;
  // сортування за кількістю голосів робить функція.
  const { data, error } = await supabase.rpc('get_scanned_correction_stats', {
    min_votes: 1,
  })

  return <CorrectionsClient rows={data ?? []} error={error?.message ?? null} />
}
