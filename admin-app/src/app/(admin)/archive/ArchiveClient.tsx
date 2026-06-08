'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ActionButton from '@/components/moderation/ActionButton'
import { restoreRecipe, purgeRecipe, restoreProduct, purgeProduct } from '@/app/actions/moderation'

type ArchiveAuthor = {
  full_name: string | null
}

type ArchivedRecipe = {
  id: string
  name_ua: string | null
  name_en: string | null
  image: string | null
  deleted_at: string | null
  category: string | null
  author: ArchiveAuthor | null
}

type ArchivedProduct = {
  id: number
  name_ua: string | null
  name_en: string | null
  kcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  deleted_at: string | null
  author: ArchiveAuthor | null
}

interface ArchiveClientProps {
  tab: 'recipes' | 'products'
  recipes: ArchivedRecipe[]
  products: ArchivedProduct[]
}

const passthroughImageLoader = ({ src }: { src: string }) => src

export default function ArchiveClient({ tab, recipes, products }: ArchiveClientProps) {
  const router = useRouter()

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Архів</h1>
        <span className="text-sm text-gray-400">
          {tab === 'recipes' ? recipes.length : products.length} записів
        </span>
      </div>

      <div className="px-4 md:px-8 py-3 border-b border-gray-100 flex gap-2">
        <Link
          href="/archive?tab=recipes"
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            tab === 'recipes'
              ? 'bg-[#4ab584] text-white border-[#4ab584]'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}>
          Рецепти
        </Link>
        <Link
          href="/archive?tab=products"
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            tab === 'products'
              ? 'bg-[#4ab584] text-white border-[#4ab584]'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}>
          Продукти
        </Link>
      </div>

      {tab === 'recipes' && (
        <>
          {recipes.length === 0 && (
            <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">Архів рецептів порожній 🌿</div>
          )}
          <div className="divide-y divide-gray-100">
            {recipes.map(recipe => {
              const name = recipe.name_ua || recipe.name_en || 'Без назви'
              return (
                <div key={recipe.id} className="px-4 md:px-8 py-4 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className="relative w-12 h-12 rounded-md overflow-hidden bg-gray-100 shrink-0 opacity-60">
                      {recipe.image
                        ? <Image src={recipe.image} alt={name} fill sizes="48px" unoptimized loader={passthroughImageLoader} className="object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-gray-300">🍽</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium opacity-70">{name}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                        {recipe.author && <span>{recipe.author.full_name ?? '—'}</span>}
                        {recipe.category && <span>{recipe.category}</span>}
                        <span className="text-red-500" suppressHydrationWarning>
                          Видалено: {recipe.deleted_at?.slice(0, 10)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pl-0 md:pl-15">
                    <ActionButton
                      label="Відновити"
                      confirmText="Відновити як чернетку?"
                      variant="outline"
                      action={() => restoreRecipe(recipe.id)}
                      onDone={() => router.refresh()}
                    />
                    <ActionButton
                      label="Видалити назавжди"
                      confirmText="Видалити з БД? Незворотньо."
                      variant="destructive"
                      action={() => purgeRecipe(recipe.id)}
                      onDone={() => router.refresh()}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'products' && (
        <>
          {products.length === 0 && (
            <div className="px-4 md:px-8 py-16 text-center text-gray-400 text-sm">Архів продуктів порожній 🌿</div>
          )}
          <div className="divide-y divide-gray-100">
            {products.map(product => {
              const name = product.name_ua || product.name_en || 'Без назви'
              return (
                <div key={product.id} className="px-4 md:px-8 py-4 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-md bg-gray-100 shrink-0 opacity-60 flex items-center justify-center text-lg">
                      🏷
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium opacity-70">{name}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                        {product.author && <span>{product.author.full_name ?? '—'}</span>}
                        {product.kcal != null && <span>{product.kcal} ккал</span>}
                        {product.protein != null && (
                          <span>Б:{product.protein} Ж:{product.fat} В:{product.carbs}</span>
                        )}
                        <span className="text-red-500" suppressHydrationWarning>
                          Видалено: {product.deleted_at?.slice(0, 10)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pl-0 md:pl-15">
                    <ActionButton
                      label="Відновити"
                      confirmText="Відновити продукт?"
                      variant="outline"
                      action={() => restoreProduct(product.id)}
                      onDone={() => router.refresh()}
                    />
                    <ActionButton
                      label="Видалити назавжди"
                      confirmText="Видалити з БД? Незворотньо."
                      variant="destructive"
                      action={() => purgeProduct(product.id)}
                      onDone={() => router.refresh()}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
