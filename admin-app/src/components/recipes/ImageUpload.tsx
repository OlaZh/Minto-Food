'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { Download, Upload, X, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { MAX_RECIPE_IMAGE_BYTES, IMAGE_TOO_LARGE_MESSAGE } from '@/lib/recipe-image'

interface ImageUploadProps {
  currentUrl?: string | null
  onUpload: (url: string) => void
  onReadingChange: (reading: boolean) => void
  disabled?: boolean
}

export default function ImageUpload({ currentUrl, onUpload, onReadingChange, disabled = false }: ImageUploadProps) {
  const [progress, setProgress] = useState(0)
  const [reading, setReading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const readerRef = useRef<FileReader | null>(null)

  useEffect(() => () => {
    const reader = readerRef.current
    if (!reader) return
    reader.onload = reader.onerror = reader.onprogress = reader.onloadend = null
    reader.abort()
    readerRef.current = null
  }, [])

  function handleFile(file: File) {
    if (disabled || readerRef.current) return
    if (file.size > MAX_RECIPE_IMAGE_BYTES) {
      toast.error(IMAGE_TOO_LARGE_MESSAGE)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    const reader = new FileReader()
    readerRef.current = reader
    setReading(true)
    onReadingChange(true)
    setProgress(0)

    function finishReading() {
      readerRef.current = null
      setReading(false)
      onReadingChange(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
    }

    reader.onprogress = event => {
      if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100))
    }
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        toast.error('Не вдалося прочитати зображення. Спробуйте ще раз.')
        return
      }
      // Store the file itself in recipes.image when the recipe form is saved.
      onUpload(reader.result)
      toast.success('Фото додано. Натисніть «Зберегти» або «Створити», щоб зберегти рецепт.')
    }
    reader.onerror = () => toast.error('Не вдалося прочитати зображення. Спробуйте ще раз.')
    reader.onloadend = finishReading

    try {
      reader.readAsDataURL(file)
    } catch {
      toast.error('Не вдалося прочитати зображення. Спробуйте ще раз.')
      finishReading()
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-2">
      <div
        className="relative border-2 border-dashed border-gray-200 rounded-lg overflow-hidden bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
        style={{ minHeight: 180 }}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => { if (!disabled && !reading) inputRef.current?.click() }}
      >
        {currentUrl ? (
          <>
            <Image
              src={currentUrl}
              alt="Recipe preview"
              fill
              className="object-cover"
              unoptimized
            />
            <button
              type="button"
              disabled={disabled || reading}
              onClick={e => { e.stopPropagation(); onUpload('') }}
              className="absolute top-2 right-2 bg-white/90 rounded-full p-1 hover:bg-white shadow-sm"
            >
              <X className="h-3.5 w-3.5 text-gray-600" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-[180px] gap-2 text-gray-400">
            <ImageIcon className="h-8 w-8" />
            <p className="text-sm">Перетягніть або натисніть для вибору</p>
            <p className="text-xs">AVIF, WebP, JPG, PNG · до 3 МБ</p>
          </div>
        )}
      </div>

      {reading && <Progress value={progress} className="h-1" />}

      <input
        ref={inputRef}
        type="file"
        disabled={disabled || reading}
        accept="image/avif,image/webp,image/jpeg,image/png"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || reading}
        onClick={() => inputRef.current?.click()}
        className="w-full"
      >
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        {reading ? 'Читання фото...' : 'Обрати зображення'}
      </Button>
      {currentUrl && (
        <DownloadRecipeImage image={currentUrl} disabled={reading} className="w-full" />
      )}
    </div>
  )
}

export function DownloadRecipeImage({ image, disabled = false, className }: {
  image: string
  disabled?: boolean
  className?: string
}) {
  const [downloading, setDownloading] = useState(false)

  async function downloadImage() {
    if (disabled || downloading) return
    setDownloading(true)
    try {
      const response = await fetch(image)
      if (!response.ok) throw new Error('Image download failed')
      const blob = await response.blob()
      const extensions: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
        'image/avif': 'avif', 'image/gif': 'gif', 'image/heic': 'heic',
        'image/heif': 'heif', 'image/svg+xml': 'svg',
      }
      const extension = extensions[blob.type.toLowerCase().split(';')[0]]
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = extension ? `recipe-photo.${extension}` : 'recipe-photo'
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Allow the browser to start saving before releasing the object URL.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      toast.error('Не вдалося скачати фото. Спробуйте ще раз.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || downloading}
      onClick={downloadImage}
      className={className}
    >
      <Download className="h-3.5 w-3.5 mr-1.5" />
      {downloading ? 'Завантаження...' : 'Скачати фото'}
    </Button>
  )
}
