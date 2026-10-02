export const MAX_RECIPE_IMAGE_BYTES = 3 * 1024 * 1024
export const IMAGE_TOO_LARGE_MESSAGE = 'Фото завелике. Максимальний розмір — 3 МБ.'

export function isRecipeImageTooLarge(image?: string): boolean {
  if (!image || !/^data:image\/[^;,]+;base64,/i.test(image)) return false
  const encoded = image.slice(image.indexOf(',') + 1).replace(/\s/g, '')
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  return Math.floor(encoded.length * 3 / 4) - padding > MAX_RECIPE_IMAGE_BYTES
}
