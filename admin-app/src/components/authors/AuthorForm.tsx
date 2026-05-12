'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Controller } from 'react-hook-form'
import { createAuthor, updateAuthor } from '@/app/actions/authors'
import type { RecipeAuthorProfile } from '@/lib/types'

interface AuthorFormProps {
  author?: RecipeAuthorProfile
  onDone?: () => void
}

interface FormValues {
  display_name: string
  slug: string
  avatar: string
  bio: string
  country: string
  is_editorial: boolean
}

function toSlug(v: string) {
  return v
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

export default function AuthorForm({ author, onDone }: AuthorFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const isEdit = !!author

  const { register, control, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      display_name: author?.display_name ?? '',
      slug: author?.slug ?? '',
      avatar: author?.avatar ?? '',
      bio: author?.bio ?? '',
      country: author?.country ?? '',
      is_editorial: author?.is_editorial ?? true,
    },
  })

  async function onSubmit(data: FormValues) {
    setSaving(true)
    try {
      const payload = {
        display_name: data.display_name,
        slug: data.slug || toSlug(data.display_name),
        avatar: data.avatar || null,
        bio: data.bio || null,
        country: data.country || null,
        is_virtual: true,
        is_editorial: data.is_editorial,
      }

      const result = isEdit
        ? await updateAuthor(author.id, payload)
        : await createAuthor(payload)

      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(isEdit ? 'Автора оновлено' : 'Автора створено')
        onDone?.()
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Відображувана назва *</Label>
          <Input
            {...register('display_name', { required: true })}
            placeholder="Повариха Наталка"
            className="h-9 text-sm"
            onChange={e => {
              register('display_name').onChange(e)
              if (!author) setValue('slug', toSlug(e.target.value))
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Slug (URL)</Label>
          <Input
            {...register('slug')}
            placeholder="povaryha-natalka"
            className="h-9 text-sm font-mono"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Аватар URL</Label>
        <Input
          {...register('avatar')}
          placeholder="https://..."
          className="h-9 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Біо</Label>
        <Textarea
          {...register('bio')}
          placeholder="Коротко про автора..."
          rows={3}
          className="text-sm resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Країна</Label>
        <Input {...register('country')} placeholder="Україна" className="h-9 text-sm" />
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <Controller
          name="is_editorial"
          control={control}
          render={({ field }) => (
            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        Редакційний профіль
      </label>

      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm" disabled={saving} className="flex-1">
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {isEdit ? 'Зберегти' : 'Створити автора'}
        </Button>
        {onDone && (
          <Button type="button" variant="outline" size="sm" onClick={onDone}>
            Скасувати
          </Button>
        )}
      </div>
    </form>
  )
}
