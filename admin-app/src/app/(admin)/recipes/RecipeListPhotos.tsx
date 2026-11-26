'use client'

import Image from 'next/image'
import { createContext, startTransition, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

const PHOTO_BATCH_SIZE = 8
const RecipePhotosContext = createContext<ReadonlyMap<string, string | null>>(new Map())

export function RecipeListPhotos({ children }: { children: ReactNode }) {
  const list = useRef<HTMLDivElement>(null)
  const [photos, setPhotos] = useState<ReadonlyMap<string, string | null>>(() => new Map())

  useEffect(() => {
    const thumbnails = Array.from(list.current?.querySelectorAll('[data-recipe-photo-id]') ?? [])
    if (!thumbnails.length) return

    const controller = new AbortController()
    const { signal } = controller
    const supabase = createClient()

    async function loadPhotos(elements: Element[]) {
      const ids = elements.map(element => element.getAttribute('data-recipe-photo-id')).filter(id => id !== null)

      for (let offset = 0; offset < ids.length && !signal.aborted; offset += PHOTO_BATCH_SIZE) {
        const batch = ids.slice(offset, offset + PHOTO_BATCH_SIZE)
        const { data } = await supabase
          .from('recipes')
          .select('id, image')
          .in('id', batch)
          .is('deleted_at', null)
          .abortSignal(signal)

        if (signal.aborted || !data) continue

        startTransition(() => {
          setPhotos(current => {
            const next = new Map(current)
            for (const id of batch) next.delete(id)
            for (const { id, image } of data) next.set(String(id), image)
            return next
          })
        })
      }
    }

    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries, observer) => {
          const visible: Element[] = []
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            visible.push(entry.target)
            observer.unobserve(entry.target)
          }
          void loadPhotos(visible)
        }, { rootMargin: '120px' })
      : null

    if (observer) {
      for (const thumbnail of thumbnails) observer.observe(thumbnail)
    } else {
      void loadPhotos(thumbnails)
    }

    return () => {
      observer?.disconnect()
      controller.abort()
    }
  }, [children])

  return (
    <RecipePhotosContext.Provider value={photos}>
      <div ref={list} className="divide-y divide-gray-100">{children}</div>
    </RecipePhotosContext.Provider>
  )
}

export function RecipeThumbnail({ id, name }: { id: string; name: string }) {
  const image = useContext(RecipePhotosContext).get(id)

  return (
    <div data-recipe-photo-id={id} className="relative w-12 h-12 rounded-md overflow-hidden bg-gray-100 shrink-0">
      {image ? (
        <Image src={image} alt={name} fill sizes="48px" unoptimized className="object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">🍽</div>
      )}
    </div>
  )
}
