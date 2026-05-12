import { createClient } from '@/lib/supabase/server'
import AuthorsClient from './AuthorsClient'
import type { RecipeAuthorProfile } from '@/lib/types'

export default async function AuthorsPage() {
  const supabase = await createClient()
  const { data: authors } = await supabase
    .from('recipe_author_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return <AuthorsClient authors={(authors as RecipeAuthorProfile[]) ?? []} />
}
