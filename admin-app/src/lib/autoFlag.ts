export type FlagType = 'inappropriate' | 'suspicious_link'

export interface AutoFlag {
  type: FlagType
  label: string
}

const INAPPROPRIATE_WORDS = [
  // Ukrainian/Russian
  'бля', 'бляд', 'хуй', 'піздець', 'їбан', 'єбан', 'сука', 'падла',
  'мудак', 'уєбок', 'залупа', 'курва', 'шльондра', 'повія',
  // English
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'whore', 'cunt',
  // Spam keywords
  'казино', 'casino', 'ставки', 'betting', 'viagra', 'виагра',
  'кредит без відмови', 'заробіток онлайн',
]

const SUSPICIOUS_LINK_PATTERNS = [
  /\b(casino|bet365|gambling|porn|xxx|onlyfans|viagra|crypto|forex)\b/i,
  /\b(click here|натисни тут|earn money|make \$)\b/i,
  /bit\.ly|tinyurl|cutt\.ly/i,
]

function extractText(recipe: {
  name_ua?: string | null
  name_en?: string | null
  steps?: unknown
}): string {
  const parts: string[] = []
  if (recipe.name_ua) parts.push(recipe.name_ua)
  if (recipe.name_en) parts.push(recipe.name_en)
  if (recipe.steps) {
    if (typeof recipe.steps === 'string') parts.push(recipe.steps)
    else if (Array.isArray(recipe.steps)) parts.push(recipe.steps.join(' '))
  }
  return parts.join(' ').toLowerCase()
}

export function detectFlags(
  recipe: { name_ua?: string | null; name_en?: string | null; steps?: unknown },
): AutoFlag[] {
  const flags: AutoFlag[] = []
  const text = extractText(recipe)

  if (INAPPROPRIATE_WORDS.some(w => text.includes(w))) {
    flags.push({ type: 'inappropriate', label: '🚫 Підозрілий текст' })
  }

  if (SUSPICIOUS_LINK_PATTERNS.some(p => p.test(text))) {
    flags.push({ type: 'suspicious_link', label: '🔗 Підозрілі посилання' })
  }

  return flags
}
