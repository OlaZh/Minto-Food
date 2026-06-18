import { createClient } from '@/lib/supabase/server'
import FeatureFlagsClient from './FeatureFlagsClient'

type FeatureFlagRow = {
  key: string
  enabled: boolean
  rollout_pct: number
  target_users: string[] | null
  description: string | null
  updated_at: string
  updated_by: string | null
}

type ProfileRow = {
  id: string
  full_name: string | null
}

export default async function FeatureFlagsPage() {
  const supabase = await createClient()

  const { data: flags } = await supabase
    .from('feature_flags')
    .select('key, enabled, rollout_pct, target_users, description, updated_at, updated_by')
    .order('key')

  const updaterIds = [...new Set((flags ?? []).map(flag => flag.updated_by).filter(Boolean))] as string[]

  let profilesMap: Record<string, ProfileRow> = {}
  if (updaterIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', updaterIds)

    profilesMap = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile]))
  }

  const enriched = ((flags as FeatureFlagRow[]) ?? []).map(flag => ({
    ...flag,
    updated_by_id: flag.updated_by,
    updated_by_name: flag.updated_by ? (profilesMap[flag.updated_by]?.full_name ?? null) : null,
  }))

  const pageKey = enriched
    .map(flag => `${flag.key}:${flag.updated_at}:${flag.updated_by_id ?? 'system'}`)
    .join('|')

  return <FeatureFlagsClient key={pageKey} flags={enriched} />
}
