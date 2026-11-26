import Link from 'next/link'
import { Suspense } from 'react'
import { Clock, Edit } from 'lucide-react'
import { publishScheduledRecipes } from '@/app/actions/recipes'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { RECIPE_STATUS_LABELS } from '@/lib/recipe-status'
import NewRecipeLink from './NewRecipeLink'
import { RecipeListPhotos, RecipeThumbnail } from './RecipeListPhotos'

const STATUS_TABS = [
  { value: 'all', label: 'Всі' },
  { value: 'draft', label: 'Чернетки' },
  { value: 'scheduled', label: 'Заплановані' },
  { value: 'published', label: 'Опубліковані' },
  { value: 'pending', label: 'Модерація' },
  { value: 'rejected', label: 'Відхилені' },
]

const PAGE_SIZE = 100
const RECIPE_LIST_COLUMNS = `
  id, name_ua, name_en, name_pl, status, created_at, is_public,
  kcal, category, type, available_locales, author_profile_id,
  author_profile:recipe_author_profiles(display_name)
`

type RecipeAuthor = {
  display_name: string | null
}

type RecipeRow = {
  id: string
  name_ua: string | null
  name_en: string | null
  name_pl: string | null
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

function buildRecipesHref(status: string, query: string, page = 1) {
  const search = new URLSearchParams()

  if (status && status !== 'all') search.set('status', status)
  if (query) search.set('q', query)
  if (page > 1) search.set('page', String(page))

  const queryString = search.toString()
  return queryString ? `/recipes?${queryString}` : '/recipes'
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const activeStatus = params.status ?? 'all'
  const activeQuery = params.q?.trim() ?? ''

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
          <NewRecipeLink />
        </div>
      </div>

      <div className="px-4 md:px-8 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map(tab => (
          <Link
            key={tab.value}
            href={buildRecipesHref(tab.value, activeQuery)}
            prefetch={false}
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
            <Link href={buildRecipesHref(activeStatus, '')} prefetch={false}>
              <Button type="button" variant="ghost" size="sm">
                Очистити
              </Button>
            </Link>
          )}
        </form>
      </div>

      <Suspense
        key={buildRecipesHref(activeStatus, activeQuery, page)}
        fallback={<p role="status" className="px-4 py-6 text-sm text-gray-500 md:px-8">Завантажуємо рецепти…</p>}
      >
        <RecipesResults status={activeStatus} search={activeQuery} page={page} />
      </Suspense>
    </div>
  )
}

async function RecipesResults({ status, search, page }: { status: string; search: string; page: number }) {
  const supabase = await createClient()
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  function loadRecipes(withCount: boolean) {
    let query = supabase
      .from('recipes')
      .select(RECIPE_LIST_COLUMNS, withCount ? { count: 'exact' } : undefined)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })

    if (status !== 'all') query = query.eq('status', status)
    if (search) {
      query = query.or(`name_ua.ilike.%${search}%,name_en.ilike.%${search}%,name_pl.ilike.%${search}%`)
    }

    return query.range(from, withCount ? to : to + 1)
  }

  const result = await loadRecipes(true)
  // Retry without the exact total and use one extra row for pagination.
  const { data, error, count } = result.error?.code === '57014' ? await loadRecipes(false) : result
  const recipes = (data as RecipeRow[] | null)?.slice(0, PAGE_SIZE) ?? []
  const totalPages = count == null ? null : Math.max(1, Math.ceil(count / PAGE_SIZE))
  const hasNextPage = totalPages == null ? (data?.length ?? 0) > PAGE_SIZE : page < totalPages
  const showPagination = totalPages == null ? page > 1 || hasNextPage : totalPages > 1

  return (
    <>
      {error && (
        <div className="px-4 md:px-8 py-6 text-sm text-red-500">
          {error.code === '57014' ? 'База даних не встигла відповісти. Спробуйте оновити сторінку.' : `Помилка: ${error.message}`}
        </div>
      )}

      {!error && recipes.length === 0 && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400">
          <p className="text-sm">Рецептів не знайдено</p>
          <Link href="/recipes/new" prefetch={false} className="mt-3 inline-block">
            <Button variant="outline" size="sm">Створити перший</Button>
          </Link>
        </div>
      )}

      {!error && (totalPages != null || recipes.length > 0) && (
        <div className="px-4 md:px-8 py-2 text-xs text-gray-400 border-b border-gray-100">
          {totalPages == null ? `Сторінка ${page}` : `${count} рецептів · сторінка ${page} з ${totalPages}`}
          {search && <span> · фільтр: “{search}”</span>}
        </div>
      )}

      <RecipeListPhotos>
        {recipes.map(recipe => {
          const status = RECIPE_STATUS_LABELS[recipe.status] ?? RECIPE_STATUS_LABELS.draft
          const author = getAuthorProfile(recipe.author_profile)
          const recipeName = recipe.name_ua || recipe.name_en || recipe.name_pl || '(без назви)'

          return (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}/edit`}
              prefetch={false}
              className="flex items-center gap-4 px-4 md:px-8 py-3 hover:bg-gray-50 group cursor-pointer"
            >
              <RecipeThumbnail id={String(recipe.id)} name={recipeName} />

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
      </RecipeListPhotos>

      {!error && showPagination && (
        <div className="px-4 md:px-8 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
          <Link
            href={buildRecipesHref(status, search, page - 1)}
            prefetch={false}
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
            {count == null ? `Сторінка ${page}` : `${from + 1}–${Math.min(to + 1, count)} з ${count}`}
          </span>

          <Link
            href={buildRecipesHref(status, search, page + 1)}
            prefetch={false}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              !hasNextPage
                ? 'pointer-events-none opacity-30 border-gray-200'
                : 'border-gray-200 hover:border-gray-400'
            }`}
            aria-disabled={!hasNextPage}
          >
            Наступна →
          </Link>
        </div>
      )}
    </>
  )
}
