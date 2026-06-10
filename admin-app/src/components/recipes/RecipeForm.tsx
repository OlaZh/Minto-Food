'use client'

import { forwardRef, useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Calculator, Tags } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

import ImageUpload from './ImageUpload'
import StepsEditor from './StepsEditor'
import IngredientBuilder from './IngredientBuilder'

import { createClient } from '@/lib/supabase/client'
import { createRecipe, updateRecipe } from '@/app/actions/recipes'
import { generateRecipeTags } from '@/lib/auto-tags'
import { calculateNutrition } from '@/lib/nutrition'
import type {
  Recipe, IngredientRow, RecipeAuthorProfile, Product, Tag,
  RecipeStatus,
} from '@/lib/types'
import {
  RECIPE_TYPES, RECIPE_CATEGORIES, COOKING_METHODS,
  DIFFICULTY_OPTIONS, LOCALES,
} from '@/lib/types'

interface RecipeFormProps {
  recipe?: Recipe
  initialIngredients?: IngredientRow[]
}

interface FormValues {
  name_ua: string
  name_en: string
  name_pl: string
  available_locales: string[]
  short_desc: string
  short_desc_en: string
  short_desc_pl: string
  steps: string
  steps_en: string
  steps_pl: string
  type: string
  category: string
  cooking_method: string
  difficulty: string
  prep_time_min: string
  cook_time_min: string
  kcal: string
  protein: string
  fat: string
  carbs: string
  total_weight: string
  yield_ratio: string
  recipe_yield: string
  status: RecipeStatus
  is_public: boolean
  image: string
  publish_at: string
  author_profile_id: string
}

function toNum(v: string) { return v ? parseFloat(v) : undefined }

export default function RecipeForm({ recipe, initialIngredients = [] }: RecipeFormProps) {
  const router = useRouter()
  const isEdit = !!recipe
  const recipeTagSlugs = recipe?.tags?.map(tag => tag.slug) ?? []

  const [ingredients, setIngredients] = useState<IngredientRow[]>(initialIngredients)
  const [authors, setAuthors] = useState<RecipeAuthorProfile[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [manualSelectedTagSlugs, setManualSelectedTagSlugs] = useState<string[] | null>(
    isEdit ? recipeTagSlugs : null
  )
  const [saving, setSaving] = useState(false)

  const { register, control, handleSubmit, setValue } = useForm<FormValues>({
    defaultValues: {
      name_ua: recipe?.name_ua ?? '',
      name_en: recipe?.name_en ?? '',
      name_pl: recipe?.name_pl ?? '',
      available_locales: recipe?.available_locales ?? ['ua'],
      short_desc: recipe?.short_desc ?? '',
      short_desc_en: recipe?.short_desc_en ?? '',
      short_desc_pl: recipe?.short_desc_pl ?? '',
      steps: recipe?.steps ?? '',
      steps_en: recipe?.steps_en ?? '',
      steps_pl: recipe?.steps_pl ?? '',
      type: recipe?.type ?? '',
      category: recipe?.category ?? '',
      cooking_method: recipe?.cooking_method ?? '',
      difficulty: recipe?.difficulty ?? '',
      prep_time_min: recipe?.prep_time_min?.toString() ?? '',
      cook_time_min: recipe?.cook_time_min?.toString() ?? '',
      kcal: recipe?.kcal?.toString() ?? '',
      protein: recipe?.protein?.toString() ?? '',
      fat: recipe?.fat?.toString() ?? '',
      carbs: recipe?.carbs?.toString() ?? '',
      total_weight: recipe?.total_weight?.toString() ?? '',
      yield_ratio: recipe?.yield_ratio?.toString() ?? '',
      recipe_yield: recipe?.recipe_yield?.toString() ?? '',
      status: recipe?.status ?? 'draft',
      is_public: recipe?.is_public ?? true,
      image: recipe?.image ?? '',
      publish_at: recipe?.publish_at ? recipe.publish_at.slice(0, 16) : '',
      author_profile_id: recipe?.author_profile_id ?? '',
    },
  })

  const watchedType = useWatch({ control, name: 'type' })
  const watchedCategory = useWatch({ control, name: 'category' })
  const watchedCookingMethod = useWatch({ control, name: 'cooking_method' })
  const watchedStatus = useWatch({ control, name: 'status' })
  const watchedYieldRatio = useWatch({ control, name: 'yield_ratio' })

  // Load authors and tags
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: authorRows }, { data: tagRows }] = await Promise.all([
        supabase
          .from('recipe_author_profiles')
          .select('*')
          .order('display_name'),
        supabase
          .from('tags')
          .select('id, slug, name_ua, name_en, name_pl')
          .order('slug'),
      ])
      setAuthors(authorRows ?? [])
      setAllTags(tagRows ?? [])
    }
    load()
  }, [])

  const suggestedTagSlugs = generateRecipeTags(
    ingredients,
    watchedCategory,
    watchedType,
    watchedCookingMethod
  )
  const selectedTagSlugs = manualSelectedTagSlugs ?? suggestedTagSlugs

  function toggleTag(slug: string) {
    setManualSelectedTagSlugs(
      selectedTagSlugs.includes(slug)
        ? selectedTagSlugs.filter(currentSlug => currentSlug !== slug)
        : [...selectedTagSlugs, slug]
    )
  }

  function applySuggestedTags() {
    setManualSelectedTagSlugs(suggestedTagSlugs)
  }

  function clearSelectedTags() {
    setManualSelectedTagSlugs([])
  }

  function getTagLabel(slug: string) {
    const tag = allTags.find(currentTag => currentTag.slug === slug)
    return tag?.name_ua || tag?.name_en || slug
  }

  async function autoCalculate() {
    if (!ingredients.length) { toast.info('Спочатку додайте інгредієнти'); return }

    const yieldRatio = toNum(watchedYieldRatio)
    if (!yieldRatio || yieldRatio <= 0) {
      toast.error('Yield ratio must be greater than 0 before nutrition calculation')
      return
    }

    const supabase = createClient()
    const ids = ingredients.map(i => i.product_id).filter(Boolean)
    const { data: products } = await supabase
      .from('products')
      .select('id, kcal, protein, fat, carbs')
      .in('id', ids)

    if (!products) return
    const productMap = new Map(products.map(p => [p.id, p]))

    const withProducts = ingredients.map(ing => ({
      ...ing,
      product: productMap.get(ing.product_id) as Product,
    })).filter(ing => ing.product)

    const result = calculateNutrition(withProducts, yieldRatio)

    setValue('kcal', result.kcal.toString())
    setValue('protein', result.protein.toString())
    setValue('fat', result.fat.toString())
    setValue('carbs', result.carbs.toString())
    setValue('total_weight', result.total_weight.toString())
    setValue('yield_ratio', result.yield_ratio.toString())
    toast.success('Нутрієнти перераховано')
  }

  async function onSubmit(data: FormValues) {
    if (!data.name_ua.trim()) { toast.error('Назва (UA) обовʼязкова'); return }
    if (ingredients.some(i => !i.product_id)) {
      toast.error('Деякі інгредієнти не мають продукту'); return
    }

    if (data.yield_ratio.trim() !== '' && !(toNum(data.yield_ratio)! > 0)) {
      toast.error('Yield ratio must be greater than 0')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name_ua: data.name_ua,
        name_en: data.name_en || undefined,
        name_pl: data.name_pl || undefined,
        short_desc: data.short_desc || undefined,
        short_desc_en: data.short_desc_en || undefined,
        short_desc_pl: data.short_desc_pl || undefined,
        steps: data.steps || undefined,
        steps_en: data.steps_en || undefined,
        steps_pl: data.steps_pl || undefined,
        type: data.type || undefined,
        category: data.category || undefined,
        cooking_method: data.cooking_method || undefined,
        difficulty: data.difficulty || undefined,
        prep_time_min: toNum(data.prep_time_min),
        cook_time_min: toNum(data.cook_time_min),
        kcal: toNum(data.kcal),
        protein: toNum(data.protein),
        fat: toNum(data.fat),
        carbs: toNum(data.carbs),
        total_weight: toNum(data.total_weight),
        yield_ratio: toNum(data.yield_ratio),
        recipe_yield: toNum(data.recipe_yield),
        status: data.status,
        is_public: data.is_public,
        image: data.image || undefined,
        available_locales: data.available_locales,
        publish_at: data.publish_at ? new Date(data.publish_at).toISOString() : null,
        author_profile_id: data.author_profile_id || null,
      }

      const result = isEdit
        ? await updateRecipe(recipe.id, payload, ingredients, selectedTagSlugs)
        : await createRecipe(payload, ingredients, selectedTagSlugs)

      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(isEdit ? 'Рецепт оновлено' : 'Рецепт створено')
        router.push('/recipes')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold">{isEdit ? 'Редагувати рецепт' : 'Новий рецепт'}</h1>
          {isEdit && <p className="text-xs text-gray-400 mt-0.5">ID: {recipe.id}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
            Скасувати
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {isEdit ? 'Зберегти' : 'Створити'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-0">
        {/* LEFT COLUMN */}
        <div className="px-8 py-6 space-y-8 border-r border-gray-200 overflow-y-auto">

          {/* === GENERAL === */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Загальне</h2>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name_ua" className="text-xs">Назва (UA) *</Label>
                <Input id="name_ua" {...register('name_ua', { required: true })} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name_en" className="text-xs">Name (EN)</Label>
                <Input id="name_en" {...register('name_en')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name_pl" className="text-xs">Nazwa (PL)</Label>
                <Input id="name_pl" {...register('name_pl')} className="h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <SelectField
                label="Тип"
                id="type"
                options={RECIPE_TYPES}
                {...register('type')}
              />
              <SelectField
                label="Категорія"
                id="category"
                options={RECIPE_CATEGORIES}
                {...register('category')}
              />
              <SelectField
                label="Спосіб приготування"
                id="cooking_method"
                options={COOKING_METHODS}
                {...register('cooking_method')}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <SelectField
                label="Складність"
                id="difficulty"
                options={DIFFICULTY_OPTIONS}
                {...register('difficulty')}
              />
              <div className="space-y-1.5">
                <Label htmlFor="prep_time_min" className="text-xs">Підготовка (хв)</Label>
                <Input id="prep_time_min" type="number" min={0} {...register('prep_time_min')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cook_time_min" className="text-xs">Приготування (хв)</Label>
                <Input id="cook_time_min" type="number" min={0} {...register('cook_time_min')} className="h-9 text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Доступні локалі</Label>
              <Controller
                name="available_locales"
                control={control}
                render={({ field }) => (
                  <div className="flex gap-4">
                    {LOCALES.map(loc => (
                      <label key={loc.value} className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <Checkbox
                          checked={field.value.includes(loc.value)}
                          onCheckedChange={checked => {
                            if (checked) field.onChange([...field.value, loc.value])
                            else field.onChange(field.value.filter((v: string) => v !== loc.value))
                          }}
                        />
                        {loc.label}
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>
          </section>

          <Separator />

          {/* === DESCRIPTIONS === */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Описи</h2>
            <Tabs defaultValue="ua">
              <TabsList className="h-8">
                <TabsTrigger value="ua" className="text-xs h-7">UA</TabsTrigger>
                <TabsTrigger value="en" className="text-xs h-7">EN</TabsTrigger>
                <TabsTrigger value="pl" className="text-xs h-7">PL</TabsTrigger>
              </TabsList>
              <TabsContent value="ua" className="mt-3">
                <Textarea {...register('short_desc')} placeholder="Короткий опис (UA)..." rows={2} className="text-sm resize-none" />
              </TabsContent>
              <TabsContent value="en" className="mt-3">
                <Textarea {...register('short_desc_en')} placeholder="Short description (EN)..." rows={2} className="text-sm resize-none" />
              </TabsContent>
              <TabsContent value="pl" className="mt-3">
                <Textarea {...register('short_desc_pl')} placeholder="Krótki opis (PL)..." rows={2} className="text-sm resize-none" />
              </TabsContent>
            </Tabs>
          </section>

          <Separator />

          {/* === STEPS === */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Кроки приготування</h2>
            <Tabs defaultValue="ua">
              <TabsList className="h-8">
                <TabsTrigger value="ua" className="text-xs h-7">UA</TabsTrigger>
                <TabsTrigger value="en" className="text-xs h-7">EN</TabsTrigger>
                <TabsTrigger value="pl" className="text-xs h-7">PL</TabsTrigger>
              </TabsList>
              <TabsContent value="ua" className="mt-3">
                <Controller
                  name="steps"
                  control={control}
                  render={({ field }) => (
                    <StepsEditor label="" value={field.value} onChange={field.onChange} />
                  )}
                />
              </TabsContent>
              <TabsContent value="en" className="mt-3">
                <Controller
                  name="steps_en"
                  control={control}
                  render={({ field }) => (
                    <StepsEditor label="" value={field.value} onChange={field.onChange} />
                  )}
                />
              </TabsContent>
              <TabsContent value="pl" className="mt-3">
                <Controller
                  name="steps_pl"
                  control={control}
                  render={({ field }) => (
                    <StepsEditor label="" value={field.value} onChange={field.onChange} />
                  )}
                />
              </TabsContent>
            </Tabs>
          </section>

          <Separator />

          {/* === INGREDIENTS === */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Інгредієнти</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={autoCalculate}
                className="h-7 text-xs"
              >
                <Calculator className="h-3 w-3 mr-1" />
                Розрахувати КБЖУ
              </Button>
            </div>
            <div className="text-xs text-gray-400 flex gap-4 font-medium px-8">
              <span className="flex-1">Продукт</span>
              <span className="w-20 text-center">Кількість</span>
              <span className="w-20 text-center">Одиниця</span>
              <span className="w-8" />
            </div>
            <IngredientBuilder value={ingredients} onChange={setIngredients} />
          </section>

          <Separator />

          {/* === NUTRITION === */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Нутрієнти (на 100 г)</h2>
            <div className="grid grid-cols-4 gap-3">
              {(['kcal','protein','fat','carbs'] as const).map(key => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key} className="text-xs">{{ kcal:'ккал', protein:'Білки', fat:'Жири', carbs:'Вуглеводи' }[key]}</Label>
                  <Input id={key} type="number" step={0.1} min={0} {...register(key)} className="h-9 text-sm" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="total_weight" className="text-xs">Вага страви (г)</Label>
                <Input id="total_weight" type="number" min={0} {...register('total_weight')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="yield_ratio" className="text-xs">Yield ratio</Label>
                <Input id="yield_ratio" type="number" step={0.01} min={0} max={2} {...register('yield_ratio')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipe_yield" className="text-xs">Порцій</Label>
                <Input id="recipe_yield" type="number" step={0.5} min={0} {...register('recipe_yield')} className="h-9 text-sm" />
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="px-6 py-6 space-y-6 overflow-y-auto">

          {/* Publishing */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Публікація</h2>
            <div className="space-y-1.5">
              <Label className="text-xs">Статус</Label>
              <select
                {...register('status')}
                className="w-full h-9 text-sm border border-gray-200 rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="draft">Чернетка</option>
                <option value="scheduled">Заплановано</option>
                <option value="published">Опубліковано</option>
              </select>
            </div>
            {watchedStatus === 'scheduled' && (
              <div className="space-y-1.5">
                <Label htmlFor="publish_at" className="text-xs">Час публікації</Label>
                <Input
                  id="publish_at"
                  type="datetime-local"
                  {...register('publish_at')}
                  className="h-9 text-sm"
                />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Controller
                name="is_public"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              Публічний
            </label>
          </section>

          <Separator />

          {/* Image */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Зображення</h2>
            <Controller
              name="image"
              control={control}
              render={({ field }) => (
                <ImageUpload
                  currentUrl={field.value || null}
                  onUpload={field.onChange}
                />
              )}
            />
          </section>

          <Separator />

          {/* Author */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Автор</h2>
            <div className="space-y-1.5">
              <select
                {...register('author_profile_id')}
                className="w-full h-9 text-sm border border-gray-200 rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Без автора —</option>
                {authors.map(a => (
                  <option key={a.id} value={a.id}>{a.display_name}</option>
                ))}
              </select>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Tags className="h-3.5 w-3.5 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Теги</h2>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Обрані</p>
                  <div className="flex items-center gap-2">
                    {suggestedTagSlugs.length > 0 && (
                      <Button type="button" variant="ghost" size="xs" onClick={applySuggestedTags}>
                        Прийняти авто
                      </Button>
                    )}
                    {selectedTagSlugs.length > 0 && (
                      <Button type="button" variant="ghost" size="xs" onClick={clearSelectedTags}>
                        Очистити
                      </Button>
                    )}
                  </div>
                </div>

                {selectedTagSlugs.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTagSlugs.map(slug => (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => toggleTag(slug)}
                        className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-gray-500"
                      >
                        {getTagLabel(slug)} · {slug}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Обери теги вручну або застосуй авто-підказки.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Авто-підказки</p>
                {suggestedTagSlugs.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedTagSlugs.map(slug => {
                      const isSelected = selectedTagSlugs.includes(slug)

                      return (
                        <button
                          key={slug}
                          type="button"
                          onClick={() => toggleTag(slug)}
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400'
                          }`}
                        >
                          {getTagLabel(slug)}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Авто-підказки зʼявляться після вибору інгредієнтів або базових параметрів рецепта.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Усі теги</p>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map(tag => {
                    const isSelected = selectedTagSlugs.includes(tag.slug)

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.slug)}
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          isSelected
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {tag.name_ua || tag.name_en || tag.slug}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="hidden">
            <div className="flex items-center gap-1.5">
              <Tags className="h-3.5 w-3.5 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Теги (авто)</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestedTagSlugs.length ? (
                suggestedTagSlugs.map(slug => (
                  <Badge key={slug} variant="secondary" className="text-xs font-normal">
                    {slug}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-gray-400">Додайте інгредієнти для генерації тегів</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </form>
  )
}

// ─── Reusable Select Field ─────────────────────────────────────
interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  id: string
  options: { value: string; label: string }[]
}

const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, id, options, ...props }, ref) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <select
        id={id}
        ref={ref}
        {...props}
        className="w-full h-9 text-sm border border-gray-200 rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">— Не вибрано —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
)
SelectField.displayName = 'SelectField'
