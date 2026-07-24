export function getSafeLoginBackTarget(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value
  if (typeof candidate !== 'string') return '/'

  const normalized = candidate.trim()
  if (
    !normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    /^\/login(?:[/?#]|$)/i.test(normalized)
  ) {
    return '/'
  }

  return normalized
}

export function createLoginPath(backTarget: unknown): string {
  const safeTarget = getSafeLoginBackTarget(backTarget)
  return `/login?back=${encodeURIComponent(safeTarget)}`
}
