'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import type { IngredientRow, Product } from '@/lib/types'
import { UNITS } from '@/lib/types'

interface IngredientBuilderProps {
  value: IngredientRow[]
  onChange: (rows: IngredientRow[]) => void
}

function ProductSearch({
  value,
  onSelect,
}: {
  value: string
  onSelect: (product: Product) => void
}) {
  const [query, setQuery] = useState(value)
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
    if (q.length < 2) { setResults([]); setOpen(false); return }
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

  function handleInput(v: string) {
    setQuery(v)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(v), 250)
  }

  function getLabel(p: Product) {
    return p.name_ua || p.name_en || `Product #${p.id}`
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
        <Input
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder="Пошук продукту..."
          className="pl-8 h-9 text-sm"
          onFocus={() => query.length >= 2 && setOpen(true)}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {results.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onSelect(p)
                setQuery(getLabel(p))
                setOpen(false)
              }}
            >
              <span className="truncate">{getLabel(p)}</span>
              {p.kcal != null && (
                <span className="text-xs text-gray-400 shrink-0">{p.kcal} ккал</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function IngredientBuilder({ value, onChange }: IngredientBuilderProps) {
  function update(idx: number, patch: Partial<IngredientRow>) {
    const next = value.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    onChange(next)
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  function add() {
    onChange([...value, { product_id: 0, product_name: '', quantity: 100, unit: 'г' }])
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-center group">
              <ProductSearch
                value={row.product_name}
                onSelect={p => update(idx, {
                  product_id: p.id,
                  product_name: p.name_ua || p.name_en || '',
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
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
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
          ))}
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
