const PIXIV_JUMP_PATH = '/jump.php'

function isPixivHost(hostname: string): boolean {
  return hostname === 'pixiv.net' || hostname.endsWith('.pixiv.net')
}

function getJumpTarget(url: URL): string | null {
  const namedTarget = url.searchParams.get('url')
  if (namedTarget) return namedTarget

  const query = url.search.slice(1)
  if (!query || query.includes('=')) return null

  try {
    return decodeURIComponent(query)
  } catch {
    return null
  }
}

/** Return the destination hidden behind Pixiv's external-site warning page. */
export function unwrapPixivJumpUrl(href: string): string {
  let jumpUrl: URL
  try {
    jumpUrl = new URL(href.replaceAll('&amp;', '&'), 'https://www.pixiv.net')
  } catch {
    return href
  }

  if (!isPixivHost(jumpUrl.hostname) || jumpUrl.pathname !== PIXIV_JUMP_PATH) {
    return href
  }

  const target = getJumpTarget(jumpUrl)
  if (!target) return href

  try {
    const targetUrl = new URL(target)
    return targetUrl.protocol === 'http:' || targetUrl.protocol === 'https:'
      ? targetUrl.href
      : href
  } catch {
    return href
  }
}

function escapeAttribute(value: string, quote: string): string {
  const escaped = value.replaceAll('&', '&amp;')
  return quote === '"'
    ? escaped.replaceAll('"', '&quot;')
    : escaped.replaceAll("'", '&#39;')
}

/** Rewrite only anchor href attributes that point at Pixiv's jump page. */
export function unwrapPixivJumpLinks(html: string): string {
  return html.replace(
    /(href\s*=\s*)(["'])([\s\S]*?)\2/gi,
    (attribute, prefix: string, quote: string, href: string) => {
      const target = unwrapPixivJumpUrl(href)
      if (target === href) return attribute
      return `${prefix}${quote}${escapeAttribute(target, quote)}${quote}`
    }
  )
}
