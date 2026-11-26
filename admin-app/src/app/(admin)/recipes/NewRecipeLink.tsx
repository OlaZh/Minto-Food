'use client'

import Link, { useLinkStatus } from 'next/link'
import { Loader2, Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function NewRecipeLinkContent() {
  const { pending } = useLinkStatus()

  return (
    <>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
      Новий рецепт
      <span className="sr-only" role="status">{pending ? 'Відкриваємо редактор' : ''}</span>
    </>
  )
}

export default function NewRecipeLink() {
  return (
    <Link
      href="/recipes/new"
      prefetch={false}
      className={cn(buttonVariants({ size: 'sm' }), 'hidden md:inline-flex')}
    >
      <NewRecipeLinkContent />
    </Link>
  )
}
