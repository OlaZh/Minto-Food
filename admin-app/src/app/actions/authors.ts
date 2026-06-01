'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin'
import { revalidatePath } from 'next/cache'

export interface AuthorPayload {
  display_name: string
  slug: string
  avatar?: string | null
  bio?: string | null
  country?: string | null
  is_virtual?: boolean
  is_editorial?: boolean
}

export async function createAuthor(
  payload: AuthorPayload
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  await requireAdminUser(supabase)
  const { data, error } = await supabase
    .from('recipe_author_profiles')
    .insert(payload)
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Failed' }
  revalidatePath('/authors')
  return { id: data.id }
}

export async function updateAuthor(
  id: string,
  payload: Partial<AuthorPayload>
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  await requireAdminUser(supabase)
  const { error } = await supabase
    .from('recipe_author_profiles')
    .update(payload)
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/authors')
  return { ok: true }
}

export async function deleteAuthor(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  await requireAdminUser(supabase)
  const { error } = await supabase
    .from('recipe_author_profiles')
    .delete()
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/authors')
  return { ok: true }
}
