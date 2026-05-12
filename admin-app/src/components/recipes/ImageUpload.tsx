'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Upload, X, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface ImageUploadProps {
  currentUrl?: string | null
  onUpload: (url: string) => void
}

function generateFilename(recipeId?: string): string {
  const id = recipeId ?? Math.floor(Math.random() * 100000)
  const ts = Date.now()
  return `recipe-${id}-${ts}.avif`
}

export default function ImageUpload({ currentUrl, onUpload }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file) return

    const supabase = createClient()
    const filename = generateFilename()
    setUploading(true)
    setProgress(10)

    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)
    setProgress(30)

    const { data, error } = await supabase.storage
      .from('recipe-images')
      .upload(filename, file, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      toast.error(`Помилка завантаження: ${error.message}`)
      setPreview(currentUrl ?? null)
      setUploading(false)
      setProgress(0)
      return
    }

    setProgress(80)

    const { data: urlData } = supabase.storage
      .from('recipe-images')
      .getPublicUrl(data.path)

    setProgress(100)
    onUpload(urlData.publicUrl)
    toast.success('Зображення завантажено')
    setUploading(false)
    setTimeout(() => setProgress(0), 800)
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
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <>
            <Image
              src={preview}
              alt="Recipe preview"
              fill
              className="object-cover"
              unoptimized
            />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setPreview(null); onUpload('') }}
              className="absolute top-2 right-2 bg-white/90 rounded-full p-1 hover:bg-white shadow-sm"
            >
              <X className="h-3.5 w-3.5 text-gray-600" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-[180px] gap-2 text-gray-400">
            <ImageIcon className="h-8 w-8" />
            <p className="text-sm">Перетягніть або натисніть для вибору</p>
            <p className="text-xs">AVIF, WebP, JPG, PNG</p>
          </div>
        )}
      </div>

      {uploading && <Progress value={progress} className="h-1" />}

      <input
        ref={inputRef}
        type="file"
        accept="image/avif,image/webp,image/jpeg,image/png"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="w-full"
      >
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        {uploading ? 'Завантаження...' : 'Обрати зображення'}
      </Button>
    </div>
  )
}
