import { toast } from 'sonner'

const UNDO_DURATION = 5000

export function withUndoToast(
  message: string,
  action: () => Promise<unknown>,
  onDone?: () => void
) {
  let cancelled = false

  toast(message, {
    duration: UNDO_DURATION,
    action: {
      label: 'Скасувати',
      onClick: () => { cancelled = true },
    },
  })

  setTimeout(async () => {
    if (cancelled) return
    try {
      await action()
      onDone?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Помилка')
    }
  }, UNDO_DURATION)
}
