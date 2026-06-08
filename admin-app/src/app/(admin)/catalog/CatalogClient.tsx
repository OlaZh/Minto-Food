'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { updateProduct } from '@/app/actions/catalog'

interface Product {
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
  food_state: string | null
  raw_edible: string
}

interface Category {
  id: number
  name_ua: string
}

type ProductWithCategory = Product & {
  _cat: string
}

const RAW_COLORS: Record<string, string> = {
  always:    'text-green-700 bg-green-50 border-green-300',
  sometimes: 'text-amber-700 bg-amber-50 border-amber-300',
  never:     'text-gray-500 bg-gray-50 border-gray-300',
}

const inputCls = 'border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-gray-400 bg-white'

function ProductEditor({
  product,
  categories,
  onSaved,
  onCancel,
}: {
  product: Product
  categories: Category[]
  onSaved: (updates: Partial<Product>) => void
  onCancel: () => void
}) {
  const [nameUa, setNameUa]       = useState(product.name_ua ?? '')
  const [nameEn, setNameEn]       = useState(product.name_en ?? '')
  const [namePl, setNamePl]       = useState(product.name_pl ?? '')
  const [catId, setCatId]         = useState(String(product.category_id ?? ''))
  const [rawEdible, setRawEdible] = useState(product.raw_edible)
  const [foodState, setFoodState] = useState(product.food_state ?? 'raw')
  const [kcal, setKcal]           = useState(String(product.kcal ?? ''))
  const [protein, setProtein]     = useState(String(product.protein ?? ''))
  const [fat, setFat]             = useState(String(product.fat ?? ''))
  const [carbs, setCarbs]         = useState(String(product.carbs ?? ''))
  const [fiber, setFiber]         = useState(String(product.fiber ?? ''))
  const [saving, setSaving]       = useState(false)

  async function save() {
    setSaving(true)
    try {
      const updates: Partial<Product> = {
        name_ua:     nameUa || null,
        name_en:     nameEn || null,
        name_pl:     namePl || null,
        category_id: catId ? Number(catId) : null,
        raw_edible:  rawEdible,
        food_state:  foodState,
        kcal:        kcal    ? parseFloat(kcal)    : null,
        protein:     protein ? parseFloat(protein) : null,
        fat:         fat     ? parseFloat(fat)     : null,
        carbs:       carbs   ? parseFloat(carbs)   : null,
        fiber:       fiber   ? parseFloat(fiber)   : null,
      }
      await updateProduct(product.id, updates as Record<string, unknown>)
      toast.success('Збережено')
      onSaved(updates)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Помилка')
    }
    setSaving(false)
  }

  const numField = (label: string, val: string, set: (v: string) => void) => (
    <label key={label} className="flex items-center gap-1 text-xs">
      <span className="text-gray-500 w-6">{label}</span>
      <input
        type="number" min="0" max="9999" step="0.1"
        value={val} onChange={e => set(e.target.value)}
        className={`${inputCls} w-16`}
      />
    </label>
  )

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Назва UA</span>
          <input value={nameUa} onChange={e => setNameUa(e.target.value)} className={`${inputCls} w-full`} />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Назва EN</span>
          <input value={nameEn} onChange={e => setNameEn(e.target.value)} className={`${inputCls} w-full`} />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Назва PL</span>
          <input value={namePl} onChange={e => setNamePl(e.target.value)} className={`${inputCls} w-full`} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Категорія</span>
          <select value={catId} onChange={e => setCatId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.id} — {c.name_ua}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Відображення</span>
          <select value={rawEdible} onChange={e => setRawEdible(e.target.value)} className={inputCls}>
            <option value="always">Завжди показувати</option>
            <option value="sometimes">Показувати як сире</option>
            <option value="never">Не показувати</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-gray-500">Стан</span>
          <select value={foodState} onChange={e => setFoodState(e.target.value)} className={inputCls}>
            <option value="raw">Сирий</option>
            <option value="dry">Сухий</option>
            <option value="cooked">Готовий</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {numField('Ккал', kcal, setKcal)}
        {numField('Б', protein, setProtein)}
        {numField('Ж', fat, setFat)}
        {numField('В', carbs, setCarbs)}
        {numField('Кл', fiber, setFiber)}
      </div>

      <div className="flex gap-2">
        <button
          onClick={save} disabled={saving}
          className="h-7 text-xs px-3 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? '…' : 'Зберегти'}
        </button>
        <button
          onClick={onCancel}
          className="h-7 text-xs px-3 border border-gray-200 rounded hover:border-gray-400"
        >
          Скасувати
        </button>
      </div>
    </div>
  )
}

export default function CatalogClient({
  products: initialProducts,
  categories,
}: {
  products: Product[]
  categories: Category[]
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch]     = useState('')
  const [filterRaw, setFilterRaw] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage]           = useState(1)
  const PAGE_SIZE = 50

  const catMap = useMemo(
    () => new Map(categories.map(c => [c.id, c.name_ua])),
    [categories]
  )

  const enriched = useMemo<ProductWithCategory[]>(
    () => products.map(p => ({ ...p, _cat: catMap.get(p.category_id ?? -1) ?? '' })),
    [products, catMap]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return enriched.filter(p => {
      if (filterRaw && p.raw_edible !== filterRaw) return false
      if (filterCat && String(p.category_id) !== filterCat) return false
      if (q) {
        const byId = String(p.id).includes(q)
        const byName =
          p.name_ua?.toLowerCase().includes(q) ||
          p.name_en?.toLowerCase().includes(q) ||
          p.name_pl?.toLowerCase().includes(q)
        if (!byId && !byName) return false
      }
      return true
    })
  }, [enriched, search, filterRaw, filterCat])

  const paginated = filtered.slice(0, page * PAGE_SIZE)

  const usedCats = useMemo(() => {
    const ids = new Set(products.map(p => p.category_id).filter(Boolean))
    return categories.filter(c => ids.has(c.id))
  }, [products, categories])

  async function handleRawChange(productId: number, value: string) {
    const prev = products.find(p => p.id === productId)?.raw_edible
    setProducts(ps => ps.map(p => p.id === productId ? { ...p, raw_edible: value } : p))
    try {
      await updateProduct(productId, { raw_edible: value })
    } catch {
      toast.error('Помилка збереження')
      if (prev) setProducts(ps => ps.map(p => p.id === productId ? { ...p, raw_edible: prev } : p))
    }
  }

  function handleSaved(productId: number, updates: Partial<Product>) {
    setProducts(ps => ps.map(p => p.id === productId ? { ...p, ...updates } : p))
    setEditingId(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Каталог продуктів</h1>
          <span className="text-sm text-gray-400">{filtered.length} з {products.length}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Пошук за назвою…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-gray-400 flex-1 min-w-40"
          />
          <select
            value={filterRaw}
            onChange={e => { setFilterRaw(e.target.value); setPage(1) }}
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none bg-white"
          >
            <option value="">Всі статуси</option>
            <option value="always">Завжди</option>
            <option value="sometimes">Сире</option>
            <option value="never">Не показувати</option>
          </select>
          <select
            value={filterCat}
            onChange={e => { setFilterCat(e.target.value); setPage(1) }}
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none bg-white max-w-44"
          >
            <option value="">Всі категорії</option>
            {usedCats.map(c => (
              <option key={c.id} value={String(c.id)}>{c.name_ua}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-100">
        {paginated.map(product => {
          const isEditing = editingId === product.id
          const rawCls = RAW_COLORS[product.raw_edible] ?? RAW_COLORS.never

          return (
            <div key={product.id} className="px-4 md:px-8 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    <span className="text-gray-300 text-xs font-normal mr-1.5">#{product.id}</span>
                    {product.name_ua || product.name_en || '—'}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                    {product._cat && <span>{product._cat}</span>}
                    {product.kcal != null && <span>{product.kcal} ккал</span>}
                    {product.protein != null && (
                      <span>Б:{product.protein} Ж:{product.fat} В:{product.carbs}{(product.fiber ?? 0) > 0 ? ` Кл:${product.fiber}` : ''}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={product.raw_edible}
                    onChange={e => handleRawChange(product.id, e.target.value)}
                    className={`text-xs border rounded px-1.5 py-1 outline-none ${rawCls}`}
                  >
                    <option value="always">Завжди</option>
                    <option value="sometimes">Сире</option>
                    <option value="never">Не показ.</option>
                  </select>
                  <button
                    onClick={() => setEditingId(isEditing ? null : product.id)}
                    className="h-7 w-7 flex items-center justify-center border border-gray-200 rounded-md hover:border-gray-400 text-gray-500 transition-colors text-base"
                    title="Редагувати"
                  >
                    ✎
                  </button>
                </div>
              </div>

              {isEditing && (
                <ProductEditor
                  product={product}
                  categories={categories}
                  onSaved={updates => handleSaved(product.id, updates)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          )
        })}
      </div>

      {paginated.length < filtered.length && (
        <div className="px-4 md:px-8 py-6 text-center">
          <button
            onClick={() => setPage(p => p + 1)}
            className="text-sm border border-gray-200 rounded-md px-4 py-2 hover:border-gray-400 transition-colors"
          >
            Показати ще ({filtered.length - paginated.length})
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">
          Нічого не знайдено
        </div>
      )}
    </div>
  )
}
