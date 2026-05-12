'use client'

import { useFieldArray, Control } from 'react-hook-form'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface StepsEditorProps {
  locale: 'ua' | 'en' | 'pl'
  label: string
  value: string
  onChange: (value: string) => void
}

const STEP_SEPARATOR = '\n'

export default function StepsEditor({ locale, label, value, onChange }: StepsEditorProps) {
  const steps = value
    ? value.split(STEP_SEPARATOR).filter(s => s.trim())
    : ['']

  function updateSteps(newSteps: string[]) {
    onChange(newSteps.filter(s => s.trim()).join(STEP_SEPARATOR))
  }

  function handleChange(idx: number, val: string) {
    const next = [...steps]
    next[idx] = val
    onChange(next.join(STEP_SEPARATOR))
  }

  function addStep() {
    const next = [...steps, '']
    onChange(next.join(STEP_SEPARATOR))
  }

  function removeStep(idx: number) {
    const next = steps.filter((_, i) => i !== idx)
    updateSteps(next.length ? next : [''])
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <div key={idx} className="flex gap-2 items-start group">
            <div className="flex items-center justify-center w-7 h-8 shrink-0">
              <span className="text-xs font-semibold text-gray-400 tabular-nums">{idx + 1}</span>
            </div>
            <Textarea
              value={step}
              onChange={e => handleChange(idx, e.target.value)}
              placeholder={`Крок ${idx + 1}...`}
              rows={2}
              className="flex-1 resize-none text-sm min-h-[60px]"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
              onClick={() => removeStep(idx)}
              disabled={steps.length === 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addStep}
        className="w-full border-dashed text-gray-500 hover:text-gray-700"
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Додати крок
      </Button>
    </div>
  )
}
