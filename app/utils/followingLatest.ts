export interface FollowingUpdateGroups<T> {
  featured: T[]
  regular: T[]
}

export interface FollowingUpdateDateGroup<T> {
  dateKey: string
  dateLabel: string
  weekdayLabel: string
  isToday: boolean
  works: T[]
}

const FOLLOWING_WEEKDAYS = [
  '周日',
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六',
] as const

function getDateKey(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const [, year, month, day] = match
  const parsed = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day))
  )
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null
  }
  return `${year}-${month}-${day}`
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function groupFollowingUpdatesByDate<T extends { createDate: string }>(
  works: readonly T[],
  today = new Date()
): FollowingUpdateDateGroup<T>[] {
  const grouped = new Map<string, T[]>()

  for (const work of works) {
    const dateKey = getDateKey(work.createDate) ?? ''
    const group = grouped.get(dateKey)
    if (group) group.push(work)
    else grouped.set(dateKey, [work])
  }

  const todayKey = getLocalDateKey(today)
  return [...grouped].map(([dateKey, dateWorks]) => {
    if (!dateKey) {
      return {
        dateKey: '',
        dateLabel: '日期未知',
        weekdayLabel: '',
        isToday: false,
        works: dateWorks,
      }
    }
    const [year, month, day] = dateKey.split('-').map(Number)
    const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay()
    return {
      dateKey,
      dateLabel: `${month}月${day}日`,
      weekdayLabel: FOLLOWING_WEEKDAYS[weekday]!,
      isToday: dateKey === todayKey,
      works: dateWorks,
    }
  })
}

export function partitionFollowingUpdates<
  T extends { userId: string | number },
>(
  works: readonly T[],
  featuredAuthorIds: ReadonlySet<string>
): FollowingUpdateGroups<T> {
  const groups: FollowingUpdateGroups<T> = {
    featured: [],
    regular: [],
  }

  for (const work of works) {
    const group = featuredAuthorIds.has(String(work.userId))
      ? groups.featured
      : groups.regular
    group.push(work)
  }

  return groups
}
