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
import { normalizePixivId } from '../../shared/pixiv-resource.ts'

export const DEFAULT_PROFILE_ID = 'local-default'

export interface ArtworkReadingStatus {
  state: 'viewed' | 'unread'
  firstViewedAt: number
  lastViewedAt: number
  lastPage: number | null
  pageCount: number | null
}

export interface MarkerImportResult {
  artworks: number
  authors: number
  exclusions: number
  settings: number
}

export interface PixivFunImportResult {
  artworks: number
  authorVisits: number
  authorMarks: number
  exclusions: number
  settings: number
}

export interface LocalPersistenceRepositoryOptions {
  databasePath: string
  profileId?: string
}

interface MarkerRecord {
  id: string
  visitedAt: number
}

interface NormalizedMarkerBackup {
  settings: LocalPreferencesPatch
  settingCount: number
  artworks: MarkerRecord[]
  authors: MarkerRecord[]
  exclusions: Array<{ pattern: string; label: string; addedAt: number }>
}

const SCHEMA_VERSION = 1
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

  CREATE TABLE artwork_reading_state (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    artwork_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('viewed', 'unread')),
    first_viewed_at INTEGER NOT NULL,
    last_viewed_at INTEGER NOT NULL,
    last_page INTEGER,
    page_count INTEGER,
    source TEXT NOT NULL,
    PRIMARY KEY (profile_id, artwork_id)
  );

  CREATE INDEX artwork_reading_last_viewed_idx
    ON artwork_reading_state(profile_id, last_viewed_at DESC);

  CREATE TABLE author_visits (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    first_visited_at INTEGER NOT NULL,
    last_visited_at INTEGER NOT NULL,
    source TEXT NOT NULL,
    PRIMARY KEY (profile_id, author_id)
  );

  CREATE INDEX author_visits_last_visited_idx
    ON author_visits(profile_id, last_visited_at DESC);

  CREATE TABLE author_marks (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    mark_type TEXT NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (profile_id, author_id)
  );

  CREATE TABLE page_exclusions (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    pattern TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (profile_id, pattern)
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
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
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
          .run(1, Date.now())
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

  recordArtworkVisit(
    artworkIdValue: unknown,
    options: {
      visitedAt?: number
      lastPage?: number | null
      pageCount?: number | null
      source?: string
    } = {}
  ): ArtworkReadingStatus {
    const artworkId = requirePixivId(artworkIdValue, 'artworkId')
    const visitedAt = validTimestamp(
      options.visitedAt ?? Date.now(),
      'visitedAt'
    )
    const lastPage = nullableNonNegativeInteger(options.lastPage, 'lastPage')
    const pageCount = nullableNonNegativeInteger(options.pageCount, 'pageCount')
    this.database
      .prepare(
        `INSERT INTO artwork_reading_state(
          profile_id, artwork_id, state, first_viewed_at, last_viewed_at,
          last_page, page_count, source
        ) VALUES (?, ?, 'viewed', ?, ?, ?, ?, ?)
        ON CONFLICT(profile_id, artwork_id) DO UPDATE SET
          first_viewed_at = MIN(first_viewed_at, excluded.first_viewed_at),
          last_viewed_at = MAX(last_viewed_at, excluded.last_viewed_at),
          last_page = COALESCE(excluded.last_page, last_page),
          page_count = COALESCE(excluded.page_count, page_count),
          source = excluded.source,
          state = CASE
            WHEN artwork_reading_state.state = 'unread' THEN 'unread'
            ELSE 'viewed'
          END`
      )
      .run(
        this.profileId,
        artworkId,
        visitedAt,
        visitedAt,
        lastPage,
        pageCount,
        options.source || 'pixivfun'
      )
    return this.getArtworkStatuses([artworkId])[artworkId]!
  }

  setArtworkState(
    artworkIdValue: unknown,
    state: 'viewed' | 'unread'
  ): ArtworkReadingStatus {
    const artworkId = requirePixivId(artworkIdValue, 'artworkId')
    const now = Date.now()
    this.database
      .prepare(
        `INSERT INTO artwork_reading_state(
          profile_id, artwork_id, state, first_viewed_at, last_viewed_at,
          last_page, page_count, source
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, 'manual')
        ON CONFLICT(profile_id, artwork_id) DO UPDATE SET
          state = excluded.state,
          last_viewed_at = excluded.last_viewed_at,
          source = 'manual'`
      )
      .run(this.profileId, artworkId, state, now, now)
    return this.getArtworkStatuses([artworkId])[artworkId]!
  }

  getArtworkStatuses(ids: unknown[]): Record<string, ArtworkReadingStatus> {
    const normalized = Array.from(
      new Set(ids.map((id) => requirePixivId(id, 'artworkId')))
    )
    const result: Record<string, ArtworkReadingStatus> = {}
    for (let index = 0; index < normalized.length; index += MAX_BATCH_IDS) {
      const batch = normalized.slice(index, index + MAX_BATCH_IDS)
      if (!batch.length) continue
      const placeholders = batch.map(() => '?').join(', ')
      const rows = this.database
        .prepare(
          `SELECT artwork_id, state, first_viewed_at, last_viewed_at,
                  last_page, page_count
           FROM artwork_reading_state
           WHERE profile_id = ? AND artwork_id IN (${placeholders})`
        )
        .all(this.profileId, ...batch) as Array<{
        artwork_id: string
        state: 'viewed' | 'unread'
        first_viewed_at: number
        last_viewed_at: number
        last_page: number | null
        page_count: number | null
      }>
      for (const row of rows) {
        result[row.artwork_id] = {
          state: row.state,
          firstViewedAt: row.first_viewed_at,
          lastViewedAt: row.last_viewed_at,
          lastPage: row.last_page,
          pageCount: row.page_count,
        }
      }
    }
    return result
  }

  recordAuthorVisit(
    authorIdValue: unknown,
    visitedAtValue = Date.now(),
    source = 'pixivfun'
  ): void {
    const authorId = requirePixivId(authorIdValue, 'authorId')
    const visitedAt = validTimestamp(visitedAtValue, 'visitedAt')
    this.database
      .prepare(
        `INSERT INTO author_visits(
          profile_id, author_id, first_visited_at, last_visited_at, source
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(profile_id, author_id) DO UPDATE SET
          first_visited_at = MIN(first_visited_at, excluded.first_visited_at),
          last_visited_at = MAX(last_visited_at, excluded.last_visited_at),
          source = excluded.source`
      )
      .run(this.profileId, authorId, visitedAt, visitedAt, source)
  }

  setAuthorMark(
    authorIdValue: unknown,
    markType: string,
    note: string | null = null
  ): void {
    const authorId = requirePixivId(authorIdValue, 'authorId')
    if (!/^[a-z][a-z0-9_-]{0,31}$/i.test(markType)) {
      throw new TypeError('markType is invalid')
    }
    if (note !== null && (typeof note !== 'string' || note.length > 2_000)) {
      throw new TypeError('note is invalid')
    }
    const now = Date.now()
    this.database
      .prepare(
        `INSERT INTO author_marks(
          profile_id, author_id, mark_type, note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(profile_id, author_id) DO UPDATE SET
          mark_type = excluded.mark_type,
          note = excluded.note,
          updated_at = excluded.updated_at`
      )
      .run(this.profileId, authorId, markType, note, now, now)
  }

  removeAuthorMark(authorIdValue: unknown): void {
    const authorId = requirePixivId(authorIdValue, 'authorId')
    this.database
      .prepare(
        'DELETE FROM author_marks WHERE profile_id = ? AND author_id = ?'
      )
      .run(this.profileId, authorId)
  }

  getAuthorMark(
    authorIdValue: unknown
  ): { markType: string; note: string | null; updatedAt: number } | null {
    const authorId = requirePixivId(authorIdValue, 'authorId')
    const row = this.database
      .prepare(
        `SELECT mark_type, note, updated_at
         FROM author_marks
         WHERE profile_id = ? AND author_id = ?`
      )
      .get(this.profileId, authorId) as
      { mark_type: string; note: string | null; updated_at: number } | undefined
    return row
      ? {
          markType: row.mark_type,
          note: row.note,
          updatedAt: row.updated_at,
        }
      : null
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

  importMarkerBackup(input: unknown): MarkerImportResult {
    const backup = normalizeMarkerBackup(input)
    return this.transaction(() => {
      const settings = this.writePreferences(backup.settings)
      for (const artwork of backup.artworks) {
        this.recordArtworkVisit(artwork.id, {
          visitedAt: artwork.visitedAt,
          source: 'marker-import',
        })
      }
      for (const author of backup.authors) {
        this.recordAuthorVisit(author.id, author.visitedAt, 'marker-import')
      }
      const exclusionStatement = this.database.prepare(
        `INSERT INTO page_exclusions(
          profile_id, pattern, label, created_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(profile_id, pattern) DO UPDATE SET
          label = excluded.label,
          created_at = MIN(created_at, excluded.created_at)`
      )
      for (const exclusion of backup.exclusions) {
        exclusionStatement.run(
          this.profileId,
          exclusion.pattern,
          exclusion.label,
          exclusion.addedAt
        )
      }
      return {
        artworks: backup.artworks.length,
        authors: backup.authors.length,
        exclusions: backup.exclusions.length,
        settings: settings || backup.settingCount,
      }
    })
  }

  exportData(): Record<string, unknown> {
    const artworkRows = this.database
      .prepare(
        `SELECT artwork_id, state, first_viewed_at, last_viewed_at,
                last_page, page_count, source
         FROM artwork_reading_state WHERE profile_id = ?`
      )
      .all(this.profileId)
    const authorVisits = this.database
      .prepare(
        `SELECT author_id, first_visited_at, last_visited_at, source
         FROM author_visits WHERE profile_id = ?`
      )
      .all(this.profileId)
    const authorMarks = this.database
      .prepare(
        `SELECT author_id, mark_type, note, created_at, updated_at
         FROM author_marks WHERE profile_id = ?`
      )
      .all(this.profileId)
    const exclusions = this.database
      .prepare(
        `SELECT pattern, label, created_at
         FROM page_exclusions WHERE profile_id = ?`
      )
      .all(this.profileId)
    return {
      schemaVersion: 1,
      exportedAt: Date.now(),
      preferences: this.getPreferences(),
      artworkReadingState: artworkRows,
      authorVisits,
      authorMarks,
      exclusions,
    }
  }

  importData(input: unknown): PixivFunImportResult {
    const backup = normalizePixivFunBackup(input)
    return this.transaction(() => {
      const settings = this.writePreferences(backup.preferences)
      const artworkStatement = this.database.prepare(
        `INSERT INTO artwork_reading_state(
          profile_id, artwork_id, state, first_viewed_at, last_viewed_at,
          last_page, page_count, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(profile_id, artwork_id) DO UPDATE SET
          first_viewed_at = MIN(first_viewed_at, excluded.first_viewed_at),
          last_viewed_at = MAX(last_viewed_at, excluded.last_viewed_at),
          last_page = COALESCE(excluded.last_page, last_page),
          page_count = COALESCE(excluded.page_count, page_count),
          state = excluded.state,
          source = excluded.source`
      )
      for (const artwork of backup.artworks) {
        artworkStatement.run(
          this.profileId,
          artwork.id,
          artwork.state,
          artwork.firstViewedAt,
          artwork.lastViewedAt,
          artwork.lastPage,
          artwork.pageCount,
          artwork.source
        )
      }

      const authorVisitStatement = this.database.prepare(
        `INSERT INTO author_visits(
          profile_id, author_id, first_visited_at, last_visited_at, source
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(profile_id, author_id) DO UPDATE SET
          first_visited_at = MIN(first_visited_at, excluded.first_visited_at),
          last_visited_at = MAX(last_visited_at, excluded.last_visited_at),
          source = excluded.source`
      )
      for (const author of backup.authorVisits) {
        authorVisitStatement.run(
          this.profileId,
          author.id,
          author.firstVisitedAt,
          author.lastVisitedAt,
          author.source
        )
      }

      const authorMarkStatement = this.database.prepare(
        `INSERT INTO author_marks(
          profile_id, author_id, mark_type, note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(profile_id, author_id) DO UPDATE SET
          mark_type = excluded.mark_type,
          note = excluded.note,
          updated_at = MAX(updated_at, excluded.updated_at)`
      )
      for (const mark of backup.authorMarks) {
        authorMarkStatement.run(
          this.profileId,
          mark.id,
          mark.markType,
          mark.note,
          mark.createdAt,
          mark.updatedAt
        )
      }

      const exclusionStatement = this.database.prepare(
        `INSERT INTO page_exclusions(
          profile_id, pattern, label, created_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(profile_id, pattern) DO UPDATE SET
          label = excluded.label,
          created_at = MIN(created_at, excluded.created_at)`
      )
      for (const exclusion of backup.exclusions) {
        exclusionStatement.run(
          this.profileId,
          exclusion.pattern,
          exclusion.label,
          exclusion.createdAt
        )
      }

      return {
        artworks: backup.artworks.length,
        authorVisits: backup.authorVisits.length,
        authorMarks: backup.authorMarks.length,
        exclusions: backup.exclusions.length,
        settings,
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
    exclusions: number
  } {
    const count = (table: string): number => {
      const row = this.database
        .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE profile_id = ?`)
        .get(this.profileId) as { count: number }
      return row.count
    }
    return {
      artworks: count('artwork_reading_state'),
      authors: count('author_visits'),
      exclusions: count('page_exclusions'),
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

function nullableNonNegativeInteger(
  value: unknown,
  path: string
): number | null {
  if (value === null || value === undefined) return null
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 1_000_000
  ) {
    throw new TypeError(`${path} must be a non-negative integer`)
  }
  return value
}

function assertCacheKey(value: string, path: string): void {
  if (!value || value.length > 200) throw new TypeError(`${path} is invalid`)
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
    settings: {},
    settingCount: 0,
    artworks,
    authors,
    exclusions: [],
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
    records.push({
      id,
      visitedAt: validTimestamp(record.visitedAt, `${path}.${key}.visitedAt`),
    })
  }
  return records
}

function normalizeExclusionPattern(input: string): string {
  const url = new URL(input, 'http://localhost')
  const path = url.pathname.replace(/\/+$/, '') || '/'
  if (!path.startsWith('/') || path.length > 500) {
    throw new TypeError('exclusion pattern is invalid')
  }
  return path
}

function normalizePixivFunBackup(input: unknown): {
  preferences: LocalPreferencesPatch
  artworks: Array<{
    id: string
    state: 'viewed' | 'unread'
    firstViewedAt: number
    lastViewedAt: number
    lastPage: number | null
    pageCount: number | null
    source: string
  }>
  authorVisits: Array<{
    id: string
    firstVisitedAt: number
    lastVisitedAt: number
    source: string
  }>
  authorMarks: Array<{
    id: string
    markType: string
    note: string | null
    createdAt: number
    updatedAt: number
  }>
  exclusions: Array<{ pattern: string; label: string; createdAt: number }>
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('PixivFun backup must be an object')
  }
  const backup = input as Record<string, unknown>
  if (backup.schemaVersion !== 1) {
    throw new TypeError('unsupported PixivFun schemaVersion')
  }
  const preferences = normalizeLocalPreferencesPatch(backup.preferences)
  const artworkRows = requiredArray(
    backup.artworkReadingState,
    'artworkReadingState'
  )
  const authorVisitRows = requiredArray(backup.authorVisits, 'authorVisits')
  const authorMarkRows = requiredArray(backup.authorMarks, 'authorMarks')
  const exclusionRows = requiredArray(backup.exclusions, 'exclusions')
  if (
    artworkRows.length +
      authorVisitRows.length +
      authorMarkRows.length +
      exclusionRows.length >
    MAX_IMPORT_RECORDS
  ) {
    throw new RangeError('PixivFun backup contains too many records')
  }

  const artworks = artworkRows.map((row, index) => {
    const record = requiredRecord(row, `artworkReadingState.${index}`)
    if (record.state !== 'viewed' && record.state !== 'unread') {
      throw new TypeError(`artworkReadingState.${index}.state is invalid`)
    }
    const firstViewedAt = validTimestamp(
      record.first_viewed_at,
      `artworkReadingState.${index}.first_viewed_at`
    )
    const lastViewedAt = validTimestamp(
      record.last_viewed_at,
      `artworkReadingState.${index}.last_viewed_at`
    )
    if (lastViewedAt < firstViewedAt) {
      throw new TypeError(
        `artworkReadingState.${index} has an invalid time range`
      )
    }
    return {
      id: requirePixivId(
        record.artwork_id,
        `artworkReadingState.${index}.artwork_id`
      ),
      state: record.state,
      firstViewedAt,
      lastViewedAt,
      lastPage: nullableNonNegativeInteger(
        record.last_page,
        `artworkReadingState.${index}.last_page`
      ),
      pageCount: nullableNonNegativeInteger(
        record.page_count,
        `artworkReadingState.${index}.page_count`
      ),
      source: validSource(record.source, `artworkReadingState.${index}.source`),
    }
  })

  const authorVisits = authorVisitRows.map((row, index) => {
    const record = requiredRecord(row, `authorVisits.${index}`)
    const firstVisitedAt = validTimestamp(
      record.first_visited_at,
      `authorVisits.${index}.first_visited_at`
    )
    const lastVisitedAt = validTimestamp(
      record.last_visited_at,
      `authorVisits.${index}.last_visited_at`
    )
    if (lastVisitedAt < firstVisitedAt) {
      throw new TypeError(`authorVisits.${index} has an invalid time range`)
    }
    return {
      id: requirePixivId(record.author_id, `authorVisits.${index}.author_id`),
      firstVisitedAt,
      lastVisitedAt,
      source: validSource(record.source, `authorVisits.${index}.source`),
    }
  })

  const authorMarks = authorMarkRows.map((row, index) => {
    const record = requiredRecord(row, `authorMarks.${index}`)
    const markType = String(record.mark_type || '')
    if (!/^[a-z][a-z0-9_-]{0,31}$/i.test(markType)) {
      throw new TypeError(`authorMarks.${index}.mark_type is invalid`)
    }
    const note =
      record.note === null
        ? null
        : typeof record.note === 'string' && record.note.length <= 2_000
          ? record.note
          : undefined
    if (note === undefined) {
      throw new TypeError(`authorMarks.${index}.note is invalid`)
    }
    return {
      id: requirePixivId(record.author_id, `authorMarks.${index}.author_id`),
      markType,
      note,
      createdAt: validTimestamp(
        record.created_at,
        `authorMarks.${index}.created_at`
      ),
      updatedAt: validTimestamp(
        record.updated_at,
        `authorMarks.${index}.updated_at`
      ),
    }
  })

  const exclusions = exclusionRows.map((row, index) => {
    const record = requiredRecord(row, `exclusions.${index}`)
    const pattern = normalizeExclusionPattern(String(record.pattern || ''))
    return {
      pattern,
      label:
        typeof record.label === 'string' && record.label.length <= 500
          ? record.label
          : pattern,
      createdAt: validTimestamp(
        record.created_at,
        `exclusions.${index}.created_at`
      ),
    }
  })
  return { preferences, artworks, authorVisits, authorMarks, exclusions }
}

function requiredArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`)
  return value
}

function requiredRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

function validSource(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value || value.length > 64) {
    throw new TypeError(`${path} is invalid`)
  }
  return value
}
