'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ActionButton from '@/components/moderation/ActionButton'
import {
  deleteScannedProduct,
  updateScannedProduct,
  type ScannedProductValues,
} from '@/app/actions/scanned-products'
import { decodeHtmlEntities } from '@/lib/htmlEntities'

export type ScannedProductListItem = {
  barcode: string
  name_ua: string | null
  name_en: string | null
  name_pl: string | null
  brand: string | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  fiber: number | null
  sugar: number | null
  salt: number | null
  label_type: string | null
  source: string | null
  created_at?: string | null
  updated_at?: string | null
}

interface ScannedProductsClientProps {
  products: ScannedProductListItem[]
  page: number
  totalPages: number
  totalCount: number
  error: string | null
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Додано вручну',
  openfoodfacts: 'Open Food Facts',
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

function ScannedProductEditor({
  product,
  onCancel,
  onSaved,
}: {
  product: ScannedProductListItem
  onCancel: () => void
  onSaved: () => void
}) {
  const [nameUa, setNameUa] = useState(decodeHtmlEntities(product.name_ua))
  const [namePl, setNamePl] = useState(decodeHtmlEntities(product.name_pl))
  const [nameEn, setNameEn] = useState(decodeHtmlEntities(product.name_en))
  const [brand, setBrand] = useState(decodeHtmlEntities(product.brand))
  const [kcal, setKcal] = useState(String(product.kcal ?? 0))
  const [protein, setProtein] = useState(String(product.protein ?? 0))
  const [fat, setFat] = useState(String(product.fat ?? 0))
  const [carbs, setCarbs] = useState(String(product.carbs ?? 0))
  const [fiber, setFiber] = useState(String(product.fiber ?? 0))
  const [sugar, setSugar] = useState(String(product.sugar ?? 0))
  const [salt, setSalt] = useState(String(product.salt ?? 0))
  const [labelType, setLabelType] = useState(product.label_type ?? 'EU')
  const [saving, setSaving] = useState(false)

  const textField = (
    label: string,
    value: string,
    setValue: (nextValue: string) => void,
    placeholder?: string
  ) => (
    <label className="block text-xs text-gray-500">
      <span className="block mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={event => setValue(event.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-400"
      />
    </label>
  )

  const numberField = (
    label: string,
    value: string,
    setValue: (nextValue: string) => void,
    step = '0.1'
  ) => (
    <label className="block text-xs text-gray-500">
      <span className="block mb-1">{label}</span>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={event => setValue(event.target.value)}
        className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-400"
      />
    </label>
  )

  async function save() {
    if (![nameUa, namePl, nameEn].some(value => value.trim())) {
      toast.error('Потрібна хоча б одна назва продукту')
      return
    }

    const values: ScannedProductValues = {
      name_ua: nameUa.trim() || null,
      name_pl: namePl.trim() || null,
      name_en: nameEn.trim() || null,
      brand: brand.trim() || null,
      kcal: Number(kcal) || 0,
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      carbs: Number(carbs) || 0,
      fiber: Number(fiber) || 0,
      sugar: Number(sugar) || 0,
      salt: Number(salt) || 0,
      label_type: labelType || null,
    }

    setSaving(true)
    try {
      await updateScannedProduct(product.barcode, values)
      toast.success('Відсканований продукт оновлено')
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Помилка оновлення')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        {textField('Назва українською', nameUa, setNameUa, 'Основна назва')}
        {textField('Nazwa po polsku', namePl, setNamePl)}
        {textField('English name', nameEn, setNameEn)}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {textField('Бренд', brand, setBrand)}
        <label className="block text-xs text-gray-500">
          <span className="block mb-1">Стандарт етикетки</span>
          <select
            value={labelType}
            onChange={event => setLabelType(event.target.value)}
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm text-gray-900 bg-white outline-none focus:border-gray-400"
          >
            <option value="EU">EU</option>
            <option value="US">US</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {numberField('Ккал', kcal, setKcal, '1')}
        {numberField('Білки', protein, setProtein)}
        {numberField('Жири', fat, setFat)}
        {numberField('Вуглеводи', carbs, setCarbs)}
        {numberField('Клітковина', fiber, setFiber)}
        {numberField('Цукор', sugar, setSugar)}
        {numberField('Сіль', salt, setSalt, '0.01')}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-8 px-3 rounded-md bg-gray-900 text-white text-xs hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? 'Зберігаю…' : 'Зберегти'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-8 px-3 rounded-md border border-gray-200 text-xs hover:border-gray-400 disabled:opacity-50"
        >
          Скасувати
        </button>
      </div>
    </div>
  )
}

export default function ScannedProductsClient({
  products,
  page,
  totalPages,
  totalCount,
  error,
}: ScannedProductsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [editingBarcode, setEditingBarcode] = useState<string | null>(null)
  const normalizedSearch = search.trim().toLowerCase()

  const filtered = normalizedSearch
    ? products.filter(product =>
        [
          product.barcode,
          product.name_ua,
          product.name_en,
          product.name_pl,
          product.brand,
          product.source,
        ].some(value => decodeHtmlEntities(value).toLowerCase().includes(normalizedSearch))
      )
    : products

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Відскановані продукти</h1>
          <p className="text-xs text-gray-400 mt-0.5">Дані безпосередньо зі scanned_products</p>
        </div>
        <span className="text-sm text-gray-400 whitespace-nowrap">{filtered.length} на сторінці</span>
      </div>

      <div className="px-4 md:px-8 py-3 border-b border-gray-100 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Штрихкод, назва або бренд на поточній сторінці…"
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full max-w-md text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-gray-400"
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
          Найсвіжіше додані або оновлені записи показані першими. Пошук працює в межах відкритої сторінки.
        </p>
      </div>

      {error && (
        <div className="mx-4 md:mx-8 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Не вдалося завантажити scanned_products: {error}
        </div>
      )}

      {!error && totalCount > 0 && (
        <div className="px-4 md:px-8 py-2 text-xs text-gray-400 border-b border-gray-100">
          {totalCount} записів · сторінка {page} з {totalPages}
        </div>
      )}

      {!error && filtered.length === 0 && (
        <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">
          {search ? 'На цій сторінці нічого не знайдено' : 'Відсканованих продуктів немає'}
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {filtered.map(product => {
          const name = decodeHtmlEntities(
            product.name_ua || product.name_pl || product.name_en || 'Без назви'
          )
          const brand = decodeHtmlEntities(product.brand)
          const source = product.source ? (SOURCE_LABELS[product.source] ?? product.source) : '—'
          const timestamp = product.created_at ?? product.updated_at
          const isEditing = editingBarcode === product.barcode

          return (
            <div key={product.barcode} className="px-4 md:px-8 py-4 hover:bg-gray-50">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">{name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                    <span className="font-mono text-gray-500">{product.barcode}</span>
                    {brand && <span>{brand}</span>}
                    <span>{source}</span>
                    <span>{formatTimestamp(timestamp)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 md:justify-end">
                  <span>{product.kcal ?? 0} ккал</span>
                  <span>Б: {product.protein ?? 0}</span>
                  <span>Ж: {product.fat ?? 0}</span>
                  <span>В: {product.carbs ?? 0}</span>
                  <span>Кл: {product.fiber ?? 0}</span>
                  {product.label_type && <span>{product.label_type}</span>}
                </div>
              </div>

              {isEditing ? (
                <ScannedProductEditor
                  product={product}
                  onCancel={() => setEditingBarcode(null)}
                  onSaved={() => {
                    setEditingBarcode(null)
                    router.refresh()
                  }}
                />
              ) : (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setEditingBarcode(product.barcode)}
                    className="h-7 px-2.5 rounded-md border border-gray-200 text-xs hover:border-gray-400"
                  >
                    Виправити
                  </button>
                  <ActionButton
                    label="Видалити"
                    confirmText={`Видалити ${product.barcode}?`}
                    variant="destructive"
                    action={() => deleteScannedProduct(product.barcode)}
                    onDone={() => router.refresh()}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!error && totalPages > 1 && (
        <div className="px-4 md:px-8 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
          <Link
            href={`/scanned-products?page=${page - 1}`}
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
            href={`/scanned-products?page=${page + 1}`}
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
