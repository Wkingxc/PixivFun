export type ArtworkAccentTone = 'pink' | 'blue'
export type ArtworkPanelTone = 'surface' | 'pixiv-gray'

export function resolveArtworkAccentTone(
  development: boolean,
  stored: string | null | undefined
): ArtworkAccentTone {
  if (!development) return 'pink'
  return stored === 'blue' ? 'blue' : 'pink'
}

export function resolveArtworkPanelTone(
  development: boolean,
  stored: string | null | undefined
): ArtworkPanelTone {
  if (!development) return 'surface'
  return stored === 'pixiv-gray' ? 'pixiv-gray' : 'surface'
}
