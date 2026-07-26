import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  DEFAULT_LOCAL_PREFERENCES,
  mergeLocalPreferences,
  normalizeLocalPreferencesPatch,
  type LocalPreferences,
  type LocalPreferencesPatch,
} from '../../shared/local-preferences.ts'
import {
  parsePixivFunData,
  type PixivFunDataDocument,
} from '../../shared/pixivfun-data.ts'
import { normalizePixivId } from '../../shared/pixiv-resource.ts'

export const DEFAULT_PROFILE_ID = 'local-default'

export interface MarkerImportResult {
  artworks: number
  authors: number
}

export interface PixivFunImportResult {
  artworks: number
  authorVisits: number
}

export interface LocalPersistenceRepositoryOptions {
  databasePath: string
  profileId?: string
}

interface MarkerRecord {
  id: string
}

interface NormalizedMarkerBackup {
  artworks: MarkerRecord[]
  authors: MarkerRecord[]
}

const SCHEMA_VERSION = 3
const MAX_IMPORT_RECORDS = 200_000
const MAX_BATCH_IDS = 500

const INITIAL_SCHEMA = `
  CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE settings (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (profile_id, namespace, key)
  );

  CREATE TABLE artwork_visits (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    artwork_id TEXT NOT NULL,
    PRIMARY KEY (profile_id, artwork_id)
  );

  CREATE TABLE author_visits (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    PRIMARY KEY (profile_id, author_id)
  );

  CREATE TABLE cloud_credentials (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    sealed_payload TEXT NOT NULL,
    key_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (profile_id, provider)
  );

  CREATE TABLE credentials (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    pixiv_user_id TEXT NOT NULL,
    sealed_payload TEXT NOT NULL,
    key_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX credentials_profile_idx ON credentials(profile_id);

  CREATE TABLE local_sessions (
    token_hash TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  );

  CREATE INDEX local_sessions_expiry_idx ON local_sessions(expires_at);

  CREATE TABLE cache_entries (
    namespace TEXT NOT NULL,
    cache_key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (namespace, cache_key)
  );

  CREATE INDEX cache_entries_expiry_idx ON cache_entries(expires_at);
`

export class LocalPersistenceRepository {
  readonly profileId: string
  readonly databasePath: string
  private readonly database: DatabaseSync

  constructor(options: LocalPersistenceRepositoryOptions) {
    this.profileId = options.profileId || DEFAULT_PROFILE_ID
    this.databasePath = options.databasePath
    mkdirSync(dirname(options.databasePath), { recursive: true, mode: 0o700 })
    this.database = new DatabaseSync(options.databasePath)
    this.configure()
    this.migrate()
  }

  private configure(): void {
    this.database.exec('PRAGMA busy_timeout = 5000')
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
    `)
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )
    `)
    const row = this.database
      .prepare(
        'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations'
      )
      .get() as { version: number }
    if (row.version > SCHEMA_VERSION) {
      throw new Error(
        `Database schema ${row.version} is newer than supported ${SCHEMA_VERSION}`
      )
    }
    if (row.version < 1) {
      this.transaction(() => {
        this.database.exec(INITIAL_SCHEMA)
        this.database
          .prepare(
            'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)'
          )
          .run(SCHEMA_VERSION, Date.now())
      })
    } else if (row.version < 2) {
      this.transaction(() => {
        this.database.exec(`
          CREATE TABLE artwork_visits_v2 (
            profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            artwork_id TEXT NOT NULL,
            PRIMARY KEY (profile_id, artwork_id)
          );
          INSERT OR IGNORE INTO artwork_visits_v2(profile_id, artwork_id)
            SELECT profile_id, artwork_id FROM artwork_reading_state;
          DROP TABLE artwork_reading_state;
          ALTER TABLE artwork_visits_v2 RENAME TO artwork_visits;

          CREATE TABLE author_visits_v2 (
            profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            author_id TEXT NOT NULL,
            PRIMARY KEY (profile_id, author_id)
          );
          INSERT OR IGNORE INTO author_visits_v2(profile_id, author_id)
            SELECT profile_id, author_id FROM author_visits;
          DROP TABLE author_visits;
          ALTER TABLE author_visits_v2 RENAME TO author_visits;

          DROP TABLE IF EXISTS author_marks;
          DROP TABLE IF EXISTS page_exclusions;
        `)
        this.database
          .prepare(
            'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)'
          )
          .run(2, Date.now())
      })
    }
    if (row.version >= 1 && row.version < 3) {
      this.transaction(() => {
        this.database.exec(`
          CREATE TABLE IF NOT EXISTS cloud_credentials (
            profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            provider TEXT NOT NULL,
            sealed_payload TEXT NOT NULL,
            key_id TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (profile_id, provider)
          );
        `)
        this.database
          .prepare(
            'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)'
          )
          .run(3, Date.now())
      })
    }

    const now = Date.now()
    this.database
      .prepare(
        `INSERT INTO profiles(id, created_at, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .run(this.profileId, now, now)
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec('BEGIN IMMEDIATE')
    try {
      const result = operation()
      this.database.exec('COMMIT')
      return result
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }

  close(): void {
    this.database.close()
  }

  getPreferences(): LocalPreferences {
    const rows = this.database
      .prepare(
        `SELECT namespace, key, value_json
         FROM settings
         WHERE profile_id = ?`
      )
      .all(this.profileId) as Array<{
      namespace: string
      key: string
      value_json: string
    }>
    const stored: Record<string, Record<string, unknown>> = {}
    for (const row of rows) {
      ;(stored[row.namespace] ||= {})[row.key] = JSON.parse(row.value_json)
    }
    const normalized = normalizeLocalPreferencesPatch(stored)
    return mergeLocalPreferences(DEFAULT_LOCAL_PREFERENCES, normalized)
  }

  updatePreferences(patch: unknown): LocalPreferences {
    const normalized = normalizeLocalPreferencesPatch(patch)
    this.transaction(() => this.writePreferences(normalized))
    return this.getPreferences()
  }

  importLegacyPreferences(patch: unknown): {
    preferences: LocalPreferences
    imported: string[]
  } {
    const normalized = normalizeLocalPreferencesPatch(patch)
    const select = this.database.prepare(
      `SELECT 1 FROM settings
       WHERE profile_id = ? AND namespace = ? AND key = ?`
    )
    const insert = this.database.prepare(
      `INSERT INTO settings(profile_id, namespace, key, value_json, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    const imported: string[] = []
    this.transaction(() => {
      const now = Date.now()
      for (const [namespace, values] of Object.entries(normalized)) {
        for (const [key, value] of Object.entries(values || {})) {
          if (select.get(this.profileId, namespace, key)) continue
          insert.run(this.profileId, namespace, key, JSON.stringify(value), now)
          imported.push(`${namespace}.${key}`)
        }
      }
    })
    return { preferences: this.getPreferences(), imported }
  }

  private writePreferences(patch: LocalPreferencesPatch): number {
    const statement = this.database.prepare(
      `INSERT INTO settings(profile_id, namespace, key, value_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(profile_id, namespace, key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at`
    )
    const now = Date.now()
    let count = 0
    for (const [namespace, values] of Object.entries(patch)) {
      for (const [key, value] of Object.entries(values || {})) {
        statement.run(
          this.profileId,
          namespace,
          key,
          JSON.stringify(value),
          now
        )
        count += 1
      }
    }
    return count
  }

  recordArtworkVisit(artworkIdValue: unknown): void {
    const artworkId = requirePixivId(artworkIdValue, 'artworkId')
    this.database
      .prepare(
        `INSERT OR IGNORE INTO artwork_visits(profile_id, artwork_id)
         VALUES (?, ?)`
      )
      .run(this.profileId, artworkId)
  }

  getVisitedArtworkIds(ids: unknown[]): string[] {
    const normalized = Array.from(
      new Set(ids.map((id) => requirePixivId(id, 'artworkId')))
    )
    const visited = new Set<string>()
    for (let index = 0; index < normalized.length; index += MAX_BATCH_IDS) {
      const batch = normalized.slice(index, index + MAX_BATCH_IDS)
      if (!batch.length) continue
      const placeholders = batch.map(() => '?').join(', ')
      const rows = this.database
        .prepare(
          `SELECT artwork_id
           FROM artwork_visits
           WHERE profile_id = ? AND artwork_id IN (${placeholders})`
        )
        .all(this.profileId, ...batch) as Array<{ artwork_id: string }>
      for (const row of rows) visited.add(row.artwork_id)
    }
    return normalized.filter((id) => visited.has(id))
  }

  recordAuthorVisit(authorIdValue: unknown): void {
    const authorId = requirePixivId(authorIdValue, 'authorId')
    this.database
      .prepare(
        `INSERT OR IGNORE INTO author_visits(profile_id, author_id)
         VALUES (?, ?)`
      )
      .run(this.profileId, authorId)
  }

  getVisitedAuthorIds(ids: unknown[]): string[] {
    const normalized = Array.from(
      new Set(ids.map((id) => requirePixivId(id, 'authorId')))
    )
    const visited = new Set<string>()
    for (let index = 0; index < normalized.length; index += MAX_BATCH_IDS) {
      const batch = normalized.slice(index, index + MAX_BATCH_IDS)
      if (!batch.length) continue
      const placeholders = batch.map(() => '?').join(', ')
      const rows = this.database
        .prepare(
          `SELECT author_id
           FROM author_visits
           WHERE profile_id = ? AND author_id IN (${placeholders})`
        )
        .all(this.profileId, ...batch) as Array<{ author_id: string }>
      for (const row of rows) visited.add(row.author_id)
    }
    return normalized.filter((id) => visited.has(id))
  }

  getCache(namespace: string, key: string, now = Date.now()): unknown | null {
    const row = this.database
      .prepare(
        `SELECT value_json FROM cache_entries
         WHERE namespace = ? AND cache_key = ? AND expires_at > ?`
      )
      .get(namespace, key, now) as { value_json: string } | undefined
    return row ? JSON.parse(row.value_json) : null
  }

  setCache(
    namespace: string,
    key: string,
    value: unknown,
    expiresAt: number
  ): void {
    assertCacheKey(namespace, 'namespace')
    assertCacheKey(key, 'cache key')
    validTimestamp(expiresAt, 'expiresAt')
    this.database
      .prepare(
        `INSERT INTO cache_entries(
          namespace, cache_key, value_json, expires_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(namespace, cache_key) DO UPDATE SET
          value_json = excluded.value_json,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at`
      )
      .run(namespace, key, JSON.stringify(value), expiresAt, Date.now())
  }

  clearCache(namespace?: string): number {
    const result = namespace
      ? this.database
          .prepare('DELETE FROM cache_entries WHERE namespace = ?')
          .run(namespace)
      : this.database.prepare('DELETE FROM cache_entries').run()
    return Number(result.changes)
  }

  saveCredential(input: {
    sealedPayload: string
    pixivUserId: string
    keyId: string
  }): string {
    const pixivUserId = requirePixivId(input.pixivUserId, 'pixivUserId')
    if (!input.sealedPayload || !input.keyId) {
      throw new TypeError('credential payload is invalid')
    }
    const existing = this.database
      .prepare('SELECT id FROM credentials WHERE profile_id = ?')
      .get(this.profileId) as { id: string } | undefined
    const id = existing?.id || randomUUID()
    this.database
      .prepare(
        `INSERT INTO credentials(
          id, profile_id, pixiv_user_id, sealed_payload, key_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(profile_id) DO UPDATE SET
          pixiv_user_id = excluded.pixiv_user_id,
          sealed_payload = excluded.sealed_payload,
          key_id = excluded.key_id,
          updated_at = excluded.updated_at`
      )
      .run(
        id,
        this.profileId,
        pixivUserId,
        input.sealedPayload,
        input.keyId,
        Date.now()
      )
    return id
  }

  createLocalSession(
    tokenHash: string,
    credentialId: string,
    expiresAt: number
  ): void {
    this.database
      .prepare(
        `INSERT INTO local_sessions(
          token_hash, profile_id, credential_id, expires_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(tokenHash, this.profileId, credentialId, expiresAt, Date.now())
  }

  getCredentialForSession(
    tokenHash: string,
    now = Date.now()
  ): { sealedPayload: string; keyId: string } | null {
    const row = this.database
      .prepare(
        `SELECT credentials.sealed_payload, credentials.key_id
         FROM local_sessions
         JOIN credentials ON credentials.id = local_sessions.credential_id
         WHERE local_sessions.token_hash = ?
           AND local_sessions.profile_id = ?
           AND local_sessions.expires_at > ?`
      )
      .get(tokenHash, this.profileId, now) as
      { sealed_payload: string; key_id: string } | undefined
    if (!row) return null
    this.database
      .prepare(
        'UPDATE local_sessions SET last_seen_at = ? WHERE token_hash = ?'
      )
      .run(now, tokenHash)
    return { sealedPayload: row.sealed_payload, keyId: row.key_id }
  }

  deleteLocalSession(tokenHash: string): void {
    this.database
      .prepare('DELETE FROM local_sessions WHERE token_hash = ?')
      .run(tokenHash)
  }

  clearCredentials(): void {
    this.database
      .prepare('DELETE FROM credentials WHERE profile_id = ?')
      .run(this.profileId)
  }

  saveCloudCredential(input: {
    provider: string
    sealedPayload: string
    keyId: string
  }): void {
    assertCloudProvider(input.provider)
    if (!input.sealedPayload || !input.keyId) {
      throw new TypeError('cloud credential payload is invalid')
    }
    this.database
      .prepare(
        `INSERT INTO cloud_credentials(
          profile_id, provider, sealed_payload, key_id, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(profile_id, provider) DO UPDATE SET
          sealed_payload = excluded.sealed_payload,
          key_id = excluded.key_id,
          updated_at = excluded.updated_at`
      )
      .run(
        this.profileId,
        input.provider,
        input.sealedPayload,
        input.keyId,
        Date.now()
      )
  }

  getCloudCredential(
    provider: string
  ): { sealedPayload: string; keyId: string } | null {
    assertCloudProvider(provider)
    const row = this.database
      .prepare(
        `SELECT sealed_payload, key_id
         FROM cloud_credentials
         WHERE profile_id = ? AND provider = ?`
      )
      .get(this.profileId, provider) as
      { sealed_payload: string; key_id: string } | undefined
    return row ? { sealedPayload: row.sealed_payload, keyId: row.key_id } : null
  }

  deleteCloudCredential(provider: string): void {
    assertCloudProvider(provider)
    this.database
      .prepare(
        'DELETE FROM cloud_credentials WHERE profile_id = ? AND provider = ?'
      )
      .run(this.profileId, provider)
  }

  importMarkerBackup(input: unknown): MarkerImportResult {
    const backup = normalizeMarkerBackup(input)
    return this.transaction(() => {
      for (const artwork of backup.artworks) {
        this.recordArtworkVisit(artwork.id)
      }
      for (const author of backup.authors) {
        this.recordAuthorVisit(author.id)
      }
      return {
        artworks: backup.artworks.length,
        authors: backup.authors.length,
      }
    })
  }

  exportData(): PixivFunDataDocument {
    const visitedArtworkIds = (
      this.database
        .prepare(
          `SELECT artwork_id
           FROM artwork_visits
           WHERE profile_id = ?
           ORDER BY artwork_id`
        )
        .all(this.profileId) as Array<{ artwork_id: string }>
    ).map((row) => row.artwork_id)
    const visitedAuthorIds = (
      this.database
        .prepare(
          `SELECT author_id
           FROM author_visits
           WHERE profile_id = ?
           ORDER BY author_id`
        )
        .all(this.profileId) as Array<{ author_id: string }>
    ).map((row) => row.author_id)
    return {
      exportedAt: Date.now(),
      data: {
        visitedArtworkIds,
        visitedAuthorIds,
      },
    }
  }

  importData(input: unknown): PixivFunImportResult {
    const backup = parsePixivFunData(input)
    return this.transaction(() => {
      const artworkStatement = this.database.prepare(
        `INSERT OR IGNORE INTO artwork_visits(profile_id, artwork_id)
         VALUES (?, ?)`
      )
      let artworks = 0
      for (const artworkId of backup.data.visitedArtworkIds) {
        artworks += Number(
          artworkStatement.run(this.profileId, artworkId).changes
        )
      }

      const authorVisitStatement = this.database.prepare(
        `INSERT OR IGNORE INTO author_visits(profile_id, author_id)
         VALUES (?, ?)`
      )
      let authorVisits = 0
      for (const authorId of backup.data.visitedAuthorIds) {
        authorVisits += Number(
          authorVisitStatement.run(this.profileId, authorId).changes
        )
      }

      return {
        artworks,
        authorVisits,
      }
    })
  }

  createBackup(destination: string): void {
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 })
    const escaped = destination.replaceAll("'", "''")
    this.database.exec(`VACUUM INTO '${escaped}'`)
  }

  getCounts(): {
    artworks: number
    authors: number
  } {
    const count = (table: string): number => {
      const row = this.database
        .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE profile_id = ?`)
        .get(this.profileId) as { count: number }
      return row.count
    }
    return {
      artworks: count('artwork_visits'),
      authors: count('author_visits'),
    }
  }
}

function requirePixivId(value: unknown, path: string): string {
  const id = normalizePixivId(value)
  if (!id) throw new TypeError(`${path} must be a decimal Pixiv ID`)
  return id
}

function validTimestamp(value: unknown, path: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 9_007_199_254_740_991
  ) {
    throw new TypeError(`${path} must be a valid timestamp`)
  }
  return Math.trunc(value)
}

function assertCacheKey(value: string, path: string): void {
  if (!value || value.length > 200) throw new TypeError(`${path} is invalid`)
}

function assertCloudProvider(value: string): void {
  if (!/^[a-z0-9-]{1,64}$/.test(value)) {
    throw new TypeError('cloud provider is invalid')
  }
}

function normalizeMarkerBackup(input: unknown): NormalizedMarkerBackup {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('marker backup must be an object')
  }
  const backup = input as Record<string, unknown>
  if (backup.schemaVersion !== 1) {
    throw new TypeError('unsupported marker schemaVersion')
  }
  const artworks = markerRecords(backup.viewedArtworks, 'viewedArtworks')
  const authors = markerRecords(backup.viewedUsers, 'viewedUsers')
  if (artworks.length + authors.length > MAX_IMPORT_RECORDS) {
    throw new RangeError('marker backup contains too many records')
  }
  return {
    artworks,
    authors,
  }
}

function markerRecords(value: unknown, path: string): MarkerRecord[] {
  if (value === undefined) return []
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`)
  }
  const records: MarkerRecord[] = []
  for (const [key, rawRecord] of Object.entries(value)) {
    if (
      !rawRecord ||
      typeof rawRecord !== 'object' ||
      Array.isArray(rawRecord)
    ) {
      throw new TypeError(`${path}.${key} must be an object`)
    }
    const record = rawRecord as Record<string, unknown>
    const id = requirePixivId(record.id ?? key, `${path}.${key}.id`)
    if (id !== key)
      throw new TypeError(`${path}.${key}.id does not match its key`)
    records.push({ id })
  }
  return records
}
