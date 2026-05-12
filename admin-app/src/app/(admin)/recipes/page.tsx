import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Plus, Edit, Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { publishScheduledRecipes } from '@/app/actions/recipes'

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  draft:     { label: 'Чернетка', class: 'bg-gray-100 text-gray-600' },
  scheduled: { label: 'Заплановано', class: 'bg-blue-100 text-blue-700' },
  published: { label: 'Опубліковано', class: 'bg-green-100 text-green-700' },
  pending:   { label: 'На модерації', class: 'bg-yellow-100 text-yellow-700' },
  rejected:  { label: 'Відхилено', class: 'bg-red-100 text-red-700' },
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('recipes')
    .select(`
      id, name_ua, name_en, image, status, created_at, is_public,
      kcal, category, type, available_locales, author_profile_id,
      author_profile:recipe_author_profiles(display_name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }
  if (params.q) {
    query = query.or(`name_ua.ilike.%${params.q}%,name_en.ilike.%${params.q}%`)
  }

  const { data: recipes, error } = await query

  const statuses = ['all', 'draft', 'scheduled', 'published', 'pending']

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Рецепти</h1>
        <div className="flex items-center gap-2">
          <form action={async () => { 'use server'; await publishScheduledRecipes() }}>
            <Button variant="outline" size="sm" type="submit">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Опублікувати заплановані
            </Button>
          </form>
          <Link href="/recipes/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Новий рецепт
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        {statuses.map(s => (
          <Link
            key={s}
            href={`/recipes${s !== 'all' ? `?status=${s}` : ''}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              (params.status ?? 'all') === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {{ all: 'Всі', draft: 'Чернетки', scheduled: 'Заплановані', published: 'Опубліковані', pending: 'Модерація' }[s]}
          </Link>
        ))}
        <form className="ml-auto">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Пошук..."
            className="h-7 text-xs border border-gray-200 rounded-md px-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900 w-48"
          />
        </form>
      </div>

      {/* List */}
      {error && (
        <div className="px-8 py-6 text-sm text-red-500">
          Помилка: {error.message}
        </div>
      )}

      {!error && (!recipes || recipes.length === 0) && (
        <div className="px-8 py-16 text-center text-gray-400">
          <p className="text-sm">Рецептів не знайдено</p>
          <Link href="/recipes/new" className="mt-3 inline-block">
            <Button variant="outline" size="sm">Створити перший</Button>
          </Link>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {recipes?.map(recipe => {
          const st = STATUS_LABELS[recipe.status] ?? STATUS_LABELS.draft
          const author = (recipe as any).author_profile
          return (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}/edit`}
              className="flex items-center gap-4 px-8 py-3 hover:bg-gray-50 group cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 shrink-0">
                {recipe.image ? (
                  <img src={recipe.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">🍽</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {recipe.name_ua || recipe.name_en || '(без назви)'}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.class}`}>
                    {st.label}
                  </span>
                  {recipe.category && (
                    <span className="text-xs text-gray-400">{recipe.category}</span>
                  )}
                  {author?.display_name && (
                    <span className="text-xs text-gray-400">— {author.display_name}</span>
                  )}
                  {recipe.available_locales && recipe.available_locales.length < 3 && (
                    <span className="text-xs text-gray-400">
                      [{recipe.available_locales.join(', ')}]
                    </span>
                  )}
                </div>
              </div>

              {/* Edit icon on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit className="h-4 w-4 text-gray-400" />
              </div>

              <time className="text-xs text-gray-400 shrink-0" suppressHydrationWarning>
                {recipe.created_at.slice(0, 10)}
              </time>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
