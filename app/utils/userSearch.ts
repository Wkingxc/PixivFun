export interface UserSearchWork {
  id: string
  title: string
  url: string
  xRestrict: number
}

export interface UserSearchUser {
  userId: string
  userName: string
  profileImageUrl: string
  comment: string
  isFollowed: boolean
  works: UserSearchWork[]
}

export interface UserSearchResult {
  users: UserSearchUser[]
  total: number
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function pickImage(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['main', 'url', 'medium']) {
      if (typeof record[key] === 'string') return record[key]
    }
  }
  return ''
}

function normalizeWork(raw: unknown): UserSearchWork | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const id = asString(record.id ?? record.illust_id)
  const url = pickImage(record.url ?? record.img_src ?? record.imgSrc)
  if (!id || !url) return null
  return {
    id,
    title: asString(record.title ?? record.alt),
    url,
    xRestrict: Number(record.xRestrict ?? record.x_restrict ?? 0) || 0,
  }
}

/**
 * Normalize the user-search payload. The endpoint is undocumented and only
 * reachable with an authenticated session, so both snake_case (touch) and
 * camelCase (desktop) field styles are accepted and unknown shapes degrade
 * to an empty result instead of throwing.
 */
export function normalizeUserSearchResult(raw: unknown): UserSearchResult {
  const body = raw as Record<string, unknown> | null
  const users = Array.isArray(body?.users) ? body.users : []
  const normalized: UserSearchUser[] = []
  for (const entry of users) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const userId = asString(
      record.user_id ?? record.userId ?? record.id ?? record.uid
    )
    if (!userId) continue
    const works: UserSearchWork[] = []
    for (const key of ['illusts', 'novels', 'works']) {
      const list = record[key]
      if (!Array.isArray(list)) continue
      for (const workRaw of list) {
        const work = normalizeWork(workRaw)
        if (work) works.push(work)
      }
    }
    normalized.push({
      userId,
      userName: asString(record.user_name ?? record.userName ?? record.name),
      profileImageUrl: pickImage(
        record.profile_img ??
          record.profileImg ??
          record.profileImageUrl ??
          record.image
      ),
      comment: asString(
        record.user_comment ?? record.userComment ?? record.comment
      ),
      isFollowed: Boolean(record.followed ?? record.isFollowed),
      works: works.slice(0, 3),
    })
  }
  const totalRaw = body?.total ?? body?.totalUsers ?? body?.total_users
  const total =
    typeof totalRaw === 'number' && Number.isFinite(totalRaw)
      ? totalRaw
      : normalized.length
  return { users: normalized, total }
}
