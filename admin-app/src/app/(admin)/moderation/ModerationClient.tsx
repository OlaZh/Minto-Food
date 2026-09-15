'use client'

import Image from 'next/image'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ActionButton from '@/components/moderation/ActionButton'
import ModerationReasonDialog, { type ModerationReason } from '@/components/moderation/ModerationReasonDialog'
import { approveRecipe, rejectRecipe, banUser, addStrike, clearImageFlag, rejectImage } from '@/app/actions/moderation'
import { detectFlags } from '@/lib/autoFlag'
import AutoFlagBadges from '@/components/moderation/AutoFlagBadges'

type ModerationAuthor = {
  id: string
  full_name: string | null
  is_banned: boolean
  is_shadow_banned: boolean
  strikes: number | null
  created_at: string | null
  recipe_count: number
  report_count: number
}

type ModerationRecipe = {
  id: string
  slug: string | null
  name_ua: string | null
  name_en: string | null
  image: string | null
  status: string
  created_at: string | null
  category: string | null
  kcal: number | null
  steps: unknown
  is_public: boolean | null
  is_image_flagged: boolean | null
  image_nsfw_score: number | null
  has_pending_update: boolean | null
  media_revision: string | null
  media_error: boolean
  media: { section: string; kind: string; filename: string; url: string }[]
  staged_image: string | null
  author: ModerationAuthor | null
}

interface ModerationClientProps {
  recipes: ModerationRecipe[]
  page: number
  totalCount: number
  totalPages: number
}

type PendingDialog = {
  title: string
  action: (reason: ModerationReason) => Promise<unknown>
}

const passthroughImageLoader = ({ src }: { src: string }) => src

export default function ModerationClient({
  recipes,
  page,
  totalCount,
  totalPages,
}: ModerationClientProps) {
  const router = useRouter()
  const [dialog, setDialog] = useState<PendingDialog | null>(null)

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Модерація рецептів</h1>
        <span className="text-sm text-gray-400">{totalCount} на перевірці</span>
      </div>

      {recipes.length === 0 && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">Черга порожня 🌿</div>
      )}

      <div className="divide-y divide-gray-100">
        {recipes.map(recipe => {
          const author = recipe.author
          const name = recipe.name_ua || recipe.name_en || 'Без назви'
          const authorStrikes = author?.strikes ?? 0
          const stepsCount = (() => {
            try {
              const s = recipe.steps
              if (!s) return 0
              if (typeof s === 'string') return s.split('\n').filter(Boolean).length
              if (Array.isArray(s)) return s.length
              return 0
            } catch { return 0 }
          })()

          const flags = detectFlags(recipe)
          // A private recipe may be reviewed and edited, but it must not be
          // published until an admin explicitly makes it public. This also
          // protects imported rows that are missing ingredients/steps.
          const hasStaged = !!recipe.has_pending_update
          const canApprove = (hasStaged || recipe.is_public === true) && !recipe.media_error

          // The photo the admin must review is the STAGED one if present
          // (edit of a published recipe), otherwise the live photo.
          const reviewImage = recipe.staged_image ?? recipe.image

          return (
            <div key={recipe.id} className="px-4 md:px-8 py-4 hover:bg-gray-50">
              <div className="flex items-start gap-3">
                <div className="relative w-14 h-14 rounded-md overflow-hidden bg-gray-100 shrink-0">
                  {reviewImage
                    ? <Image src={reviewImage} alt={name} fill sizes="56px" unoptimized loader={passthroughImageLoader} className="object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">🍽</div>
                  }
                  {recipe.staged_image && (
                    <span className="absolute bottom-0 inset-x-0 bg-blue-600/80 text-white text-[9px] text-center leading-tight">staged</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/recipes/${recipe.id}/edit`} className="text-sm font-medium hover:underline">
                      {name}
                    </Link>
                    {recipe.slug && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_MAIN_SITE_URL}/recipe/${recipe.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-gray-600 leading-none"
                        title="Переглянути як користувач"
                      >↗</a>
                    )}
                    {recipe.category && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{recipe.category}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                    {author && (
                      <span>
                        Автор: <b className="text-gray-700">{author.full_name ?? '—'}</b>
                        {author.is_shadow_banned && ' 👁'}
                        {author.is_banned && ' 🚫'}
                        {authorStrikes > 0 && ` ⚡${authorStrikes}`}
                      </span>
                    )}
                    {recipe.kcal && <span>{recipe.kcal} ккал</span>}
                    {stepsCount > 0 && <span>{stepsCount} кроків</span>}
                    <span suppressHydrationWarning>{recipe.created_at?.slice(0, 10)}</span>
                  </div>
                  {author && (
                    <div className="flex gap-x-3 mt-0.5 text-xs text-gray-400">
                      <span>{author.recipe_count ?? 0} рецептів</span>
                      {(author.report_count ?? 0) > 0 && (
                        <span className="text-orange-500">{author.report_count} скарг</span>
                      )}
                      {author.created_at && (
                        <span>з {author.created_at.slice(0, 10)}</span>
                      )}
                    </div>
                  )}
                  <AutoFlagBadges flags={flags} />
                </div>

                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  recipe.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {recipe.status}
                </span>
              </div>

              {recipe.media_error && <p role="alert" className="mt-3 text-sm text-red-600">Не вдалося завантажити вкладення. Оновіть сторінку перед схваленням.</p>}
              {recipe.media.length > 0 && <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {recipe.media.map((item, index) => <div key={index} className="rounded border p-2 min-w-0">
                  <p className="text-xs text-gray-500">{{ ingredients: 'Інгредієнти', steps: 'Приготування', video: 'Відеорецепт' }[item.section] ?? item.section}</p>
                  {item.kind === 'image' && <Image src={item.url} alt={item.filename} width={480} height={320} unoptimized loader={passthroughImageLoader} className="max-h-80 w-full object-contain" />}
                  {item.kind === 'video' && <video src={item.url} controls preload="none" className="max-h-80 w-full" />}
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm underline break-all">{item.filename || item.url}</a>
                </div>)}
              </div>}
              <div className="flex flex-wrap gap-2 mt-3 pl-0 md:pl-17">
                {/* Only public recipes (or staged edits of an existing public
                    recipe) can be approved. Private/incomplete imports must be
                    corrected and explicitly made public first. */}
                {canApprove && (
                  <ActionButton
                    label={hasStaged ? 'Схвалити зміни' : 'Схвалити'}
                    confirmText={
                      hasStaged
                        ? 'Застосувати staged-зміни (фото + назва + кроки) до опублікованого рецепта?'
                        : (recipe.is_public ? 'Опублікувати рецепт?' : 'Схвалити?')
                    }
                    variant="default"
                    action={() => approveRecipe(recipe.id, recipe.media_revision)}
                    onDone={() => router.refresh()}
                  />
                )}
                <ActionButton
                  label={hasStaged ? 'Відхилити зміни' : 'Відхилити'}
                  confirmText={hasStaged ? 'Відхилити staged-зміни? Опублікований рецепт лишиться без змін.' : undefined}
                  variant="outline"
                  useUndo={!hasStaged}
                  action={() => rejectRecipe(recipe.id, '', recipe.media_revision)}
                  onDone={() => router.refresh()}
                />
                {/* Кнопки для ЖИВОГО flagged-фото (не staged): staged закриває
                    «Схвалити зміни»/«Відхилити зміни». */}
                {recipe.is_image_flagged && !hasStaged && (
                  <ActionButton
                    label="✓ Зняти флаг фото"
                    confirmText="Фото прийнятне? Зняти auto-flag?"
                    variant="outline"
                    action={() => clearImageFlag(recipe.id)}
                    onDone={() => router.refresh()}
                  />
                )}
                {recipe.is_image_flagged && !hasStaged && (
                  <ActionButton
                    label="✕ Відхилити фото"
                    confirmText="Прибрати фото рецепта? Рецепт лишиться без фото."
                    variant="outline"
                    action={() => rejectImage(recipe.id)}
                    onDone={() => router.refresh()}
                  />
                )}
                {author && !author.is_banned && (
                  <ActionButton
                    label={`⚡ Страйк (${authorStrikes})`}
                    variant="outline"
                    useUndo
                    action={() => addStrike(author.id, authorStrikes)}
                    onDone={() => router.refresh()}
                  />
                )}
                {author && !author.is_banned && (
                  <button
                    className="h-7 text-xs px-2.5 rounded-md border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors"
                    onClick={() => setDialog({
                      title: 'Бан автора',
                      action: (reason) => banUser(author.id, reason),
                    })}
                  >
                    Бан автора
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-4 md:px-8"
          aria-label="Сторінки черги модерації"
        >
          {page > 1 ? (
            <Link
              href={page === 2 ? '/moderation' : `/moderation?page=${page - 1}`}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              ← Попередня
            </Link>
          ) : (
            <span className="rounded-md border border-gray-100 px-3 py-2 text-sm text-gray-300" aria-disabled="true">
              ← Попередня
            </span>
          )}

          <span className="text-sm text-gray-500">
            Сторінка {page} з {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={`/moderation?page=${page + 1}`}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              Наступна →
            </Link>
          ) : (
            <span className="rounded-md border border-gray-100 px-3 py-2 text-sm text-gray-300" aria-disabled="true">
              Наступна →
            </span>
          )}
        </nav>
      )}

      <ModerationReasonDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialog?.title ?? ''}
        action={dialog?.action ?? (() => Promise.resolve())}
        onDone={() => router.refresh()}
      />
    </div>
  )
}
