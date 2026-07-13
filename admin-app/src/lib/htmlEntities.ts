const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
}

const ENTITY_PATTERN = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi

export function decodeHtmlEntities(value: string | null | undefined): string {
  let decoded = value ?? ''

  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded.replace(ENTITY_PATTERN, (match, entity: string) => {
      const normalized = entity.toLowerCase()
      if (normalized.startsWith('#')) {
        const isHex = normalized.startsWith('#x')
        const codePoint = Number.parseInt(normalized.slice(isHex ? 2 : 1), isHex ? 16 : 10)
        if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
          try {
            return String.fromCodePoint(codePoint)
          } catch {
            return match
          }
        }
        return match
      }
      return NAMED_ENTITIES[normalized] ?? match
    })

    if (next === decoded) break
    decoded = next
  }

  return decoded
}
