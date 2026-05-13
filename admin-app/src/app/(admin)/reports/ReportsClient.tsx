'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ActionButton from '@/components/moderation/ActionButton'
import {
  resolveReport, hideRecipeFromReport,
  deleteRecipeFromReport, banUser, addStrike,
} from '@/app/actions/moderation'

const REASON_LABELS: Record<string, string> = {
  spam: 'Спам',
  inappropriate: 'Неприйнятний вміст',
  copyright: 'Авторські права',
  incorrect: 'Некоректний рецепт',
  other: 'Інше',
}

interface ReportsClientProps {
  reports: any[]
  currentStatus: string
}

const statuses = [
  { value: 'pending',   label: 'Очікують' },
  { value: 'resolved',  label: 'Вирішені' },
  { value: 'dismissed', label: 'Відхилені' },
  { value: 'all',       label: 'Всі' },
]

export default function ReportsClient({ reports, currentStatus }: ReportsClientProps) {
  const router = useRouter()

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
          const author = recipe?.author
          const name = recipe?.name_ua || recipe?.name_en || 'Без назви'
          const reasonLabel = REASON_LABELS[report.reason] ?? report.reason ?? '—'

          return (
            <div key={report.id} className="px-4 md:px-8 py-4 hover:bg-gray-50">
              <div className="flex items-start gap-3">
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 shrink-0">
                  {recipe?.image
                    ? <img src={recipe.image} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-300">🍽</div>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                    <span className="text-orange-600 font-medium">{reasonLabel}</span>
                    {author && <span>Автор: <b className="text-gray-700">{author.full_name ?? '—'}</b>{author.is_banned ? ' 🚫' : ''}</span>}
                    {report.reporter && <span>Скаржник: {report.reporter.full_name ?? '—'}</span>}
                    <span>{report.created_at?.slice(0, 10)}</span>
                  </div>
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
                    confirmText="Перевести в чернетку?"
                    variant="outline"
                    action={() => hideRecipeFromReport(report.id, recipe?.id)}
                    onDone={() => router.refresh()}
                  />
                  <ActionButton
                    label="Видалити рецепт"
                    confirmText="Видалити назавжди?"
                    variant="destructive"
                    action={() => deleteRecipeFromReport(report.id, recipe?.id)}
                    onDone={() => router.refresh()}
                  />
                  {author && !author.is_banned && (
                    <ActionButton
                      label={`⚡ Страйк (${author.strikes ?? 0})`}
                      confirmText="Видати страйк?"
                      variant="outline"
                      action={() => addStrike(author.id, author.strikes ?? 0)}
                      onDone={() => router.refresh()}
                    />
                  )}
                  {author && !author.is_banned && (
                    <ActionButton
                      label="Бан автора"
                      confirmText="Забанити?"
                      variant="destructive"
                      action={() => banUser(author.id)}
                      onDone={() => router.refresh()}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
