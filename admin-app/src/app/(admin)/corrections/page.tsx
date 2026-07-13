import { createClient } from '@/lib/supabase/server'
import CorrectionsClient from './CorrectionsClient'

export default async function CorrectionsPage() {
  const supabase = await createClient()

  // min_votes=1 — поки трафік малий, показуємо всі пропозиції;
  // сортування за кількістю голосів робить функція.
  const [macroResult, nameResult] = await Promise.all([
    supabase.rpc('get_scanned_correction_stats', { min_votes: 1 }),
    supabase.rpc('get_scanned_name_corrections', { p_status: 'pending' }),
  ])

  return (
    <CorrectionsClient
      rows={macroResult.data ?? []}
      error={macroResult.error?.message ?? null}
      nameRows={nameResult.data ?? []}
      nameError={nameResult.error?.message ?? null}
    />
  )
}
