'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ActionButton from '@/components/moderation/ActionButton'
import {
  applyCorrection,
  approveNameCorrection,
  dismissCorrections,
  rejectNameCorrection,
} from '@/app/actions/corrections'

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

interface NameRow {
  proposal_id: string
  barcode: string
  language: 'ua' | 'pl' | 'en'
  proposed_name: string
  proposed_brand: string | null
  status: 'pending' | 'approved' | 'rejected'
  submitted_by: string
  submitter_name: string | null
  current_name_ua: string | null
  current_name_pl: string | null
  current_name_en: string | null
  current_brand: string | null
  created_at: string
  updated_at: string
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

interface Props {
  rows: Row[]
  error: string | null
  nameRows: NameRow[]
  nameError: string | null
}

async function ensureActionSucceeded(
  action: Promise<{ ok?: boolean; error?: string }>,
) {
  const result = await action
  if (result.error) throw new Error(result.error)
}

function currentName(row: NameRow) {
  if (row.language === 'ua') return row.current_name_ua
  if (row.language === 'pl') return row.current_name_pl
  return row.current_name_en
}

export default function CorrectionsClient({ rows, error, nameRows, nameError }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = search
    ? rows.filter(
        (r) =>
          (r.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
          r.barcode.includes(search)
      )
    : rows

  const normalizedSearch = search.trim().toLowerCase()
  const filteredNameRows = normalizedSearch
    ? nameRows.filter((row) =>
        row.proposed_name.toLowerCase().includes(normalizedSearch) ||
        (currentName(row) ?? '').toLowerCase().includes(normalizedSearch) ||
        (row.proposed_brand ?? '').toLowerCase().includes(normalizedSearch) ||
        row.barcode.includes(normalizedSearch)
      )
    : nameRows

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Правки сканованих продуктів</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Пропозиції користувачів. Підсвічене — відрізняється від поточних даних.
          </p>
        </div>
        <span className="text-sm text-gray-400">
          {filteredNameRows.length} назв · {filtered.length} КБЖВ
        </span>
      </div>

      {error && (
        <div className="px-4 md:px-8 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {error}
        </div>
      )}

      {nameError && (
        <div className="px-4 md:px-8 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
          Назви: {nameError}
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

      <section className="border-b border-gray-200">
        <div className="px-4 md:px-8 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Запропоновані назви</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Користувач уже бачить цю назву особисто. Спільна база зміниться лише після підтвердження.
          </p>
        </div>

        {filteredNameRows.length === 0 ? (
          <div className="px-4 md:px-8 py-10 text-center text-gray-400 text-sm">
            Нових пропозицій назв немає
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNameRows.map((row) => {
              const canonicalName = currentName(row)
              return (
                <div key={row.proposal_id} className="px-4 md:px-8 py-4 hover:bg-gray-50">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                          {row.language}
                        </span>
                        <span className="text-xs text-gray-400">{row.barcode}</span>
                      </div>
                      <div className="grid sm:grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                        <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                          <div className="text-[10px] uppercase text-gray-400">Зараз у базі</div>
                          <div className="mt-0.5 text-gray-600">{canonicalName || 'Без назви цією мовою'}</div>
                          {row.current_brand && (
                            <div className="text-xs text-gray-400">Марка: {row.current_brand}</div>
                          )}
                        </div>
                        <span className="hidden sm:block text-gray-300">→</span>
                        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                          <div className="text-[10px] uppercase text-amber-600">Пропонує</div>
                          <div className="mt-0.5 font-semibold text-amber-800">{row.proposed_name}</div>
                          {row.proposed_brand && (
                            <div className="text-xs text-amber-700">Марка: {row.proposed_brand}</div>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-gray-400">
                        Від: {row.submitter_name || row.submitted_by.slice(0, 8)} ·{' '}
                        <span suppressHydrationWarning>{row.updated_at.slice(0, 16).replace('T', ' ')}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <ActionButton
                        label="Підтвердити"
                        confirmText="Записати цю назву у спільну базу?"
                        variant="default"
                        action={() => ensureActionSucceeded(approveNameCorrection(row.proposal_id))}
                        onDone={() => router.refresh()}
                      />
                      <ActionButton
                        label="Відхилити"
                        confirmText="Відхилити цю пропозицію без зміни спільної бази?"
                        variant="destructive"
                        action={() => ensureActionSucceeded(rejectNameCorrection(row.proposal_id))}
                        onDone={() => router.refresh()}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="px-4 md:px-8 py-3 bg-gray-50 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Запропоновані КБЖВ</h2>
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
                  ensureActionSucceeded(applyCorrection(r.barcode, {
                    kcal: n(r.sug_kcal),
                    protein: n(r.sug_protein),
                    fat: n(r.sug_fat),
                    carbs: n(r.sug_carbs),
                    fiber: n(r.sug_fiber),
                    sugar: n(r.sug_sugar),
                    salt: n(r.sug_salt),
                  }))
                }
                onDone={() => router.refresh()}
              />
              <ActionButton
                label="Відхилити"
                confirmText="Прибрати всі правки цього штрихкоду?"
                variant="destructive"
                action={() => ensureActionSucceeded(dismissCorrections(r.barcode))}
                onDone={() => router.refresh()}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
