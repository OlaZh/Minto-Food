import { createClient } from '@/lib/supabase/server'
import type { Tag } from '@/lib/types'

export default async function TagsPage() {
  const supabase = await createClient()
  const { data: tags } = await supabase
    .from('tags')
    .select('*')
    .order('slug')

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <h1 className="text-lg font-semibold">Теги</h1>
        <p className="text-xs text-gray-400 mt-0.5">Теги генеруються автоматично при збереженні рецепта</p>
      </div>

      <div className="px-4 md:px-8 py-6">
        <div className="flex flex-wrap gap-2">
          {(tags as Tag[] ?? []).map(tag => (
            <div
              key={tag.id}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
            >
              <span className="font-medium text-gray-700">{tag.name_ua}</span>
              <span className="text-gray-400 text-xs">/ {tag.name_en}</span>
              <span className="text-[10px] font-mono text-gray-300 ml-1">{tag.slug}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
