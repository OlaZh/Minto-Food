import Image from 'next/image'
import Link from 'next/link'
import { Clock, Edit, Plus } from 'lucide-react'
import { publishScheduledRecipes } from '@/app/actions/recipes'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  draft: { label: 'Чернетка', class: 'bg-gray-100 text-gray-600' },
  scheduled: { label: 'Заплановано', class: 'bg-blue-100 text-blue-700' },
  published: { label: 'Опубліковано', class: 'bg-green-100 text-green-700' },
  pending: { label: 'На модерації', class: 'bg-yellow-100 text-yellow-700' },
  rejected: { label: 'Відхилено', class: 'bg-red-100 text-red-700' },
}

const STATUS_TABS = [
  { value: 'all', label: 'Всі' },
  { value: 'draft', label: 'Чернетки' },
  { value: 'scheduled', label: 'Заплановані' },
  { value: 'published', label: 'Опубліковані' },
  { value: 'pending', label: 'Модерація' },
  { value: 'rejected', label: 'Відхилені' },
]

const PAGE_SIZE = 100

const passthroughImageLoader = ({ src }: { src: string }) => src

type RecipeAuthor = {
  display_name: string | null
}

type RecipeRow = {
  id: string
  name_ua: string | null
  name_en: string | null
  name_pl: string | null
  image: string | null
  status: string
  created_at: string
  is_public: boolean | null
  kcal: number | null
  category: string | null
  type: string | null
  available_locales: string[] | null
  author_profile_id: string | null
  author_profile: unknown
}

function getAuthorProfile(value: unknown): RecipeAuthor | null {
  if (Array.isArray(value)) {
    const first = value[0]
    if (first && typeof first === 'object' && 'display_name' in first) {
      return first as RecipeAuthor
    }
    return null
  }

  if (value && typeof value === 'object' && 'display_name' in value) {
    return value as RecipeAuthor
  }

  return null
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const activeStatus = params.status ?? 'all'
  const activeQuery = params.q?.trim() ?? ''

  const buildRecipesHref = ({
    status = activeStatus,
    query = activeQuery,
    nextPage = 1,
  }: {
    status?: string
    query?: string
    nextPage?: number
  }) => {
    const search = new URLSearchParams()

    if (status && status !== 'all') {
      search.set('status', status)
    }
    if (query) {
      search.set('q', query)
    }
    if (nextPage > 1) {
      search.set('page', String(nextPage))
    }

    const queryString = search.toString()
    return queryString ? `/recipes?${queryString}` : '/recipes'
  }

  let query = supabase
    .from('recipes')
    .select(
      `
      id, name_ua, name_en, name_pl, image, status, created_at, is_public,
      kcal, category, type, available_locales, author_profile_id,
      author_profile:recipe_author_profiles(display_name)
    `,
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (activeStatus !== 'all') {
    query = query.eq('status', activeStatus)
  }
  if (activeQuery) {
    query = query.or(
      `name_ua.ilike.%${activeQuery}%,name_en.ilike.%${activeQuery}%,name_pl.ilike.%${activeQuery}%`
    )
  }

  const { data: recipes, error, count } = await query
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Рецепти</h1>
        <div className="flex items-center gap-2">
          <form
            action={async () => {
              'use server'
              await publishScheduledRecipes()
            }}
          >
            <Button variant="outline" size="sm" type="submit">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Опублікувати заплановані
            </Button>
          </form>
          <Link href="/recipes/new" className="hidden md:inline-flex">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Новий рецепт
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 md:px-8 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map(tab => (
          <Link
            key={tab.value}
            href={buildRecipesHref({ status: tab.value, nextPage: 1 })}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeStatus === tab.value
                ? 'bg-[#4ab584] text-white border-[#4ab584]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {tab.label}
          </Link>
        ))}

        <form className="ml-auto flex items-center gap-2">
          {activeStatus !== 'all' && <input type="hidden" name="status" value={activeStatus} />}
          <input type="hidden" name="page" value="1" />
          <input
            name="q"
            defaultValue={activeQuery}
            placeholder="Пошук по UA / EN / PL…"
            className="h-8 text-xs border border-gray-200 rounded-md px-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900 w-56"
          />
          <Button type="submit" variant="outline" size="sm">
            Знайти
          </Button>
          {activeQuery && (
            <Link href={buildRecipesHref({ query: '', nextPage: 1 })}>
              <Button type="button" variant="ghost" size="sm">
                Очистити
              </Button>
            </Link>
          )}
        </form>
      </div>

      {error && (
        <div className="px-4 md:px-8 py-6 text-sm text-red-500">
          Помилка: {error.message}
        </div>
      )}

      {!error && (!recipes || recipes.length === 0) && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400">
          <p className="text-sm">Рецептів не знайдено</p>
          <Link href="/recipes/new" className="mt-3 inline-block">
            <Button variant="outline" size="sm">Створити перший</Button>
          </Link>
        </div>
      )}

      {!error && count != null && (
        <div className="px-4 md:px-8 py-2 text-xs text-gray-400 border-b border-gray-100">
          {count} рецептів · сторінка {page} з {totalPages}
          {activeQuery && <span> · фільтр: “{activeQuery}”</span>}
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {(recipes as RecipeRow[] | null)?.map(recipe => {
          const status = STATUS_LABELS[recipe.status] ?? STATUS_LABELS.draft
          const author = getAuthorProfile(recipe.author_profile)
          const recipeName = recipe.name_ua || recipe.name_en || recipe.name_pl || '(без назви)'

          return (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}/edit`}
              className="flex items-center gap-4 px-4 md:px-8 py-3 hover:bg-gray-50 group cursor-pointer"
            >
              <div className="relative w-12 h-12 rounded-md overflow-hidden bg-gray-100 shrink-0">
                {recipe.image ? (
                  <Image
                    src={recipe.image}
                    alt={recipeName}
                    fill
                    sizes="48px"
                    unoptimized
                    loader={passthroughImageLoader}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">🍽</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{recipeName}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.class}`}>
                    {status.label}
                  </span>
                  {recipe.category && <span className="text-xs text-gray-400">{recipe.category}</span>}
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

      {totalPages > 1 && (
        <div className="px-4 md:px-8 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
          <Link
            href={buildRecipesHref({ nextPage: page - 1 })}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              page <= 1
                ? 'pointer-events-none opacity-30 border-gray-200'
                : 'border-gray-200 hover:border-gray-400'
            }`}
            aria-disabled={page <= 1}
          >
            ← Попередня
          </Link>

          <span className="text-xs text-gray-400">
            {from + 1}–{Math.min(to + 1, count ?? 0)} з {count}
          </span>

          <Link
            href={buildRecipesHref({ nextPage: page + 1 })}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              page >= totalPages
                ? 'pointer-events-none opacity-30 border-gray-200'
                : 'border-gray-200 hover:border-gray-400'
            }`}
            aria-disabled={page >= totalPages}
          >
            Наступна →
          </Link>
        </div>
      )}
    </div>
  )
}
