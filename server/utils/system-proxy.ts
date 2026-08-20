import type { LocalPreferences } from '../../shared/local-preferences.ts'

type NetworkProxyPreferences = LocalPreferences['networkProxy']

let runtimeProxyUrl: string | null | undefined

export function resolveConfiguredProxyUrl(
  preferences: NetworkProxyPreferences
): string | null {
  return preferences.enabled && preferences.url ? preferences.url : null
}

export function setRuntimeUpstreamProxy(
  preferences: NetworkProxyPreferences
): void {
  runtimeProxyUrl = resolveConfiguredProxyUrl(preferences)
}

export async function resolveUpstreamProxyUrl(): Promise<string | null> {
  if (runtimeProxyUrl === undefined) {
    const { useLocalPersistenceRepository } =
      await import('../persistence/index.ts')
    setRuntimeUpstreamProxy(
      useLocalPersistenceRepository().getPreferences().networkProxy
    )
  }
  return runtimeProxyUrl ?? null
}
