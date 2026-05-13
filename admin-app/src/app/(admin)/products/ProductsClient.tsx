'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ActionButton from '@/components/moderation/ActionButton'
import { approveProduct, updateProductNutrition, softDeleteProduct, mergeProduct } from '@/app/actions/moderation'

interface ProductsClientProps {
  products: any[]
}

function NutritionEditor({ product, onSaved }: { product: any; onSaved: () => void }) {
  const [kcal, setKcal] = useState(String(product.kcal ?? ''))
  const [protein, setProtein] = useState(String(product.protein ?? ''))
  const [fat, setFat] = useState(String(product.fat ?? ''))
  const [carbs, setCarbs] = useState(String(product.carbs ?? ''))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await updateProductNutrition(product.id, {
        kcal: kcal !== '' ? parseFloat(kcal) : undefined,
        protein: protein !== '' ? parseFloat(protein) : undefined,
        fat: fat !== '' ? parseFloat(fat) : undefined,
        carbs: carbs !== '' ? parseFloat(carbs) : undefined,
      })
      onSaved()
    } catch (e: any) {
      toast.error(e?.message ?? 'Помилка')
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
      <button
        onClick={save} disabled={saving}
        className="text-xs h-7 px-2 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50">
        {saving ? '…' : '✓'}
      </button>
    </div>
  )
}

export default function ProductsClient({ products }: ProductsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  const filtered = search
    ? products.filter(p =>
        (p.name_ua ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.name_en ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : products

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Юзерські продукти</h1>
        <span className="text-sm text-gray-400">{filtered.length} записів</span>
      </div>

      <div className="px-4 md:px-8 py-3 border-b border-gray-100">
        <input
          type="text"
          placeholder="Пошук за назвою…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-gray-400"
        />
      </div>

      {filtered.length === 0 && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">Продуктів немає 🌿</div>
      )}

      <div className="divide-y divide-gray-100">
        {filtered.map(product => {
          const name = product.name_ua || product.name_en || 'Без назви'
          const isEditing = editingId === product.id

          return (
            <div key={product.id} className="px-4 md:px-8 py-4 hover:bg-gray-50">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                    {product.kcal != null && <span>{product.kcal} ккал</span>}
                    {product.protein != null && (
                      <span>Б:{product.protein} Ж:{product.fat} В:{product.carbs}</span>
                    )}
                    {product.category_id && <span>{product.category_id}</span>}
                    {product.author && <span>Від: {product.author.full_name ?? '—'}</span>}
                    <span suppressHydrationWarning>{product.created_at?.slice(0, 10)}</span>
                  </div>

                  {isEditing && (
                    <NutritionEditor
                      product={product}
                      onSaved={() => { setEditingId(null); router.refresh() }}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <ActionButton
                  label="Схвалити"
                  confirmText="Зробити загальним продуктом?"
                  variant="default"
                  action={() => approveProduct(product.id)}
                  onDone={() => router.refresh()}
                />
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
    </div>
  )
}
