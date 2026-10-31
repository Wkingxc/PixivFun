import {
  normalizeLocalPreferencesPatch,
  type LocalPreferencesPatch,
} from './local-preferences.ts'
import {
  parsePixivFunData,
  type PixivFunDataDocument,
} from './pixivfun-data.ts'
import { normalizeAuthorCategoryName } from './author-categories.ts'
import { normalizePixivId } from './pixiv-resource.ts'

export const MAX_BACKUP_BYTES = 32 * 1024 * 1024
export const BROWSER_PREFERENCE_KEYS = [
  'pixivfun:artwork-directory-card-size',
  'pixivfun:artwork-directory-mode',
  'pixivfun:artwork-detail-max-height',
  'pixivfun:artwork-detail-content-width',
  'pixivfun:artwork-directory-sidebar-width',
  'pixivfun:artwork-detail-accent-tone',
  'pixivfun:artwork-detail-panel-tone',
  'pixivfun:artwork-layout-width',
  'pixivfun:artwork-layout-columns',
  'pixivfun:artwork-layout-image-quality',
  'pixivfun:artwork-layout-min-page-count',
  'pixivfun:marker-button-visible',
  'pixivfun:artwork-layout-button-visible',
  'pixivfun:page-settings-button-visible',
] as const

export interface LocalBackup extends PixivFunDataDocument {
  format: 'pixivfun-backup'
  version: 1
  preferences?: LocalPreferencesPatch
  browserPreferences: Record<string, string>
  categories: { name: string; authorIds: string[] }[]
  featuredAuthors: Record<string, unknown>[]
  hiddenArtworks: { authorId: string; artworkId: string }[]
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('备份内容无效')
  return value as Record<string, unknown>
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 200_000)
    throw new TypeError('备份列表无效或记录过多')
  return value
}

function id(value: unknown): string {
  const result = normalizePixivId(value)
  if (!result) throw new TypeError('备份中包含无效的作品或作者 ID')
  return result
}

export function parseLocalBackup(input: unknown): LocalBackup {
  const source = record(input)
  const visits = parsePixivFunData(source)
  const base: LocalBackup = {
    ...visits,
    format: 'pixivfun-backup',
    version: 1,
    browserPreferences: {},
    categories: [],
    featuredAuthors: [],
    hiddenArtworks: [],
  }
  // Legacy visit exports have no format/version and remain importable.
  if (source.format === undefined && source.version === undefined) return base
  if (source.format !== 'pixivfun-backup' || source.version !== 1)
    throw new TypeError('不支持此备份格式或版本')
  if (source.preferences !== undefined) {
    base.preferences = normalizeLocalPreferencesPatch(source.preferences)
    // Network configuration may contain credentials and is machine-specific.
    delete base.preferences.networkProxy
  }
  for (const [key, value] of Object.entries(
    record(source.browserPreferences)
  )) {
    if (!(BROWSER_PREFERENCE_KEYS as readonly string[]).includes(key)) continue
    if (typeof value !== 'string' || value.length > 1024)
      throw new TypeError('浏览器偏好无效')
    base.browserPreferences[key] = value
  }
  base.categories = list(source.categories).map((value) => {
    const entry = record(value)
    return {
      name: normalizeAuthorCategoryName(entry.name),
      authorIds: [...new Set(list(entry.authorIds).map(id))],
    }
  })
  base.featuredAuthors = list(source.featuredAuthors).map(record)
  base.hiddenArtworks = list(source.hiddenArtworks).map((value) => {
    const entry = record(value)
    return { authorId: id(entry.authorId), artworkId: id(entry.artworkId) }
  })
  return base
}
