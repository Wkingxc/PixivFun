type ProxyEnvironment = Record<string, string | undefined>

const SYSTEM_PROXY_CACHE_MS = 5_000
let cachedSystemProxy: { expiresAt: number; url: string | null } | null = null

export function resolveConfiguredProxyUrl(
  environment: ProxyEnvironment = process.env
): string | null {
  return (
    environment.PIXIVFUN_PROXY ||
    environment.https_proxy ||
    environment.HTTPS_PROXY ||
    environment.http_proxy ||
    environment.HTTP_PROXY ||
    null
  )
}

export function parseMacOSSystemProxy(output: string): string | null {
  const values = new Map<string, string>()
  for (const match of output.matchAll(/^\s*([A-Za-z]+)\s*:\s*(.*?)\s*$/gm)) {
    values.set(match[1]!, match[2]!)
  }

  for (const prefix of ['HTTPS', 'HTTP']) {
    if (values.get(`${prefix}Enable`) !== '1') continue
    const host = values.get(`${prefix}Proxy`)
    const port = Number(values.get(`${prefix}Port`))
    if (!host || !Number.isInteger(port) || port < 1 || port > 65_535) continue
    const formattedHost =
      host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
    return `http://${formattedHost}:${port}`
  }

  return null
}

export async function resolveUpstreamProxyUrl(): Promise<string | null> {
  const configured = resolveConfiguredProxyUrl()
  if (configured) return configured
  if (process.platform !== 'darwin') return null

  const now = Date.now()
  if (cachedSystemProxy && cachedSystemProxy.expiresAt > now) {
    return cachedSystemProxy.url
  }

  let url: string | null = null
  try {
    const { execFile } = await import('node:child_process')
    const output = await new Promise<string>((resolve, reject) => {
      execFile(
        '/usr/sbin/scutil',
        ['--proxy'],
        { encoding: 'utf8', timeout: 1_000 },
        (error, stdout) => {
          if (error) {
            reject(error)
          } else {
            resolve(stdout)
          }
        }
      )
    })
    url = parseMacOSSystemProxy(output)
  } catch {
    // Fall back to a direct connection when system proxy discovery is unavailable.
  }

  cachedSystemProxy = {
    expiresAt: now + SYSTEM_PROXY_CACHE_MS,
    url,
  }
  return url
}
