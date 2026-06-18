'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { updateFeatureFlag } from '@/app/actions/feature-flags'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

type FeatureFlagItem = {
  key: string
  enabled: boolean
  rollout_pct: number
  target_users: string[] | null
  description: string | null
  updated_at: string
  updated_by_id: string | null
  updated_by_name: string | null
}

type DraftState = {
  enabled: boolean
  rolloutPct: string
  targetUsers: string
  description: string
}

function buildDraft(flag: FeatureFlagItem): DraftState {
  return {
    enabled: flag.enabled,
    rolloutPct: String(flag.rollout_pct),
    targetUsers: (flag.target_users ?? []).join('\n'),
    description: flag.description ?? '',
  }
}

function buildDraftMap(flags: FeatureFlagItem[]) {
  return Object.fromEntries(flags.map(flag => [flag.key, buildDraft(flag)]))
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat('uk-UA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function FeatureFlagsClient({ flags }: { flags: FeatureFlagItem[] }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(() => buildDraftMap(flags))
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function setDraftValue(key: string, patch: Partial<DraftState>) {
    setDrafts(current => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }))
  }

  function resetDraft(flag: FeatureFlagItem) {
    setDrafts(current => ({
      ...current,
      [flag.key]: buildDraft(flag),
    }))
  }

  function isDirty(flag: FeatureFlagItem) {
    const draft = drafts[flag.key] ?? buildDraft(flag)
    const initial = buildDraft(flag)

    return (
      draft.enabled !== initial.enabled ||
      draft.rolloutPct.trim() !== initial.rolloutPct.trim() ||
      draft.targetUsers.trim() !== initial.targetUsers.trim() ||
      draft.description.trim() !== initial.description.trim()
    )
  }

  function handleSave(flag: FeatureFlagItem) {
    const draft = drafts[flag.key] ?? buildDraft(flag)
    const rolloutPct = draft.rolloutPct.trim() === '' ? Number.NaN : Number(draft.rolloutPct)

    setSavingKey(flag.key)
    startTransition(async () => {
      try {
        await updateFeatureFlag({
          key: flag.key,
          enabled: draft.enabled,
          rolloutPct,
          targetUsersInput: draft.targetUsers,
          description: draft.description,
        })
        toast.success(`Збережено: ${flag.key}`)
        router.refresh()
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'Не вдалося зберегти зміни')
      } finally {
        setSavingKey(null)
      }
    })
  }

  const enabledCount = flags.filter(flag => flag.enabled).length

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-lg font-semibold">Керування функціями</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Тут можна вмикати або вимикати функції без нового деплою. Кеш на основному сайті
              може оновлюватися до 5 хвилин.
            </p>
          </div>
          <div className="text-xs text-gray-500">
            Увімкнено {enabledCount} з {flags.length}
          </div>
        </div>
      </div>

      {flags.length === 0 ? (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">
          Прапорців функцій поки немає.
        </div>
      ) : (
        <div className="px-4 md:px-8 py-6 space-y-4">
          {flags.map(flag => {
            const draft = drafts[flag.key] ?? buildDraft(flag)
            const dirty = isDirty(flag)
            const isSaving = pending && savingKey === flag.key
            const updatedBy = flag.updated_by_name ?? flag.updated_by_id?.slice(0, 8) ?? 'system'

            return (
              <section
                key={flag.key}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-gray-900">{flag.key}</h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          draft.enabled
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {draft.enabled ? 'Увімкнено' : 'Вимкнено'}
                      </span>
                      {dirty && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          Є незбережені зміни
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {flag.description?.trim() || 'Опис ще не додано.'}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Оновлено: {formatUpdatedAt(flag.updated_at)} • {updatedBy}
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={event => setDraftValue(flag.key, { enabled: event.target.checked })}
                      disabled={isSaving}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Увімкнено
                  </label>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                      Відсоток запуску
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={draft.rolloutPct}
                      onChange={event => setDraftValue(flag.key, { rolloutPct: event.target.value })}
                      disabled={isSaving}
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      `0` вимикає запуск, `100` відкриває функцію для всіх.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                      Опис
                    </label>
                    <Textarea
                      value={draft.description}
                      onChange={event => setDraftValue(flag.key, { description: event.target.value })}
                      disabled={isSaving}
                      className="min-h-20"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    ID користувачів для точкового доступу
                  </label>
                  <Textarea
                    value={draft.targetUsers}
                    onChange={event => setDraftValue(flag.key, { targetUsers: event.target.value })}
                    disabled={isSaving}
                    className="min-h-28 font-mono text-xs"
                    placeholder="Один UUID у рядку або список через кому"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Ці користувачі отримають функцію незалежно від відсотка запуску.
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSave(flag)}
                    disabled={!dirty || isSaving}
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Зберегти
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => resetDraft(flag)}
                    disabled={!dirty || isSaving}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Скинути
                  </Button>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
