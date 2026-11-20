export const MODERATION_FILTERS = [
  { value: 'review', label: 'На перевірці' },
  { value: 'unpublished', label: 'Без опублікованих' },
  { value: 'published', label: 'Опубліковані' },
] as const

export type ModerationFilter = (typeof MODERATION_FILTERS)[number]['value']

export function moderationHref(filter: ModerationFilter, page = 1) {
  const params = new URLSearchParams()

  if (filter !== 'review') params.set('status', filter)
  if (page > 1) params.set('page', String(page))

  const query = params.toString()
  return query ? `/moderation?${query}` : '/moderation'
}
