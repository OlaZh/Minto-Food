'use server'

import { revalidatePath } from 'next/cache'
import { assertAdmin } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type UpdateFeatureFlagInput = {
  key: string
  enabled: boolean
  rolloutPct: number
  targetUsersInput: string
  description: string
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) {
    throw new Error(`${fallback}: ${error.message}`)
  }
}

function parseRolloutPct(value: number) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error('Відсоток запуску має бути цілим числом від 0 до 100')
  }

  if (value < 0 || value > 100) {
    throw new Error('Відсоток запуску має бути в межах від 0 до 100')
  }

  return value
}

function parseTargetUsers(input: string) {
  const values = input
    .split(/[\s,]+/)
    .map(value => value.trim())
    .filter(Boolean)

  const invalid = values.find(value => !UUID_RE.test(value))
  if (invalid) {
    throw new Error(`Некоректний user id: ${invalid}`)
  }

  return [...new Set(values.map(value => value.toLowerCase()))]
}

async function logAction(
  supabase: SupabaseClient,
  adminId: string,
  flagKey: string,
  payload: Record<string, unknown>
) {
  const { error } = await supabase.from('admin_actions').insert({
    admin_id: adminId,
    target_table: 'feature_flags',
    target_id: flagKey,
    action_type: 'feature_flag_update',
    payload,
  })

  if (error) {
    console.error('Failed to write feature flag admin log', error)
  }
}

export async function updateFeatureFlag(input: UpdateFeatureFlagInput) {
  if (!input.key.trim()) {
    throw new Error('Ключ прапорця обовʼязковий')
  }

  const supabase = await createClient()
  const admin = await assertAdmin(supabase)

  const rolloutPct = parseRolloutPct(input.rolloutPct)
  const targetUsers = parseTargetUsers(input.targetUsersInput)
  const description = input.description.trim() || null
  const updatedAt = new Date().toISOString()

  const { error } = await supabase
    .from('feature_flags')
    .update({
      enabled: input.enabled,
      rollout_pct: rolloutPct,
      target_users: targetUsers,
      description,
      updated_at: updatedAt,
      updated_by: admin.id,
    })
    .eq('key', input.key)

  throwIfError(error, 'Не вдалося оновити прапорець функції')

  await logAction(supabase, admin.id, input.key, {
    enabled: input.enabled,
    rollout_pct: rolloutPct,
    target_users: targetUsers,
    description,
  })

  revalidatePath('/feature-flags')

  return { ok: true as const }
}
