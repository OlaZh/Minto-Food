'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ActionButton from '@/components/moderation/ActionButton'
import { setUnmatchedStatus } from '@/app/actions/unmatched'

interface Row {
  id: string
  term_normalized: string
  term_raw: string
  lang: string | null
  source: string | null
  times_seen: number
  status: string
  first_seen_at: string | null
  last_seen_at: string | null
}

const SOURCE_LABEL: Record<string, string> = {
  recipe: 'Рецепт',
  shopping: 'Список покупок',
}

export default function UnmatchedClient({ rows, error }: { rows: Row[]; error: string | null }) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = search
    ? rows.filter(
        (r) =>
          r.term_raw.toLowerCase().includes(search.toLowerCase()) ||
          r.term_normalized.includes(search.toLowerCase())
      )
    : rows

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Нерозпізнані продукти</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Що люди вводили, але система не знайшла в базі. Сортування за популярністю —
            додайте найхідовіші в каталог або як аліас.
          </p>
        </div>
        <span className="text-sm text-gray-400">{filtered.length} термінів</span>
      </div>

      {error && (
        <div className="px-4 md:px-8 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {error}
        </div>
      )}

      <div className="px-4 md:px-8 py-3 border-b border-gray-100">
        <input
          type="text"
          placeholder="Пошук за назвою…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-gray-400"
        />
      </div>

      {filtered.length === 0 && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">
          Нерозпізнаних продуктів немає 🌿
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {filtered.map((r) => (
          <div key={r.id} className="px-4 md:px-8 py-4 hover:bg-gray-50">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.term_raw}</p>
                <p className="text-xs text-gray-400">
                  <span className="font-semibold text-amber-600">{r.times_seen}×</span> введено
                  {r.source && (
                    <span className="text-gray-400"> · {SOURCE_LABEL[r.source] ?? r.source}</span>
                  )}
                  {r.lang && <span className="text-gray-400"> · {r.lang}</span>}
                </p>
              </div>
              <span className="text-[11px] text-gray-400 shrink-0" suppressHydrationWarning>
                {r.last_seen_at?.slice(0, 10)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton
                label="Опрацьовано"
                variant="default"
                action={() => setUnmatchedStatus(r.id, 'resolved')}
                onDone={() => router.refresh()}
              />
              <ActionButton
                label="Ігнорувати"
                confirmText="Прибрати з черги як сміття?"
                variant="destructive"
                action={() => setUnmatchedStatus(r.id, 'ignored')}
                onDone={() => router.refresh()}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
