import { join } from 'node:path'
import { resolveAppDataDir } from './data-dir.ts'
import { LocalPersistenceRepository } from './repository.ts'

let repository: LocalPersistenceRepository | undefined

export function useLocalPersistenceRepository(): LocalPersistenceRepository {
  if (!repository) {
    const dataDir = resolveAppDataDir()
    repository = new LocalPersistenceRepository({
      databasePath: join(dataDir, 'pixivfun.sqlite'),
    })
  }
  return repository
}

export function resetLocalPersistenceRepositoryForTests(): void {
  repository?.close()
  repository = undefined
}
