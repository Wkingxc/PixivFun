/**
 * Tag metadata from Pixiv's tag page endpoint. `translation` is the localized
 * name (the `#…` line on tag chips); `abstract` is the pixpedia summary, the
 * only place the web API exposes a tag's text description.
 */
export interface TagInfo {
  tag: string
  translation: string
  abstract: string
  yomigana: string
  parentTag: string
}

/**
 * Same order Pixiv's own UI falls back through, so a tag with an empty `zh`
 * entry still shows the English name instead of nothing.
 */
const TRANSLATION_PRIORITY = ['zh', 'zh_tw', 'en', 'ms', 'ko', 'romaji']

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function pickTranslation(
  translations: Record<string, unknown> | null,
  tag: string
): string {
  if (!translations) return ''
  const entry =
    asRecord(translations[tag]) ?? asRecord(Object.values(translations)[0])
  if (!entry) return ''
  for (const lang of TRANSLATION_PRIORITY) {
    const value = asText(entry[lang])
    if (value) return value
  }
  return ''
}

export function emptyTagInfo(tag = ''): TagInfo {
  return {
    tag: tag.trim(),
    translation: '',
    abstract: '',
    yomigana: '',
    parentTag: '',
  }
}

export function normalizeTagInfo(payload: unknown, fallbackTag = ''): TagInfo {
  const root = asRecord(payload)
  const body = asRecord(root?.body) ?? root
  const tag = asText(body?.tag) || asText(body?.word) || fallbackTag.trim()
  if (!tag) return emptyTagInfo()

  const pixpedia = asRecord(body?.pixpedia)
  const translation = pickTranslation(asRecord(body?.tagTranslation), tag)

  return {
    tag,
    // A "translation" identical to the tag adds nothing to the chip.
    translation: translation === tag ? '' : translation,
    abstract: asText(pixpedia?.abstract),
    yomigana: asText(pixpedia?.yomigana),
    parentTag: asText(pixpedia?.parentTag),
  }
}
