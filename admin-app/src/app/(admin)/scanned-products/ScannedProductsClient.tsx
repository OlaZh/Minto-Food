'use client'

import Link from 'next/link'
import { useState } from 'react'

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

export default function ScannedProductsClient({
  products,
  page,
  totalPages,
  totalCount,
  error,
}: ScannedProductsClientProps) {
  const [search, setSearch] = useState('')
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
        ].some(value => value?.toLowerCase().includes(normalizedSearch))
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
          const name = product.name_ua || product.name_pl || product.name_en || 'Без назви'
          const source = product.source ? (SOURCE_LABELS[product.source] ?? product.source) : '—'
          const timestamp = product.created_at ?? product.updated_at

          return (
            <div key={product.barcode} className="px-4 md:px-8 py-4 hover:bg-gray-50">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">{name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                    <span className="font-mono text-gray-500">{product.barcode}</span>
                    {product.brand && <span>{product.brand}</span>}
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
