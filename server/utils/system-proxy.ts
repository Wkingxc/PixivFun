type ProxyEnvironment = Record<string, string | undefined>

const SYSTEM_PROXY_CACHE_MS = 5_000
let cachedSystemProxy: { expiresAt: number; url: string | null } | null = null

const WINDOWS_INTERNET_SETTINGS =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'

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

function normalizeHttpProxy(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`
  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname)
      return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export function parseWindowsSystemProxy(output: string): string | null {
  const enableMatch = output.match(/^\s*ProxyEnable\s+REG_DWORD\s+(\S+)\s*$/im)
  if (!enableMatch || Number.parseInt(enableMatch[1]!, 0) !== 1) return null

  const serverMatch = output.match(/^\s*ProxyServer\s+REG_\w+\s+(.+?)\s*$/im)
  const proxyServer = serverMatch?.[1]?.trim()
  if (!proxyServer) return null

  if (!proxyServer.includes('=')) return normalizeHttpProxy(proxyServer)

  const mappings = new Map<string, string>()
  for (const part of proxyServer.split(';')) {
    const separator = part.indexOf('=')
    if (separator <= 0) continue
    mappings.set(
      part.slice(0, separator).trim().toLowerCase(),
      part.slice(separator + 1).trim()
    )
  }
  return normalizeHttpProxy(mappings.get('https') ?? mappings.get('http') ?? '')
}

async function execFileText(
  executable: string,
  args: string[]
): Promise<string> {
  const { execFile } = await import('node:child_process')
  return new Promise<string>((resolve, reject) => {
    execFile(
      executable,
      args,
      { encoding: 'utf8', timeout: 1_000 },
      (error, stdout) => {
        if (error) reject(error)
        else resolve(stdout)
      }
    )
  })
}

async function readSystemProxy(): Promise<string | null> {
  if (process.platform === 'win32') {
    return parseWindowsSystemProxy(
      await execFileText('reg.exe', ['query', WINDOWS_INTERNET_SETTINGS])
    )
  }
  if (process.platform === 'darwin') {
    return parseMacOSSystemProxy(
      await execFileText('/usr/sbin/scutil', ['--proxy'])
    )
  }
  return null
}

export async function resolveUpstreamProxyUrl(): Promise<string | null> {
  const configured = resolveConfiguredProxyUrl()
  if (configured) return configured
  if (!['darwin', 'win32'].includes(process.platform)) return null

  const now = Date.now()
  if (cachedSystemProxy && cachedSystemProxy.expiresAt > now) {
    return cachedSystemProxy.url
  }

  try {
    const url = await readSystemProxy()
    cachedSystemProxy = {
      expiresAt: now + SYSTEM_PROXY_CACHE_MS,
      url,
    }
    return url
  } catch {
    if (cachedSystemProxy) {
      cachedSystemProxy.expiresAt = now + SYSTEM_PROXY_CACHE_MS
      return cachedSystemProxy.url
    }
    return null
  }
}
