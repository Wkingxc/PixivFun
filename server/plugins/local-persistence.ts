import { resolveAppDataDir } from '~~/server/persistence/data-dir'
import { useLocalPersistenceRepository } from '~~/server/persistence'
import { ensureMasterKey } from '~~/server/persistence/master-key'

export default defineNitroPlugin(() => {
  const dataDir = resolveAppDataDir()
  ensureMasterKey({
    dataDir,
    configuredSecret:
      String(useRuntimeConfig().sessionSecret || '') || undefined,
  })
  useLocalPersistenceRepository()
})
