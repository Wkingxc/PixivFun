export function shouldUseSecureCookie(
  protocol: 'http' | 'https'
): boolean {
  return protocol === 'https'
}
