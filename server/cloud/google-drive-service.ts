import { useLocalPersistenceRepository } from '../persistence/index.ts'
import { proxyAwareFetch } from '../utils/pixiv.ts'
import { getGoogleDriveAccessToken } from './google-connection.ts'
import { GoogleDriveSyncService } from './google-drive-sync.ts'

export function useGoogleDriveSyncService(): GoogleDriveSyncService {
  return new GoogleDriveSyncService({
    repository: useLocalPersistenceRepository(),
    getAccessToken: getGoogleDriveAccessToken,
    fetch: proxyAwareFetch,
  })
}
