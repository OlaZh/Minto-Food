'use client'

import Image from 'next/image'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ActionButton from '@/components/moderation/ActionButton'
import ModerationReasonDialog, { type ModerationReason } from '@/components/moderation/ModerationReasonDialog'
import {
  resolveReport, hideRecipeFromReport,
  deleteRecipeFromReport, banUser, addStrike,
} from '@/app/actions/moderation'
import { detectFlags } from '@/lib/autoFlag'
import AutoFlagBadges from '@/components/moderation/AutoFlagBadges'

const REASON_LABELS: Record<string, string> = {
  spam: 'Спам',
  inappropriate: 'Неприйнятний вміст',
  copyright: 'Авторські права',
  incorrect: 'Некоректний рецепт',
  other: 'Інше',
}

interface ReportAuthor {
  id: string
  full_name: string | null
  is_banned: boolean
  strikes: number
  created_at: string
  recipe_count: number
  report_count: number
}

interface ReportRecipe {
  id: string
  slug: string | null
  name_ua: string | null
  name_en: string | null
  image: string | null
  status: string
  category: string | null
  author: ReportAuthor | null
}

interface ReportItem {
  id: string
  reason: string | null
  created_at: string
  status: string
  recipe: ReportRecipe | null
  reporter: { full_name: string | null } | null
}

interface ReportsClientProps {
  reports: ReportItem[]
  currentStatus: string
}

const statuses = [
  { value: 'pending',   label: 'Очікують' },
  { value: 'resolved',  label: 'Вирішені' },
  { value: 'dismissed', label: 'Відхилені' },
  { value: 'all',       label: 'Всі' },
]

type PendingDialog = {
  title: string
  action: (reason: ModerationReason) => Promise<unknown>
}

export default function ReportsClient({ reports, currentStatus }: ReportsClientProps) {
  const router = useRouter()
  const [dialog, setDialog] = useState<PendingDialog | null>(null)

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Скарги</h1>
        <span className="text-sm text-gray-400">{reports.length} записів</span>
      </div>

      <div className="px-4 md:px-8 py-3 border-b border-gray-100 flex gap-2">
        {statuses.map(s => (
          <Link key={s.value} href={`/reports?status=${s.value}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              currentStatus === s.value
                ? 'bg-[#4ab584] text-white border-[#4ab584]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}>
            {s.label}
          </Link>
        ))}
      </div>

      {reports.length === 0 && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">Усе чисто 🌿</div>
      )}

      <div className="divide-y divide-gray-100">
        {reports.map(report => {
          const recipe = report.recipe
          const recipeId = recipe?.id ?? null
          const author = recipe?.author
          const name = recipe?.name_ua || recipe?.name_en || 'Без назви'
          const reasonLabel = report.reason ? REASON_LABELS[report.reason] ?? report.reason : '—'
          const flags = detectFlags(recipe ?? {})

          return (
            <div key={report.id} className="px-4 md:px-8 py-4 hover:bg-gray-50">
              <div className="flex items-start gap-3">
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 shrink-0">
                  {recipe?.image
                    ? <Image src={recipe.image} alt={name} width={48} height={48} className="w-full h-full object-cover" unoptimized />
                    : <div className="w-full h-full flex items-center justify-center text-gray-300">🍽</div>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium">{name}</p>
                    {recipe?.slug && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_MAIN_SITE_URL}/recipe/${recipe.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-gray-600 leading-none shrink-0"
                        title="Переглянути як користувач"
                      >↗</a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                    <span className="text-orange-600 font-medium">{reasonLabel}</span>
                    {author && <span>Автор: <b className="text-gray-700">{author.full_name ?? '—'}</b>{author.is_banned ? ' 🚫' : ''}{author.strikes > 0 ? ` ⚡${author.strikes}` : ''}</span>}
                    {report.reporter && <span>Скаржник: {report.reporter.full_name ?? '—'}</span>}
                    <span>{report.created_at?.slice(0, 10)}</span>
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

                {/* Status badge */}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  report.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  report.status === 'resolved' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {report.status}
                </span>
              </div>

              {/* Actions */}
              {report.status === 'pending' && (
                <div className="flex flex-wrap gap-2 mt-3 ml-15 pl-0 md:pl-15">
                  <ActionButton
                    label="Відхилити скаргу"
                    confirmText="Скаргу відхилити?"
                    variant="outline"
                    action={() => resolveReport(report.id, 'dismissed')}
                    onDone={() => router.refresh()}
                  />
                  <ActionButton
                    label="Приховати рецепт"
                    variant="outline"
                    useUndo
                    action={() => recipeId ? hideRecipeFromReport(report.id, recipeId) : Promise.resolve()}
                    onDone={() => router.refresh()}
                  />
                  <button
                    className="h-7 text-xs px-2.5 rounded-md border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors"
                    onClick={() => setDialog({
                      title: 'Видалити рецепт',
                      action: (reason) => recipeId ? deleteRecipeFromReport(report.id, recipeId, reason) : Promise.resolve(),
                    })}
                  >
                    Видалити рецепт
                  </button>
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
              )}
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
