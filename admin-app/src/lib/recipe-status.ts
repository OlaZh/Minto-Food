export const RECIPE_STATUS_LABELS: Record<string, { label: string; class: string }> = {
  draft: { label: 'Чернетка', class: 'bg-gray-100 text-gray-600' },
  scheduled: { label: 'Заплановано', class: 'bg-blue-100 text-blue-700' },
  published: { label: 'Опубліковано', class: 'bg-green-100 text-green-700' },
  pending: { label: 'На модерації', class: 'bg-yellow-100 text-yellow-700' },
  rejected: { label: 'Відхилено', class: 'bg-red-100 text-red-700' },
}
