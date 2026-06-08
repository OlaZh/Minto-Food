'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ActionButton from '@/components/moderation/ActionButton'
import { approveProduct, softDeleteProduct, updateProductNutrition } from '@/app/actions/moderation'

type ProductAuthor = {
  full_name: string | null
}

type ProductListItem = {
  id: number
  name_ua: string | null
  name_en: string | null
  category_id: string | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  fiber: number | null
  label_type: string | null
  food_state: 'raw' | 'dry' | 'cooked' | null
  raw_edible: string | null
  created_at: string | null
  author: ProductAuthor | null
}

interface ProductsClientProps {
  products: ProductListItem[]
  page: number
  totalPages: number
  totalCount: number
}

function NutritionEditor({ product, onSaved }: { product: ProductListItem; onSaved: () => void }) {
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Помилка')
    }
    setSaving(false)
  }

  const field = (label: string, value: string, setValue: (nextValue: string) => void) => (
    <label className="flex items-center gap-1 text-xs">
      <span className="text-gray-500 w-5">{label}</span>
      <input
        type="number"
        min="0"
        max="9999"
        step="0.1"
        value={value}
        onChange={event => setValue(event.target.value)}
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
        {(['EU', 'US'] as const).map(value => (
          <button
            key={value}
            type="button"
            onClick={() => setLabelType(value)}
            className={`px-2 py-1 rounded text-xs font-semibold border transition-colors ${
              labelType === value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs">
        <span className="text-gray-500">Стан</span>
        <select
          value={foodState}
          onChange={event => setFoodState(event.target.value as 'raw' | 'dry' | 'cooked')}
          className="border border-gray-200 rounded px-1.5 py-1 text-xs outline-none focus:border-gray-400 bg-white"
        >
          <option value="raw">Сирий</option>
          <option value="dry">Сухий</option>
          <option value="cooked">Готовий</option>
        </select>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="text-xs h-7 px-2 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
      >
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

export default function ProductsClient({ products, page, totalPages, totalCount }: ProductsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [rawEdibleMap, setRawEdibleMap] = useState<Record<number, string>>({})
  const normalizedSearch = search.trim().toLowerCase()

  const filtered = normalizedSearch
    ? products.filter(product =>
        (product.name_ua ?? '').toLowerCase().includes(normalizedSearch) ||
        (product.name_en ?? '').toLowerCase().includes(normalizedSearch)
      )
    : products

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Юзерські продукти</h1>
        <span className="text-sm text-gray-400">{filtered.length} на сторінці</span>
      </div>

      <div className="px-4 md:px-8 py-3 border-b border-gray-100 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Пошук за назвою на поточній сторінці…"
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full max-w-sm text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-gray-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="h-8 px-3 text-xs rounded-md border border-gray-200 hover:border-gray-400 transition-colors"
            >
              Очистити
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">
          Швидкий фільтр працює лише в межах відкритої сторінки.
        </p>
      </div>

      {totalCount > 0 && (
        <div className="px-4 md:px-8 py-2 text-xs text-gray-400 border-b border-gray-100">
          {totalCount} продуктів · сторінка {page} з {totalPages}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">
          {search ? 'На цій сторінці нічого не знайдено за цим фільтром' : 'Продуктів немає'}
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {filtered.map(product => {
          const name = product.name_ua || product.name_en || 'Без назви'
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
                      <span>
                        Б:{product.protein} Ж:{product.fat} В:{product.carbs}
                        {(product.fiber ?? 0) > 0 ? ` Кл:${product.fiber}` : ''}
                      </span>
                    )}
                    {product.label_type && product.label_type !== 'EU' && (
                      <span className="text-amber-500">{product.label_type}</span>
                    )}
                    {product.category_id && <span>{product.category_id}</span>}
                    {product.author && <span>Від: {product.author.full_name ?? '—'}</span>}
                    <span suppressHydrationWarning>{product.created_at?.slice(0, 10)}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-400">Відображення:</span>
                    <select
                      value={rawEdible ?? ''}
                      onChange={event => {
                        const value = event.target.value
                        if (value) {
                          setRawEdibleMap(currentMap => ({ ...currentMap, [product.id]: value }))
                        }
                      }}
                      className={`text-xs border rounded px-1.5 py-1 outline-none bg-white ${
                        rawEdible ? 'border-gray-400' : 'border-orange-300 text-orange-600'
                      }`}
                    >
                      <option value="">— вибери —</option>
                      {RAW_EDIBLE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {product.raw_edible && !rawEdible && (
                      <span className="text-xs text-gray-400">зараз: {product.raw_edible}</span>
                    )}
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
                {rawEdible ? (
                  <ActionButton
                    label="Схвалити"
                    confirmText="Зробити загальним продуктом?"
                    variant="default"
                    action={() => approveProduct(product.id, rawEdible)}
                    onDone={() => router.refresh()}
                  />
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Спочатку вибери статус відображення"
                    className="h-7 text-xs px-2.5 border border-gray-200 rounded-md opacity-40 cursor-not-allowed"
                  >
                    Схвалити
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditingId(isEditing ? null : product.id)}
                  className="h-7 text-xs px-2.5 border border-gray-200 rounded-md hover:border-gray-400 transition-colors"
                >
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
            href={`/products?page=${page - 1}`}
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
            сторінка {page} з {totalPages}
          </span>

          <Link
            href={`/products?page=${page + 1}`}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              page >= totalPages
                ? 'pointer-events-none opacity-30 border-gray-200'
                : 'border-gray-200 hover:border-gray-400'
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
