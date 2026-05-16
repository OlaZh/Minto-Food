'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { withUndoToast } from '@/lib/undoToast'

interface ActionButtonProps {
  label: string
  confirmText?: string
  variant?: 'default' | 'destructive' | 'outline' | 'ghost'
  size?: 'sm' | 'default'
  action: () => Promise<unknown>
  onDone?: () => void
  className?: string
  useUndo?: boolean
}

export default function ActionButton({
  label, confirmText, variant = 'outline', size = 'sm',
  action, onDone, className, useUndo = false,
}: ActionButtonProps) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function handleClick() {
    if (useUndo) {
      withUndoToast(label, action, onDone)
      return
    }
    if (confirmText && !confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    startTransition(async () => {
      try {
        await action()
        onDone?.()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Помилка')
      }
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">{confirmText}</span>
        <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={handleClick} disabled={pending}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Так'}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setConfirming(false)}>
          Ні
        </Button>
      </div>
    )
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={`h-7 text-xs ${className ?? ''}`}
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
      {label}
    </Button>
  )
}
