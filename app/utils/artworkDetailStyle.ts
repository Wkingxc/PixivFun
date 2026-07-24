export type ArtworkDetailStyle = 'classic' | 'modern'

export const ARTWORK_DETAIL_STYLE_KEY = 'pixivfun:artwork-detail-style'

export function resolveArtworkDetailStyle(
  development: boolean,
  stored: string | null | undefined
): ArtworkDetailStyle {
  if (!development) return 'classic'
  return stored === 'modern' ? 'modern' : 'classic'
}
