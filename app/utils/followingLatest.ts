export interface FollowingUpdateGroups<T> {
  featured: T[]
  regular: T[]
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
