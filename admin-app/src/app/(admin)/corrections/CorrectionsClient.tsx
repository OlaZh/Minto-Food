'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ActionButton from '@/components/moderation/ActionButton'
import { applyCorrection, dismissCorrections } from '@/app/actions/corrections'

interface Row {
  barcode: string
  name: string | null
  total_voters: number
  votes: number
  canon_kcal: number; canon_protein: number; canon_fat: number
  canon_carbs: number; canon_fiber: number; canon_sugar: number; canon_salt: number
  sug_kcal: number; sug_protein: number; sug_fat: number
  sug_carbs: number; sug_fiber: number; sug_sugar: number; sug_salt: number
  last_at: string | null
}

const MACROS = [
  { key: 'kcal', label: 'Ккал' },
  { key: 'protein', label: 'Б' },
  { key: 'fat', label: 'Ж' },
  { key: 'carbs', label: 'В' },
  { key: 'fiber', label: 'Кл' },
  { key: 'sugar', label: 'Цук' },
  { key: 'salt', label: 'Сіль' },
] as const

const n = (v: unknown) => (v == null ? 0 : Number(v))

function MacroCell({ label, canon, sug }: { label: string; canon: number; sug: number }) {
  const changed = Math.abs(canon - sug) > 0.05
  return (
    <div
      className={`rounded-md px-2 py-1 text-xs border ${
        changed ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="text-[10px] uppercase text-gray-400">{label}</div>
      {changed ? (
        <div className="flex items-center gap-1">
          <span className="text-gray-400 line-through">{canon}</span>
          <span className="text-gray-400">→</span>
          <span className="font-semibold text-amber-700">{sug}</span>
        </div>
      ) : (
        <div className="font-medium text-gray-700">{canon}</div>
      )}
    </div>
  )
}

export default function CorrectionsClient({ rows, error }: { rows: Row[]; error: string | null }) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = search
    ? rows.filter(
        (r) =>
          (r.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
          r.barcode.includes(search)
      )
    : rows

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Правки сканованих продуктів</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Пропозиції користувачів. Підсвічене — відрізняється від поточних даних.
          </p>
        </div>
        <span className="text-sm text-gray-400">{filtered.length} груп</span>
      </div>

      {error && (
        <div className="px-4 md:px-8 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {error}
        </div>
      )}

      <div className="px-4 md:px-8 py-3 border-b border-gray-100">
        <input
          type="text"
          placeholder="Пошук за назвою або штрихкодом…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-gray-400"
        />
      </div>

      {filtered.length === 0 && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">
          Пропозицій правок немає 🌿
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {filtered.map((r, i) => (
          <div key={`${r.barcode}-${i}`} className="px-4 md:px-8 py-4 hover:bg-gray-50">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.name || 'Без назви'}</p>
                <p className="text-xs text-gray-400">
                  {r.barcode} ·{' '}
                  <span className="font-medium text-amber-600">{n(r.votes)}</span> однакових
                  {n(r.total_voters) > n(r.votes) && (
                    <span className="text-gray-400"> / {n(r.total_voters)} усіх</span>
                  )}
                </p>
              </div>
              <span className="text-[11px] text-gray-400 shrink-0" suppressHydrationWarning>
                {r.last_at?.slice(0, 10)}
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 mb-3">
              {MACROS.map((m) => (
                <MacroCell
                  key={m.key}
                  label={m.label}
                  canon={n(r[`canon_${m.key}` as keyof Row])}
                  sug={n(r[`sug_${m.key}` as keyof Row])}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton
                label="Застосувати"
                confirmText="Оновити глобальні дані продукту?"
                variant="default"
                action={() =>
                  applyCorrection(r.barcode, {
                    kcal: n(r.sug_kcal),
                    protein: n(r.sug_protein),
                    fat: n(r.sug_fat),
                    carbs: n(r.sug_carbs),
                    fiber: n(r.sug_fiber),
                    sugar: n(r.sug_sugar),
                    salt: n(r.sug_salt),
                  })
                }
                onDone={() => router.refresh()}
              />
              <ActionButton
                label="Відхилити"
                confirmText="Прибрати всі правки цього штрихкоду?"
                variant="destructive"
                action={() => dismissCorrections(r.barcode)}
                onDone={() => router.refresh()}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
