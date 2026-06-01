'use client'

import Image from 'next/image'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ActionButton from '@/components/moderation/ActionButton'
import ModerationReasonDialog, { type ModerationReason } from '@/components/moderation/ModerationReasonDialog'
import { approveRecipe, rejectRecipe, banUser, addStrike } from '@/app/actions/moderation'
import { detectFlags } from '@/lib/autoFlag'
import AutoFlagBadges from '@/components/moderation/AutoFlagBadges'

interface ModerationAuthor {
  id: string
  full_name: string | null
  is_banned: boolean
  is_shadow_banned: boolean
  strikes: number
  created_at: string
  recipe_count: number
  report_count: number
}

interface ModerationRecipe {
  id: string
  slug: string | null
  name_ua: string | null
  name_en: string | null
  image: string | null
  category: string | null
  kcal: number | null
  steps: string | string[] | null
  created_at: string
  author: ModerationAuthor | null
}

interface ModerationClientProps {
  recipes: ModerationRecipe[]
}

type PendingDialog = {
  title: string
  action: (reason: ModerationReason) => Promise<unknown>
}

export default function ModerationClient({ recipes }: ModerationClientProps) {
  const router = useRouter()
  const [dialog, setDialog] = useState<PendingDialog | null>(null)

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Модерація рецептів</h1>
        <span className="text-sm text-gray-400">{recipes.length} на перевірці</span>
      </div>

      {recipes.length === 0 && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">Черга порожня 🌿</div>
      )}

      <div className="divide-y divide-gray-100">
        {recipes.map(recipe => {
          const author = recipe.author
          const name = recipe.name_ua || recipe.name_en || 'Без назви'
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

          return (
            <div key={recipe.id} className="px-4 md:px-8 py-4 hover:bg-gray-50">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-100 shrink-0">
                  {recipe.image
                    ? <Image src={recipe.image} alt={name} width={56} height={56} className="w-full h-full object-cover" unoptimized />
                    : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">🍽</div>
                  }
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
                        {author.strikes > 0 && ` ⚡${author.strikes}`}
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

                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                  pending
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mt-3 pl-0 md:pl-17">
                <ActionButton
                  label="Схвалити"
                  confirmText="Опублікувати рецепт?"
                  variant="default"
                  action={() => approveRecipe(recipe.id)}
                  onDone={() => router.refresh()}
                />
                <ActionButton
                  label="Відхилити"
                  variant="outline"
                  useUndo
                  action={() => rejectRecipe(recipe.id, '')}
                  onDone={() => router.refresh()}
                />
                {author && !author.is_banned && (
                  <ActionButton
                    label={`⚡ Страйк (${author.strikes ?? 0})`}
                    variant="outline"
                    useUndo
                    action={() => addStrike(author.id, author.strikes ?? 0)}
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
