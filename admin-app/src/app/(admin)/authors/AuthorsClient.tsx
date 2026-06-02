'use client'

import { useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import AuthorForm from '@/components/authors/AuthorForm'
import { deleteAuthor } from '@/app/actions/authors'
import type { RecipeAuthorProfile } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface AuthorsClientProps {
  authors: RecipeAuthorProfile[]
}

export default function AuthorsClient({ authors: initial }: AuthorsClientProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editAuthor, setEditAuthor] = useState<RecipeAuthorProfile | null>(null)

  async function handleDelete(author: RecipeAuthorProfile) {
    if (!confirm(`Видалити автора "${author.display_name}"?`)) return
    const result = await deleteAuthor(author.id)
    if ('error' in result) toast.error(result.error)
    else { toast.success('Автора видалено'); router.refresh() }
  }

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Автори</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Новий автор
            </Button>
          } />
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Новий автор</DialogTitle>
            </DialogHeader>
            <AuthorForm onDone={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="divide-y divide-gray-100">
        {initial.length === 0 && (
          <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">
            Авторів поки немає
          </div>
        )}
        {initial.map(author => (
          <div key={author.id} className="flex items-center gap-4 px-4 md:px-8 py-4 hover:bg-gray-50 group">
            <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden shrink-0">
              {author.avatar ? (
                <img src={author.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-base">
                  👤
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{author.display_name}</p>
              <p className="text-xs text-gray-400">/{author.slug}</p>
              {author.bio && (
                <p className="text-xs text-gray-500 truncate mt-0.5">{author.bio}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {author.is_editorial && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                  Editorial
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Dialog
                open={editAuthor?.id === author.id}
                onOpenChange={open => setEditAuthor(open ? author : null)}
              >
                <DialogTrigger render={
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                } />
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Редагувати автора</DialogTitle>
                  </DialogHeader>
                  <AuthorForm author={author} onDone={() => setEditAuthor(null)} />
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-red-500"
                onClick={() => handleDelete(author)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
