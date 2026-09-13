import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  normalizeAuthorCategoryName,
  type AuthorCategory,
} from '../../shared/author-categories.ts'

interface CategoryResponse {
  categories: AuthorCategory[]
  id?: string
}

export const useAuthorCategoriesStore = defineStore('author-categories', () => {
  const categories = ref<AuthorCategory[]>([])
  const initialized = ref(false)
  const busy = ref(false)
  let initialization: Promise<void> | undefined
  let writes: Promise<unknown> = Promise.resolve()

  async function init(): Promise<void> {
    if (initialized.value) return
    if (!initialization) {
      initialization = $fetch<CategoryResponse>('/api/local/author-categories')
        .then((response) => {
          categories.value = response.categories
          initialized.value = true
        })
        .finally(() => {
          initialization = undefined
        })
    }
    return initialization
  }

  function mutate(
    path: string,
    method: 'POST' | 'PATCH' | 'DELETE' | 'PUT',
    body?: object
  ) {
    const operation = writes
      .catch(() => {})
      .then(async () => {
        busy.value = true
        try {
          await init()
          const response = await $fetch<CategoryResponse>(
            `/api/local/author-categories${path}`,
            {
              method,
              body,
            }
          )
          categories.value = response.categories
          return response
        } finally {
          busy.value = false
        }
      })
    writes = operation
    return operation
  }

  function forAuthor(authorId: string): AuthorCategory[] {
    return categories.value.filter((category) =>
      category.authorIds.includes(authorId)
    )
  }

  function create(name: string) {
    return mutate('', 'POST', { name: normalizeAuthorCategoryName(name) })
  }

  function rename(id: string, name: string) {
    return mutate(`/${encodeURIComponent(id)}`, 'PATCH', {
      name: normalizeAuthorCategoryName(name),
    })
  }

  function remove(id: string) {
    return mutate(`/${encodeURIComponent(id)}`, 'DELETE')
  }

  function assign(authorId: string, categoryIds: string[]) {
    return mutate(`/authors/${encodeURIComponent(authorId)}`, 'PUT', {
      categoryIds: [...categoryIds],
    })
  }

  return {
    categories,
    initialized,
    busy,
    init,
    forAuthor,
    create,
    rename,
    remove,
    assign,
  }
})
