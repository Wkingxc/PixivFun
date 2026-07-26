export interface SearchSuggestion {
  tag: string
  translation?: string
}

/**
 * Normalize the /rpc/cps.php autocomplete payload. The endpoint is not part
 * of the documented ajax API, so unknown shapes must degrade to an empty
 * list instead of throwing.
 */
export function normalizeSearchSuggestions(raw: unknown): SearchSuggestion[] {
  const candidates = (raw as { candidates?: unknown } | null)?.candidates
  if (!Array.isArray(candidates)) return []
  const seen = new Set<string>()
  const result: SearchSuggestion[] = []
  for (const item of candidates) {
    const record = item as { tag_name?: unknown; tag_translation?: unknown }
    const tag = typeof record?.tag_name === 'string' ? record.tag_name : ''
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    const translation =
      typeof record.tag_translation === 'string' && record.tag_translation
        ? record.tag_translation
        : undefined
    result.push(translation ? { tag, translation } : { tag })
  }
  return result
}

/**
 * Monotonic sequence guard: lets async callers detect that a newer request
 * has started so a late-arriving older response can be dropped.
 */
export function createSequenceGuard() {
  let current = 0
  return {
    next(): number {
      return ++current
    },
    isCurrent(id: number): boolean {
      return id === current
    },
  }
}
