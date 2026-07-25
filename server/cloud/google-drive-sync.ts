import { randomUUID } from 'node:crypto'
import {
  mergePixivFunData,
  parsePixivFunData,
  type PixivFunDataDocument,
} from '../../shared/pixivfun-data.ts'
import type { LocalPersistenceRepository } from '../persistence/repository.ts'
import type { GoogleFetch } from './google-oauth.ts'

const DATA_FILE_NAME = 'pixivfun-data.json'
const MAX_DOWNLOAD_BYTES = 32 * 1024 * 1024

interface DriveFile {
  id: string
  name: string
}

export class GoogleDriveSyncService {
  private readonly repository: LocalPersistenceRepository
  private readonly getAccessToken: () => Promise<string>
  private readonly fetch: GoogleFetch

  constructor(input: {
    repository: LocalPersistenceRepository
    getAccessToken: () => Promise<string>
    fetch: GoogleFetch
  }) {
    this.repository = input.repository
    this.getAccessToken = input.getAccessToken
    this.fetch = input.fetch
  }

  async upload(): Promise<{
    created: boolean
    artworks: number
    authors: number
  }> {
    const accessToken = await this.getAccessToken()
    const file = await this.findDataFile(accessToken)
    const local = this.repository.exportData()
    const document = file
      ? mergePixivFunData(
          local,
          await this.downloadDataFile(file.id, accessToken)
        )
      : local
    if (file) {
      await this.updateDataFile(file.id, document, accessToken)
    } else {
      await this.createDataFile(document, accessToken)
    }
    return {
      created: !file,
      artworks: document.data.visitedArtworkIds.length,
      authors: document.data.visitedAuthorIds.length,
    }
  }

  async sync(): Promise<{
    found: boolean
    artworksAdded: number
    authorsAdded: number
  }> {
    const accessToken = await this.getAccessToken()
    const file = await this.findDataFile(accessToken)
    if (!file) {
      return { found: false, artworksAdded: 0, authorsAdded: 0 }
    }
    const imported = this.repository.importData(
      await this.downloadDataFile(file.id, accessToken)
    )
    return {
      found: true,
      artworksAdded: imported.artworks,
      authorsAdded: imported.authorVisits,
    }
  }

  private async findDataFile(accessToken: string): Promise<DriveFile | null> {
    const url = new URL('https://www.googleapis.com/drive/v3/files')
    url.searchParams.set('spaces', 'appDataFolder')
    url.searchParams.set('q', `name = '${DATA_FILE_NAME}' and trashed = false`)
    url.searchParams.set('pageSize', '10')
    url.searchParams.set('fields', 'files(id,name)')
    const response = await this.request(url, accessToken)
    const value = (await response.json()) as { files?: unknown }
    if (!Array.isArray(value.files)) {
      throw new Error('Google Drive returned an invalid file list')
    }
    const file = value.files.find(
      (item): item is DriveFile =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as DriveFile).id === 'string' &&
        (item as DriveFile).name === DATA_FILE_NAME
    )
    return file || null
  }

  private async downloadDataFile(
    fileId: string,
    accessToken: string
  ): Promise<PixivFunDataDocument> {
    const url = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`
    )
    url.searchParams.set('alt', 'media')
    const response = await this.request(url, accessToken)
    const length = Number(response.headers.get('content-length') || 0)
    if (length > MAX_DOWNLOAD_BYTES) {
      throw new Error('Google Drive data file is too large')
    }
    const body = await response.text()
    if (Buffer.byteLength(body, 'utf8') > MAX_DOWNLOAD_BYTES) {
      throw new Error('Google Drive data file is too large')
    }
    return parsePixivFunData(JSON.parse(body))
  }

  private async createDataFile(
    document: PixivFunDataDocument,
    accessToken: string
  ): Promise<void> {
    const boundary = `pixivfun-${randomUUID()}`
    const metadata = JSON.stringify({
      name: DATA_FILE_NAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    })
    const content = JSON.stringify(document)
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      content,
      `--${boundary}--`,
      '',
    ].join('\r\n')
    const url = new URL('https://www.googleapis.com/upload/drive/v3/files')
    url.searchParams.set('uploadType', 'multipart')
    url.searchParams.set('fields', 'id,name')
    await this.request(url, accessToken, {
      method: 'POST',
      headers: {
        'content-type': `multipart/related; boundary=${boundary}`,
      },
      body,
    })
  }

  private async updateDataFile(
    fileId: string,
    document: PixivFunDataDocument,
    accessToken: string
  ): Promise<void> {
    const url = new URL(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        fileId
      )}`
    )
    url.searchParams.set('uploadType', 'media')
    url.searchParams.set('fields', 'id,name')
    await this.request(url, accessToken, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(document),
    })
  }

  private async request(
    url: URL,
    accessToken: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const response = await this.fetch(url, {
      ...init,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        ...Object.fromEntries(new Headers(init.headers)),
      },
      signal: init.signal || AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
      throw new Error(`Google Drive request failed (${response.status})`)
    }
    return response
  }
}
