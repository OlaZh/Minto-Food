'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import type { IngredientRow, Product } from '@/lib/types'
import { UNITS } from '@/lib/types'

interface IngredientBuilderProps {
  value: IngredientRow[]
  onChange: (rows: IngredientRow[]) => void
}

interface ParsedBulkIngredient {
  productName: string
  quantity: number
  unit: string
}

const DEFAULT_UNIT = 'г'
const SECTION_LINE_RE = /^[^\d]{2,80}:\s*$/u
const BULLET_PREFIX_RE = /^[•·◦○●▪▫\-*]+\s*/u

const UNIT_ALIASES: Record<string, string> = {
  г: 'г',
  гр: 'г',
  грам: 'г',
  грами: 'г',
  грамів: 'г',
  g: 'g',
  кг: 'кг',
  kg: 'kg',
  мл: 'мл',
  ml: 'ml',
  л: 'л',
  l: 'l',
  liter: 'l',
  litre: 'l',
  шт: 'шт',
  штука: 'шт',
  штуки: 'шт',
  штук: 'шт',
  pcs: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  чл: 'ч.л',
  'ч.л': 'ч.л',
  'ч.л.': 'ч.л',
  tsp: 'tsp',
  teaspoon: 'tsp',
  стл: 'ст.л',
  'ст.л': 'ст.л',
  'ст.л.': 'ст.л',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  склянка: 'склянка',
  склянки: 'склянка',
  cup: 'cup',
  cups: 'cup',
  щіпка: 'щіпка',
  щіпки: 'щіпка',
  pinch: 'pinch',
}

function getProductLabel(product: Product) {
  return product.name_ua || product.name_en || product.name_pl || `Product #${product.id}`
}

function normalizeUnit(rawUnit: string) {
  const key = rawUnit
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/,+/g, '')

  return UNIT_ALIASES[key] ?? null
}

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[’'`"]/g, '')
    .replace(/[^\p{L}\p{N}\s%]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isSectionLine(line: string) {
  return SECTION_LINE_RE.test(line) && !/\d/.test(line)
}

function parseBulkIngredientLine(rawLine: string): ParsedBulkIngredient | null {
  const cleaned = rawLine
    .trim()
    .replace(BULLET_PREFIX_RE, '')
    .replace(/\s+/g, ' ')

  if (!cleaned || isSectionLine(cleaned)) return null

  const line = cleaned.replace(/(\d)\s*,\s*(\d)/g, '$1.$2')

  const noteMatch = line.match(/^(.+?)\s*:\s*([^\d].+)$/u)
  if (noteMatch) {
    return {
      productName: noteMatch[1].trim(),
      quantity: 0,
      unit: DEFAULT_UNIT,
    }
  }

  const suffixMeasureMatch = line.match(/^(.+?)\s*[:,-]?\s*(\d+(?:\.\d+)?)\s*(.+)$/u)
  if (suffixMeasureMatch) {
    const unit = normalizeUnit(suffixMeasureMatch[3])
    if (unit) {
      return {
        productName: suffixMeasureMatch[1].trim(),
        quantity: parseFloat(suffixMeasureMatch[2]),
        unit,
      }
    }
  }

  const prefixMeasureMatch = line.match(/^(\d+(?:\.\d+)?)\s*(.+?)\s+(.+)$/u)
  if (prefixMeasureMatch) {
    const unit = normalizeUnit(prefixMeasureMatch[2])
    if (unit) {
      return {
        productName: prefixMeasureMatch[3].trim(),
        quantity: parseFloat(prefixMeasureMatch[1]),
        unit,
      }
    }
  }

  const suffixCountMatch = line.match(/^(.+?)\s*[:,-]?\s*(\d+(?:\.\d+)?)$/u)
  if (suffixCountMatch) {
    return {
      productName: suffixCountMatch[1].trim(),
      quantity: parseFloat(suffixCountMatch[2]),
      unit: 'шт',
    }
  }

  const prefixCountMatch = line.match(/^(\d+(?:\.\d+)?)\s+(.+)$/u)
  if (prefixCountMatch) {
    return {
      productName: prefixCountMatch[2].trim(),
      quantity: parseFloat(prefixCountMatch[1]),
      unit: 'шт',
    }
  }

  return {
    productName: line,
    quantity: 0,
    unit: DEFAULT_UNIT,
  }
}

function scoreProductMatch(product: Product, query: string) {
  const label = normalizeSearchValue(getProductLabel(product))
  const normalizedQuery = normalizeSearchValue(query)
  const words = normalizedQuery.split(' ').filter(Boolean)

  let score = 0
  if (label === normalizedQuery) score += 100
  if (label.startsWith(normalizedQuery)) score += 60
  if (words.every(word => label.includes(word))) score += 30
  if (label.includes(normalizedQuery)) score += 15
  score -= label.length / 100

  return score
}

async function findBestProductMatch(searchName: string) {
  const normalizedQuery = normalizeSearchValue(searchName)
  if (normalizedQuery.length < 2) return null

  const supabase = createClient()
  const tokens = normalizedQuery.split(' ').filter(Boolean)
  const likeQuery = normalizedQuery.replace(/\s+/g, '%')

  const { data } = await supabase
    .from('products')
    .select('id, name_ua, name_en, name_pl, kcal, protein, fat, carbs')
    .or([
      `name_ua.ilike.%${likeQuery}%`,
      `name_en.ilike.%${likeQuery}%`,
      `name_pl.ilike.%${likeQuery}%`,
      ...tokens.map(token => `name_ua.ilike.%${token}%`),
      ...tokens.map(token => `name_en.ilike.%${token}%`),
      ...tokens.map(token => `name_pl.ilike.%${token}%`),
    ].join(','))
    .is('deleted_at', null)
    .limit(20)

  if (!data?.length) return null

  return [...data].sort(
    (a, b) => scoreProductMatch(b, normalizedQuery) - scoreProductMatch(a, normalizedQuery)
  )[0]
}

function ProductSearch({
  value,
  invalid = false,
  onChange,
  onSelect,
}: {
  value: string
  invalid?: boolean
  onChange: (value: string) => void
  onSelect: (product: Product) => void
}) {
  const [results, setResults] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function search(q: string) {
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    const supabase = createClient()
    const { data } = await supabase
      .from('products')
      .select('id, name_ua, name_en, name_pl, kcal, protein, fat, carbs')
      .or(`name_ua.ilike.%${q}%,name_en.ilike.%${q}%,name_pl.ilike.%${q}%`)
      .is('deleted_at', null)
      .limit(12)

    setResults(data ?? [])
    setOpen(true)
  }

  function handleInput(nextValue: string) {
    onChange(nextValue)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(nextValue), 250)
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
        <Input
          value={value}
          onChange={e => handleInput(e.target.value)}
          placeholder="Пошук продукту..."
          aria-invalid={invalid}
          className={`pl-8 h-9 text-sm ${invalid ? 'border-red-300 focus-visible:border-red-500 focus-visible:ring-red-100' : ''}`}
          onFocus={() => value.length >= 2 && setOpen(true)}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {results.map(product => (
            <button
              key={product.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onSelect(product)
                setOpen(false)
              }}
            >
              <span className="truncate">{getProductLabel(product)}</span>
              {product.kcal != null && (
                <span className="text-xs text-gray-400 shrink-0">{product.kcal} ккал</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function IngredientBuilder({ value, onChange }: IngredientBuilderProps) {
  const [bulkText, setBulkText] = useState('')
  const [isParsing, setIsParsing] = useState(false)

  function update(idx: number, patch: Partial<IngredientRow>) {
    const next = value.map((row, rowIndex) => (rowIndex === idx ? { ...row, ...patch } : row))
    onChange(next)
  }

  function remove(idx: number) {
    onChange(value.filter((_, rowIndex) => rowIndex !== idx))
  }

  function add() {
    onChange([...value, { product_id: 0, product_name: '', quantity: 100, unit: 'г' }])
  }

  async function recognizeBulkIngredients() {
    const rawLines = bulkText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)

    if (!rawLines.length) {
      toast.info('Спочатку встав список інгредієнтів')
      return
    }

    setIsParsing(true)
    try {
      const parsedLines = rawLines
        .map(parseBulkIngredientLine)
        .filter((item): item is ParsedBulkIngredient => Boolean(item))

      if (!parsedLines.length) {
        toast.error('Не вдалося знайти жодного рядка для розпізнавання')
        return
      }

      const rows = await Promise.all(
        parsedLines.map(async item => {
          const product = await findBestProductMatch(item.productName)

          return {
            product_id: product?.id ?? 0,
            product_name: product ? getProductLabel(product) : item.productName,
            quantity: item.quantity,
            unit: item.unit,
          } satisfies IngredientRow
        })
      )

      const unresolvedCount = rows.filter(row => row.product_id === 0).length
      onChange([...value, ...rows])
      setBulkText('')

      if (unresolvedCount > 0) {
        toast.warning(`Розпізнано частково: ${unresolvedCount} рядк. потрібно виправити вручну`)
      } else {
        toast.success(`Розпізнано ${rows.length} інгредієнт(ів)`)
      }
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-700">Вставити списком</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={recognizeBulkIngredients}
            disabled={isParsing}
          >
            {isParsing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Розпізнати
          </Button>
        </div>
        <Textarea
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          placeholder={`Інгредієнти для тіста:\nМолоко: 170 мл\nБорошно: 530 г\n\nДля начинки:\nСир: 150 г`}
          rows={6}
          className="min-h-[132px] resize-y"
        />
        <p className="text-xs leading-4 text-gray-400">
          Можна вставити одразу весь список. Рядки-заголовки на кшталт `Для начинки:` пропустяться, а нерозпізнані продукти підсвітяться червоним.
        </p>
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((row, idx) => {
            const unresolved = row.product_id === 0 && row.product_name.trim().length > 0

            return (
              <div
                key={idx}
                className={`rounded-lg border p-2 transition-colors ${unresolved ? 'border-red-200 bg-red-50/40' : 'border-transparent'}`}
              >
                <div className="flex gap-2 items-center group">
                  <ProductSearch
                    value={row.product_name}
                    invalid={unresolved}
                    onChange={productName => update(idx, { product_name: productName, product_id: 0 })}
                    onSelect={product => update(idx, {
                      product_id: product.id,
                      product_name: getProductLabel(product),
                    })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={row.quantity}
                    onChange={e => update(idx, { quantity: parseFloat(e.target.value) || 0 })}
                    className="w-20 h-9 text-sm text-center"
                    placeholder="100"
                  />
                  <select
                    value={row.unit}
                    onChange={e => update(idx, { unit: e.target.value })}
                    className="h-9 text-sm border border-gray-200 rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-ring w-20"
                  >
                    {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                    onClick={() => remove(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {unresolved && (
                  <p className="mt-1 text-xs text-red-600">
                    Продукт не знайдено. Вибери правильний варіант вручну через пошук у цьому рядку.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="w-full border-dashed text-gray-500 hover:text-gray-700"
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Додати інгредієнт
      </Button>
    </div>
  )
}
