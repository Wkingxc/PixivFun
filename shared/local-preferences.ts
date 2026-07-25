export interface MarkerColor {
  r: number
  g: number
  b: number
  a: number
}

export interface LocalPreferences {
  appearance: {
    theme: 'auto' | 'light' | 'dark'
  }
  discovery: {
    tab: 'all' | 'novel'
    mode: 'all' | 'safe' | 'r18'
  }
  artworkReader: {
    columns: number
    imageQuality: 'small' | 'regular' | 'original'
    preloadOriginals: boolean
    doublePageMode: boolean
    layoutMode: 'masonry' | 'aligned'
  }
  viewedMarker: {
    artworkVisitedColor: MarkerColor
    markArtworkTitle: boolean
    markArtworkImage: boolean
    hideViewedArtwork: boolean
    artworkImageOverlayOpacity: number
  }
  authorPage: {
    gridColumns: number
    minPageCount: number
    useHighResThumbnails: boolean
    highResThumbnailQuality: 'regular' | 'original'
    hoverPreviewEnabled: boolean
    hoverPreviewQuality: 'off' | 'regular' | 'original'
  }
  relatedWorks: {
    enabled: boolean
    gridColumns: number
    minPageCount: number
    useHighResThumbnails: boolean
    highResThumbnailQuality: 'regular' | 'original'
    hoverPreviewEnabled: boolean
    hoverPreviewQuality: 'off' | 'regular' | 'original'
  }
  artworkPage: {
    hideAuthorWorks: boolean
    hideComments: boolean
    smoothScrollEnabled: boolean
    smoothScrollScreens: number
  }
}

export type LocalPreferencesPatch = {
  [Namespace in keyof LocalPreferences]?: Partial<LocalPreferences[Namespace]>
}

export const DEFAULT_LOCAL_PREFERENCES: LocalPreferences = {
  appearance: {
    theme: 'auto',
  },
  discovery: {
    tab: 'all',
    mode: 'all',
  },
  artworkReader: {
    columns: 3,
    imageQuality: 'small',
    preloadOriginals: true,
    doublePageMode: false,
    layoutMode: 'masonry',
  },
  viewedMarker: {
    artworkVisitedColor: { r: 244, g: 118, b: 162, a: 1 },
    markArtworkTitle: true,
    markArtworkImage: true,
    hideViewedArtwork: false,
    artworkImageOverlayOpacity: 0.54,
  },
  authorPage: {
    gridColumns: 4,
    minPageCount: 0,
    useHighResThumbnails: true,
    highResThumbnailQuality: 'original',
    hoverPreviewEnabled: false,
    hoverPreviewQuality: 'off',
  },
  relatedWorks: {
    enabled: false,
    gridColumns: 6,
    minPageCount: 0,
    useHighResThumbnails: false,
    highResThumbnailQuality: 'original',
    hoverPreviewEnabled: false,
    hoverPreviewQuality: 'off',
  },
  artworkPage: {
    hideAuthorWorks: true,
    hideComments: false,
    smoothScrollEnabled: false,
    smoothScrollScreens: 1,
  },
}

const validators: {
  [Namespace in keyof LocalPreferences]: {
    [Key in keyof LocalPreferences[Namespace]]: (
      value: unknown
    ) => LocalPreferences[Namespace][Key]
  }
} = {
  appearance: {
    theme: enumValue('appearance.theme', ['auto', 'light', 'dark']),
  },
  discovery: {
    tab: enumValue('discovery.tab', ['all', 'novel']),
    mode: enumValue('discovery.mode', ['all', 'safe', 'r18']),
  },
  artworkReader: {
    columns: integerValue('artworkReader.columns', 1, 12),
    imageQuality: enumValue('artworkReader.imageQuality', [
      'small',
      'regular',
      'original',
    ]),
    preloadOriginals: booleanValue('artworkReader.preloadOriginals'),
    doublePageMode: booleanValue('artworkReader.doublePageMode'),
    layoutMode: enumValue('artworkReader.layoutMode', ['masonry', 'aligned']),
  },
  viewedMarker: {
    artworkVisitedColor: colorValue,
    markArtworkTitle: booleanValue('viewedMarker.markArtworkTitle'),
    markArtworkImage: booleanValue('viewedMarker.markArtworkImage'),
    hideViewedArtwork: booleanValue('viewedMarker.hideViewedArtwork'),
    artworkImageOverlayOpacity: numberValue(
      'viewedMarker.artworkImageOverlayOpacity',
      0.1,
      1
    ),
  },
  authorPage: {
    gridColumns: integerValue('authorPage.gridColumns', 1, 12),
    minPageCount: integerValue('authorPage.minPageCount', 0, 999),
    useHighResThumbnails: booleanValue('authorPage.useHighResThumbnails'),
    highResThumbnailQuality: enumValue('authorPage.highResThumbnailQuality', [
      'regular',
      'original',
    ]),
    hoverPreviewEnabled: booleanValue('authorPage.hoverPreviewEnabled'),
    hoverPreviewQuality: enumValue('authorPage.hoverPreviewQuality', [
      'off',
      'regular',
      'original',
    ]),
  },
  relatedWorks: {
    enabled: booleanValue('relatedWorks.enabled'),
    gridColumns: integerValue('relatedWorks.gridColumns', 1, 12),
    minPageCount: integerValue('relatedWorks.minPageCount', 0, 999),
    useHighResThumbnails: booleanValue('relatedWorks.useHighResThumbnails'),
    highResThumbnailQuality: enumValue('relatedWorks.highResThumbnailQuality', [
      'regular',
      'original',
    ]),
    hoverPreviewEnabled: booleanValue('relatedWorks.hoverPreviewEnabled'),
    hoverPreviewQuality: enumValue('relatedWorks.hoverPreviewQuality', [
      'off',
      'regular',
      'original',
    ]),
  },
  artworkPage: {
    hideAuthorWorks: booleanValue('artworkPage.hideAuthorWorks'),
    hideComments: booleanValue('artworkPage.hideComments'),
    smoothScrollEnabled: booleanValue('artworkPage.smoothScrollEnabled'),
    smoothScrollScreens: numberValue(
      'artworkPage.smoothScrollScreens',
      0.25,
      10
    ),
  },
}

function enumValue<const T extends string>(
  path: string,
  allowed: readonly T[]
): (value: unknown) => T {
  return (value) => {
    if (typeof value === 'string' && allowed.includes(value as T)) {
      return value as T
    }
    throw new TypeError(`${path} is invalid`)
  }
}

function booleanValue(path: string): (value: unknown) => boolean {
  return (value) => {
    if (typeof value === 'boolean') return value
    throw new TypeError(`${path} must be a boolean`)
  }
}

function numberValue(
  path: string,
  minimum: number,
  maximum: number
): (value: unknown) => number {
  return (value) => {
    if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= minimum &&
      value <= maximum
    ) {
      return value
    }
    throw new RangeError(`${path} must be between ${minimum} and ${maximum}`)
  }
}

function integerValue(
  path: string,
  minimum: number,
  maximum: number
): (value: unknown) => number {
  const validate = numberValue(path, minimum, maximum)
  return (value) => {
    const result = validate(value)
    if (Number.isInteger(result)) return result
    throw new TypeError(`${path} must be an integer`)
  }
}

function colorChannel(path: string, value: unknown): number {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 255
  ) {
    return value
  }
  throw new RangeError(`${path} must be an integer between 0 and 255`)
}

function colorValue(value: unknown): MarkerColor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('viewedMarker.artworkVisitedColor must be a color')
  }
  const color = value as Record<string, unknown>
  const unknown = Object.keys(color).filter(
    (key) => !['r', 'g', 'b', 'a'].includes(key)
  )
  if (unknown.length) {
    throw new TypeError(
      `viewedMarker.artworkVisitedColor contains unknown key ${unknown[0]}`
    )
  }
  return {
    r: colorChannel('viewedMarker.artworkVisitedColor.r', color.r),
    g: colorChannel('viewedMarker.artworkVisitedColor.g', color.g),
    b: colorChannel('viewedMarker.artworkVisitedColor.b', color.b),
    a: numberValue('viewedMarker.artworkVisitedColor.a', 0, 1)(color.a),
  }
}

export function normalizeLocalPreferencesPatch(
  value: unknown
): LocalPreferencesPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('preferences patch must be an object')
  }
  const input = value as Record<string, unknown>
  const result: LocalPreferencesPatch = {}

  for (const [namespace, rawNamespace] of Object.entries(input)) {
    if (!(namespace in validators)) {
      throw new TypeError(
        `preferences patch contains unknown namespace ${namespace}`
      )
    }
    if (
      !rawNamespace ||
      typeof rawNamespace !== 'object' ||
      Array.isArray(rawNamespace)
    ) {
      throw new TypeError(`${namespace} must be an object`)
    }
    const namespaceValidators = validators[
      namespace as keyof LocalPreferences
    ] as Record<string, (entry: unknown) => unknown>
    const normalized: Record<string, unknown> = {}
    for (const [key, rawValue] of Object.entries(rawNamespace)) {
      const validate = namespaceValidators[key]
      if (!validate) {
        throw new TypeError(`${namespace} contains unknown key ${key}`)
      }
      normalized[key] = validate(rawValue)
    }
    ;(result as Record<string, unknown>)[namespace] = normalized
  }
  return result
}

export function mergeLocalPreferences(
  base: LocalPreferences,
  patch: LocalPreferencesPatch
): LocalPreferences {
  const result = cloneLocalPreferences(base)
  for (const [namespace, values] of Object.entries(patch)) {
    Object.assign(
      result[namespace as keyof LocalPreferences],
      values as Record<string, unknown>
    )
  }
  result.viewedMarker.artworkVisitedColor = {
    ...result.viewedMarker.artworkVisitedColor,
  }
  return result
}

export function cloneLocalPreferences(
  preferences: LocalPreferences
): LocalPreferences {
  return {
    appearance: { ...preferences.appearance },
    discovery: { ...preferences.discovery },
    artworkReader: { ...preferences.artworkReader },
    viewedMarker: {
      ...preferences.viewedMarker,
      artworkVisitedColor: {
        ...preferences.viewedMarker.artworkVisitedColor,
      },
    },
    authorPage: { ...preferences.authorPage },
    relatedWorks: { ...preferences.relatedWorks },
    artworkPage: { ...preferences.artworkPage },
  }
}
