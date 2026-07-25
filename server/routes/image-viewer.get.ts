const FAVICON_URL = '/favicon.ico?v=pixivfun-20260725'

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!
  )
}

function getImageSource(value: unknown): string {
  const source = Array.isArray(value) ? value[0] : value
  if (typeof source !== 'string' || !source) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing original image URL',
    })
  }

  const parsed = new URL(source, 'http://pixivfun.local')
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid original image URL',
    })
  }

  return source
}

function getImageFilename(source: string): string {
  const pathname = new URL(source, 'http://pixivfun.local').pathname
  const encodedFilename = pathname.split('/').pop()
  if (!encodedFilename) return 'Pixiv 原图'

  try {
    return decodeURIComponent(encodedFilename)
  } catch {
    return encodedFilename
  }
}

export default defineEventHandler((event) => {
  const source = getImageSource(getQuery(event).src)
  const filename = getImageFilename(source)

  setResponseHeaders(event, {
    'cache-control': 'no-store',
    'content-type': 'text/html; charset=utf-8',
    'x-content-type-options': 'nosniff',
  })

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#0f1117">
    <link rel="icon" type="image/x-icon" href="${FAVICON_URL}">
    <title>${escapeHtml(filename)}</title>
    <style>
      html, body {
        min-height: 100%;
        margin: 0;
        background: #0f1117;
      }

      body {
        display: grid;
        min-height: 100vh;
        place-items: center;
      }

      img {
        display: block;
        width: auto;
        height: auto;
        max-width: 100vw;
        max-height: 100vh;
        object-fit: contain;
      }
    </style>
  </head>
  <body>
    <img src="${escapeHtml(source)}" alt="${escapeHtml(filename)}">
  </body>
</html>`
})
