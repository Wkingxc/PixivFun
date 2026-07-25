import { normalizePixivId } from './pixiv-resource.ts'

const MAX_RECORDS = 200_000

export interface PixivFunDataDocument {
  exportedAt: number
  data: {
    visitedArtworkIds: string[]
    visitedAuthorIds: string[]
    [key: string]: unknown
  }
}

export function parsePixivFunData(input: unknown): PixivFunDataDocument {
  const document = requiredRecord(input, 'PixivFun data')
  const exportedAt = validTimestamp(document.exportedAt, 'exportedAt')
  const data = requiredRecord(document.data, 'data')
  const visitedArtworkIds = pixivIds(
    data.visitedArtworkIds,
    'data.visitedArtworkIds'
  )
  const visitedAuthorIds = pixivIds(
    data.visitedAuthorIds,
    'data.visitedAuthorIds'
  )
  if (visitedArtworkIds.length + visitedAuthorIds.length > MAX_RECORDS) {
    throw new RangeError('PixivFun data contains too many records')
  }
  return {
    exportedAt,
    data: {
      ...data,
      visitedArtworkIds,
      visitedAuthorIds,
    },
  }
}

export function mergePixivFunData(
  localInput: unknown,
  remoteInput: unknown,
  exportedAt = Date.now()
): PixivFunDataDocument {
  const local = parsePixivFunData(localInput)
  const remote = parsePixivFunData(remoteInput)
  return parsePixivFunData({
    exportedAt: validTimestamp(exportedAt, 'exportedAt'),
    data: {
      ...remote.data,
      visitedArtworkIds: Array.from(
        new Set([
          ...remote.data.visitedArtworkIds,
          ...local.data.visitedArtworkIds,
        ])
      ).sort(comparePixivIds),
      visitedAuthorIds: Array.from(
        new Set([
          ...remote.data.visitedAuthorIds,
          ...local.data.visitedAuthorIds,
        ])
      ).sort(comparePixivIds),
    },
  })
}

function pixivIds(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`)
  return Array.from(
    new Set(
      value.map((item, index) => {
        const id = normalizePixivId(item)
        if (!id)
          throw new TypeError(`${path}.${index} must be a decimal Pixiv ID`)
        return id
      })
    )
  )
}

function requiredRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

function validTimestamp(value: unknown, path: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    throw new TypeError(`${path} must be a valid timestamp`)
  }
  return Math.trunc(value)
}

function comparePixivIds(left: string, right: string): number {
  return (
    left.length - right.length ||
    left.localeCompare(right, 'en', { numeric: false })
  )
}
