import { useLocalPersistenceRepository } from '~~/server/persistence'

export default defineEventHandler(() => ({
  categories: useLocalPersistenceRepository().getAuthorCategories(),
}))
