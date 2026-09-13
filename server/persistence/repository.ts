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
import {
  normalizeAuthorCategoryName,
  type AuthorCategory,
} from '../../shared/author-categories.ts'

export const DEFAULT_PROFILE_ID = 'local-default'

export interface MarkerImportResult {
  artworks: number
  authors: number
}

export interface PixivFunImportResult {
  artworks: number
  authorVisits: number
}

export interface FeaturedAuthorPage {
  authors: Record<string, unknown>[]
  total: number
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

const SCHEMA_VERSION = 6
const MAX_IMPORT_RECORDS = 200_000
const MAX_BATCH_IDS = 500
const MAX_FEATURED_AUTHOR_SNAPSHOT_BYTES = 512 * 1024

const AUTHOR_CATEGORIES_SCHEMA = `
  CREATE TABLE author_categories (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    name TEXT NOT NULL COLLATE NOCASE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (profile_id, id),
    UNIQUE (profile_id, name)
  );
  CREATE TABLE author_category_members (
    profile_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    PRIMARY KEY (profile_id, category_id, author_id),
    FOREIGN KEY (profile_id, category_id)
      REFERENCES author_categories(profile_id, id) ON DELETE CASCADE
  );
  CREATE INDEX author_category_members_author_idx
    ON author_category_members(profile_id, author_id);
`

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

  CREATE TABLE author_artwork_exclusions (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    artwork_id TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (profile_id, author_id, artwork_id)
  );

  CREATE INDEX author_artwork_exclusions_author_idx
    ON author_artwork_exclusions(profile_id, author_id);

  CREATE TABLE featured_authors (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (profile_id, author_id)
  );

  CREATE INDEX featured_authors_added_idx
    ON featured_authors(profile_id, added_at DESC);

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
  ${AUTHOR_CATEGORIES_SCHEMA}
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
    if (row.version >= 1 && row.version < 4) {
      this.transaction(() => {
        this.database.exec(`
          CREATE TABLE IF NOT EXISTS author_artwork_exclusions (
            profile_id TEXT NOT NULL
              REFERENCES profiles(id) ON DELETE CASCADE,
            author_id TEXT NOT NULL,
            artwork_id TEXT NOT NULL,
            added_at INTEGER NOT NULL,
            PRIMARY KEY (profile_id, author_id, artwork_id)
          );
          CREATE INDEX IF NOT EXISTS author_artwork_exclusions_author_idx
            ON author_artwork_exclusions(profile_id, author_id);
        `)
        this.database
          .prepare(
            'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)'
          )
          .run(4, Date.now())
      })
    }
    if (row.version >= 1 && row.version < 5) {
      this.transaction(() => {
        this.database.exec(`
          CREATE TABLE IF NOT EXISTS featured_authors (
            profile_id TEXT NOT NULL
              REFERENCES profiles(id) ON DELETE CASCADE,
            author_id TEXT NOT NULL,
            snapshot_json TEXT NOT NULL,
            added_at INTEGER NOT NULL,
            PRIMARY KEY (profile_id, author_id)
          );
          CREATE INDEX IF NOT EXISTS featured_authors_added_idx
            ON featured_authors(profile_id, added_at DESC);
        `)
        this.database
          .prepare(
            'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)'
          )
          .run(5, Date.now())
      })
    }

    if (row.version >= 1 && row.version < 6) {
      this.transaction(() => {
        this.database.exec(AUTHOR_CATEGORIES_SCHEMA)
        this.database
          .prepare(
            'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)'
          )
          .run(6, Date.now())
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

  getAuthorCategories(): AuthorCategory[] {
    const categories = this.database
      .prepare(
        `SELECT id, name FROM author_categories WHERE profile_id = ?
       ORDER BY created_at, rowid`
      )
      .all(this.profileId) as Array<{ id: string; name: string }>
    const members = this.database
      .prepare(
        `SELECT category_id, author_id FROM author_category_members
       WHERE profile_id = ? ORDER BY author_id`
      )
      .all(this.profileId) as Array<{ category_id: string; author_id: string }>
    const grouped = new Map<string, string[]>()
    for (const member of members) {
      const ids = grouped.get(member.category_id) ?? []
      ids.push(member.author_id)
      grouped.set(member.category_id, ids)
    }
    return categories.map((category) => ({
      ...category,
      authorIds: grouped.get(category.id) ?? [],
    }))
  }

  private requireAuthorCategory(id: unknown): string {
    if (
      typeof id !== 'string' ||
      !this.database
        .prepare(
          'SELECT 1 FROM author_categories WHERE profile_id = ? AND id = ?'
        )
        .get(this.profileId, id)
    ) {
      throw new RangeError('分类不存在，请刷新后重试')
    }
    return id
  }

  private categoryName(value: unknown, exceptId = ''): string {
    const name = normalizeAuthorCategoryName(value)
    if (
      this.database
        .prepare(
          'SELECT 1 FROM author_categories WHERE profile_id = ? AND name = ? AND id != ?'
        )
        .get(this.profileId, name, exceptId)
    ) {
      throw new RangeError('已存在同名分类')
    }
    return name
  }

  createAuthorCategory(nameValue: unknown): string {
    const name = this.categoryName(nameValue)
    const id = randomUUID()
    this.database
      .prepare(
        'INSERT INTO author_categories(profile_id, id, name, created_at) VALUES (?, ?, ?, ?)'
      )
      .run(this.profileId, id, name, Date.now())
    return id
  }

  renameAuthorCategory(idValue: unknown, nameValue: unknown): void {
    const id = this.requireAuthorCategory(idValue)
    const name = this.categoryName(nameValue, id)
    this.database
      .prepare(
        'UPDATE author_categories SET name = ? WHERE profile_id = ? AND id = ?'
      )
      .run(name, this.profileId, id)
  }

  deleteAuthorCategory(idValue: unknown): void {
    const id = this.requireAuthorCategory(idValue)
    this.database
      .prepare('DELETE FROM author_categories WHERE profile_id = ? AND id = ?')
      .run(this.profileId, id)
  }

  setAuthorCategories(authorIdValue: unknown, categoryIdsValue: unknown): void {
    const authorId = normalizePixivId(authorIdValue)
    if (!authorId) throw new TypeError('作者 ID 无效')
    if (!Array.isArray(categoryIdsValue) || categoryIdsValue.length > 500) {
      throw new TypeError('分类列表无效')
    }
    this.transaction(() => {
      // Validate the entire selection before replacing any existing memberships.
      const ids = [
        ...new Set(
          categoryIdsValue.map((id) => this.requireAuthorCategory(id))
        ),
      ]
      this.database
        .prepare(
          'DELETE FROM author_category_members WHERE profile_id = ? AND author_id = ?'
        )
        .run(this.profileId, authorId)
      const insert = this.database.prepare(
        'INSERT INTO author_category_members(profile_id, category_id, author_id) VALUES (?, ?, ?)'
      )
      for (const id of ids) insert.run(this.profileId, id, authorId)
    })
  }

  getFeaturedAuthorIds(ids: unknown[]): string[] {
    const normalized = Array.from(
      new Set(ids.map((id) => requirePixivId(id, 'authorId')))
    )
    const featured = new Set<string>()
    for (let index = 0; index < normalized.length; index += MAX_BATCH_IDS) {
      const batch = normalized.slice(index, index + MAX_BATCH_IDS)
      if (!batch.length) continue
      const placeholders = batch.map(() => '?').join(', ')
      const rows = this.database
        .prepare(
          `SELECT author_id
           FROM featured_authors
           WHERE profile_id = ? AND author_id IN (${placeholders})`
        )
        .all(this.profileId, ...batch) as Array<{ author_id: string }>
      for (const row of rows) featured.add(row.author_id)
    }
    return normalized.filter((id) => featured.has(id))
  }

  getFeaturedAuthors(offsetValue = 0, limitValue = 24): FeaturedAuthorPage {
    const offset = requireBoundedInteger(offsetValue, 'offset', 0, 200_000)
    const limit = requireBoundedInteger(limitValue, 'limit', 1, 100)
    const total = (
      this.database
        .prepare(
          `SELECT COUNT(*) AS count
           FROM featured_authors
           WHERE profile_id = ?`
        )
        .get(this.profileId) as { count: number }
    ).count
    const rows = this.database
      .prepare(
        `SELECT snapshot_json
         FROM featured_authors
         WHERE profile_id = ?
         ORDER BY added_at DESC, LENGTH(author_id), author_id
         LIMIT ? OFFSET ?`
      )
      .all(this.profileId, limit, offset) as Array<{ snapshot_json: string }>
    return {
      authors: rows.map((row) => JSON.parse(row.snapshot_json)),
      total,
    }
  }

  saveFeaturedAuthor(authorIdValue: unknown, snapshotValue: unknown): void {
    const authorId = requirePixivId(authorIdValue, 'authorId')
    const snapshot = normalizeFeaturedAuthorSnapshot(snapshotValue, authorId)
    const snapshotJson = JSON.stringify(snapshot)
    if (
      Buffer.byteLength(snapshotJson, 'utf8') >
      MAX_FEATURED_AUTHOR_SNAPSHOT_BYTES
    ) {
      throw new RangeError('featured author snapshot is too large')
    }
    this.database
      .prepare(
        `INSERT INTO featured_authors(
          profile_id, author_id, snapshot_json, added_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(profile_id, author_id) DO UPDATE SET
          snapshot_json = excluded.snapshot_json`
      )
      .run(this.profileId, authorId, snapshotJson, Date.now())
  }

  removeFeaturedAuthor(authorIdValue: unknown): void {
    const authorId = requirePixivId(authorIdValue, 'authorId')
    this.database
      .prepare(
        `DELETE FROM featured_authors
         WHERE profile_id = ? AND author_id = ?`
      )
      .run(this.profileId, authorId)
  }

  getHiddenAuthorArtworkIds(authorIdValue: unknown): string[] {
    const authorId = requirePixivId(authorIdValue, 'authorId')
    const rows = this.database
      .prepare(
        `SELECT artwork_id
         FROM author_artwork_exclusions
         WHERE profile_id = ? AND author_id = ?
         ORDER BY LENGTH(artwork_id), artwork_id`
      )
      .all(this.profileId, authorId) as Array<{ artwork_id: string }>
    return rows.map((row) => row.artwork_id)
  }

  hideAuthorArtworks(authorIdValue: unknown, artworkIds: unknown[]): string[] {
    const authorId = requirePixivId(authorIdValue, 'authorId')
    const normalized = normalizePixivIdBatch(artworkIds, 'artworkIds')
    const insert = this.database.prepare(
      `INSERT OR IGNORE INTO author_artwork_exclusions(
        profile_id, author_id, artwork_id, added_at
      ) VALUES (?, ?, ?, ?)`
    )
    this.transaction(() => {
      const now = Date.now()
      for (const artworkId of normalized) {
        insert.run(this.profileId, authorId, artworkId, now)
      }
    })
    return normalized
  }

  restoreAuthorArtworks(
    authorIdValue: unknown,
    artworkIds: unknown[]
  ): string[] {
    const authorId = requirePixivId(authorIdValue, 'authorId')
    const normalized = normalizePixivIdBatch(artworkIds, 'artworkIds')
    const remove = this.database.prepare(
      `DELETE FROM author_artwork_exclusions
       WHERE profile_id = ? AND author_id = ? AND artwork_id = ?`
    )
    this.transaction(() => {
      for (const artworkId of normalized) {
        remove.run(this.profileId, authorId, artworkId)
      }
    })
    return normalized
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

function requireBoundedInteger(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number
): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new RangeError(
      `${path} must be an integer from ${minimum} to ${maximum}`
    )
  }
  return number
}

function normalizeFeaturedAuthorSnapshot(
  value: unknown,
  expectedAuthorId: string
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('featured author snapshot must be an object')
  }
  const author = value as Record<string, unknown>
  const authorId = requirePixivId(author.userId, 'author.userId')
  if (authorId !== expectedAuthorId) {
    throw new TypeError('featured author ID does not match the route')
  }
  const requiredString = (key: string, maximum: number): string => {
    const entry = author[key]
    if (typeof entry !== 'string') {
      throw new TypeError(`author.${key} must be a string`)
    }
    return entry.slice(0, maximum)
  }
  const illusts = Array.isArray(author.illusts)
    ? author.illusts.slice(0, 4)
    : []
  return {
    userId: authorId,
    userName: requiredString('userName', 200),
    profileImageUrl: requiredString('profileImageUrl', 4096),
    userComment: requiredString('userComment', 5000),
    following: Boolean(author.following),
    followed: Boolean(author.followed),
    isBlocking: Boolean(author.isBlocking),
    isMypixiv: Boolean(author.isMypixiv),
    illusts,
    novels: [],
    acceptRequest: Boolean(author.acceptRequest),
  }
}

function normalizePixivIdBatch(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_BATCH_IDS) {
    throw new TypeError(
      `${path} must be an array with at most ${MAX_BATCH_IDS} entries`
    )
  }
  return Array.from(
    new Set(
      value.map((item, index) => requirePixivId(item, `${path}.${index}`))
    )
  )
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
