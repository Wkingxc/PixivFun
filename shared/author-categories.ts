export interface AuthorCategory {
  id: string
  name: string
  authorIds: string[]
}

export function normalizeAuthorCategoryName(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('请输入分类名称')
  const name = value.trim()
  if (!name || name.length > 30) {
    throw new RangeError('分类名称须为 1–30 个字符')
  }
  if (/[\u0000-\u001f\u007f]/u.test(name)) {
    throw new TypeError('分类名称不能包含控制字符')
  }
  return name
}
