'use client'

import { useState } from 'react'
import { withUndoToast } from '@/lib/undoToast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export interface ModerationReason {
  category: string
  comment: string
}

interface Props {
  open: boolean
  onClose: () => void
  title: string
  action: (reason: ModerationReason) => Promise<unknown>
  onDone?: () => void
}

const CATEGORIES = [
  { value: 'spam',            label: 'Спам' },
  { value: 'nsfw',            label: 'NSFW' },
  { value: 'scam',            label: 'Шахрайство' },
  { value: 'hate_speech',     label: 'Мова ненависті' },
  { value: 'copyright',       label: 'Авторські права' },
  { value: 'inappropriate',   label: 'Неприйнятний вміст' },
  { value: 'misinformation',  label: 'Дезінформація' },
  { value: 'other',           label: 'Інше' },
]

export default function ModerationReasonDialog({ open, onClose, title, action, onDone }: Props) {
  const [category, setCategory] = useState('')
  const [comment, setComment] = useState('')

  function handleClose() {
    setCategory('')
    setComment('')
    onClose()
  }

  function handleConfirm() {
    if (!category) return
    const reason = { category, comment }
    setCategory('')
    setComment('')
    onClose()
    withUndoToast(title, () => action(reason), onDone)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) handleClose() }}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-gray-500">Оберіть причину</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  category === c.value
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <Textarea
            placeholder="Коментар (необов'язково)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="text-sm resize-none"
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>
            Скасувати
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={!category}
          >
            Підтвердити
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
