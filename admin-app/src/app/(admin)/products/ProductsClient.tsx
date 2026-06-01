'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ActionButton from '@/components/moderation/ActionButton'
import { approveProduct, updateProductNutrition, softDeleteProduct } from '@/app/actions/moderation'

interface ProductRow {
  id: number
  name_ua: string | null
  name_en: string | null
  name_pl: string | null
  category_id: number | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  fiber: number | null
  label_type: string | null
  food_state: 'raw' | 'dry' | 'cooked' | null
  raw_edible: string | null
  created_at: string
  author?: { full_name: string | null } | null
}

interface ProductsClientProps {
  products: ProductRow[]
  errorMessage: string | null
  searchQuery: string
  page: number
  pageSize: number
  totalCount: number
}

function buildProductsHref(searchQuery: string, page: number) {
  const params = new URLSearchParams()
  if (searchQuery) params.set('q', searchQuery)
  params.set('page', String(page))
  return `/products?${params.toString()}`
}

function NutritionEditor({ product, onSaved }: { product: ProductRow; onSaved: () => void }) {
  const [kcal, setKcal] = useState(String(product.kcal ?? ''))
  const [protein, setProtein] = useState(String(product.protein ?? ''))
  const [fat, setFat] = useState(String(product.fat ?? ''))
  const [carbs, setCarbs] = useState(String(product.carbs ?? ''))
  const [fiber, setFiber] = useState(String(product.fiber ?? ''))
  const [labelType, setLabelType] = useState<'EU' | 'US'>(product.label_type === 'US' ? 'US' : 'EU')
  const [foodState, setFoodState] = useState<'raw' | 'dry' | 'cooked'>(product.food_state ?? 'raw')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await updateProductNutrition(product.id, {
        kcal: kcal !== '' ? parseFloat(kcal) : undefined,
        protein: protein !== '' ? parseFloat(protein) : undefined,
        fat: fat !== '' ? parseFloat(fat) : undefined,
        carbs: carbs !== '' ? parseFloat(carbs) : undefined,
        fiber: fiber !== '' ? parseFloat(fiber) : 0,
        label_type: labelType,
        food_state: foodState,
      })
      onSaved()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Помилка')
    }
    setSaving(false)
  }

  const field = (label: string, val: string, set: (v: string) => void) => (
    <label className="flex items-center gap-1 text-xs">
      <span className="text-gray-500 w-5">{label}</span>
      <input
        type="number" min="0" max="9999" step="0.1"
        value={val} onChange={e => set(e.target.value)}
        className="w-16 border border-gray-200 rounded px-1.5 py-1 text-xs outline-none focus:border-gray-400"
      />
    </label>
  )

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      {field('Ккал', kcal, setKcal)}
      {field('Б', protein, setProtein)}
      {field('Ж', fat, setFat)}
      {field('В', carbs, setCarbs)}
      {field('Кл', fiber, setFiber)}
      <div className="flex items-center gap-1 text-xs">
        <span className="text-gray-500">Стандарт</span>
        {(['EU', 'US'] as const).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setLabelType(v)}
            className={`px-2 py-1 rounded text-xs font-semibold border transition-colors ${
              labelType === v
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs">
        <span className="text-gray-500">Стан</span>
        <select
          value={foodState}
          onChange={e => setFoodState(e.target.value as 'raw' | 'dry' | 'cooked')}
          className="border border-gray-200 rounded px-1.5 py-1 text-xs outline-none focus:border-gray-400 bg-white"
        >
          <option value="raw">Сирий</option>
          <option value="dry">Сухий</option>
          <option value="cooked">Готовий</option>
        </select>
      </div>
      <button
        onClick={save} disabled={saving}
        className="text-xs h-7 px-2 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50">
        {saving ? '…' : '✓'}
      </button>
    </div>
  )
}

const RAW_EDIBLE_OPTIONS = [
  { value: 'always', label: 'Завжди показувати' },
  { value: 'sometimes', label: 'Показувати як сире' },
  { value: 'never', label: 'Не показувати' },
]

export default function ProductsClient({
  products,
  errorMessage,
  searchQuery,
  page,
  pageSize,
  totalCount,
}: ProductsClientProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [rawEdibleMap, setRawEdibleMap] = useState<Record<number, string>>({})

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Юзерські продукти</h1>
        <span className="text-sm text-gray-400">{totalCount} записів</span>
      </div>

      <div className="px-4 md:px-8 py-3 border-b border-gray-100">
        <form className="flex flex-wrap gap-2">
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder="Пошук за назвою…"
            className="w-full max-w-sm text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-gray-400"
          />
          <button
            type="submit"
            className="h-9 px-3 text-sm rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors"
          >
            Знайти
          </button>
        </form>
      </div>

      {errorMessage && (
        <div className="px-4 md:px-8 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {errorMessage}
        </div>
      )}

      {totalCount > 0 && (
        <div className="px-4 md:px-8 py-2 text-xs text-gray-400 border-b border-gray-100">
          {from}–{to} з {totalCount}
        </div>
      )}

      {products.length === 0 && !errorMessage && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">Продуктів немає 🌿</div>
      )}

      <div className="divide-y divide-gray-100">
        {products.map(product => {
          const name = product.name_ua || product.name_en || product.name_pl || 'Без назви'
          const isEditing = editingId === product.id
          const rawEdible = rawEdibleMap[product.id]

          return (
            <div key={product.id} className="px-4 md:px-8 py-4 hover:bg-gray-50">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                    {product.kcal != null && <span>{product.kcal} ккал</span>}
                    {product.protein != null && (
                      <span>Б:{product.protein} Ж:{product.fat} В:{product.carbs}{(product.fiber ?? 0) > 0 ? ` Кл:${product.fiber}` : ''}</span>
                    )}
                    {product.label_type && product.label_type !== 'EU' && (
                      <span className="text-amber-500">{product.label_type}</span>
                    )}
                    {product.category_id && <span>Категорія #{product.category_id}</span>}
                    {product.author && <span>Від: {product.author.full_name ?? '—'}</span>}
                    <span suppressHydrationWarning>{product.created_at?.slice(0, 10)}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-400">Відображення:</span>
                    <select
                      value={rawEdible ?? product.raw_edible ?? ''}
                      onChange={e => {
                        const value = e.target.value
                        if (value) setRawEdibleMap(m => ({ ...m, [product.id]: value }))
                      }}
                      className={`text-xs border rounded px-1.5 py-1 outline-none bg-white ${
                        rawEdible || product.raw_edible ? 'border-gray-400' : 'border-orange-300 text-orange-600'
                      }`}
                    >
                      <option value="">— вибери —</option>
                      {RAW_EDIBLE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {isEditing && (
                    <NutritionEditor
                      product={product}
                      onSaved={() => {
                        setEditingId(null)
                        router.refresh()
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {(rawEdible || product.raw_edible) ? (
                  <ActionButton
                    label="Схвалити"
                    confirmText="Зробити загальним продуктом?"
                    variant="default"
                    action={() => approveProduct(product.id, rawEdible || product.raw_edible || 'always')}
                    onDone={() => router.refresh()}
                  />
                ) : (
                  <button
                    disabled
                    title="Спочатку вибери статус відображення"
                    className="h-7 text-xs px-2.5 border border-gray-200 rounded-md opacity-40 cursor-not-allowed"
                  >
                    Схвалити
                  </button>
                )}
                <button
                  onClick={() => setEditingId(isEditing ? null : product.id)}
                  className="h-7 text-xs px-2.5 border border-gray-200 rounded-md hover:border-gray-400 transition-colors">
                  {isEditing ? 'Закрити' : 'КБЖУ'}
                </button>
                <ActionButton
                  label="Видалити"
                  confirmText="Видалити продукт?"
                  variant="destructive"
                  action={() => softDeleteProduct(product.id)}
                  onDone={() => router.refresh()}
                />
              </div>
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="px-4 md:px-8 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
          <Link
            href={buildProductsHref(searchQuery, Math.max(1, page - 1))}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              page <= 1 ? 'pointer-events-none opacity-30 border-gray-200' : 'border-gray-200 hover:border-gray-400'
            }`}
            aria-disabled={page <= 1}
          >
            ← Попередня
          </Link>

          <span className="text-xs text-gray-400">
            сторінка {page} з {totalPages}
          </span>

          <Link
            href={buildProductsHref(searchQuery, Math.min(totalPages, page + 1))}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              page >= totalPages ? 'pointer-events-none opacity-30 border-gray-200' : 'border-gray-200 hover:border-gray-400'
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
