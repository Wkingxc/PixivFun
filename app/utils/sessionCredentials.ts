interface StorageRemover {
  removeItem(key: string): void
}

export function clearLegacySessionCredentials(storage: {
  local: StorageRemover
  session: StorageRemover
}): void {
  storage.local.removeItem('pixivnow:token')
  storage.session.removeItem('pixivnow:csrf')
}
