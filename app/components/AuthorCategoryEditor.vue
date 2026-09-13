<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="category-editor"
      :aria-labelledby="titleId"
      @cancel.prevent="close"
      @click.self="close"
    >
      <section>
        <header>
          <div>
            <h2 :id="titleId">{{ authorId ? '作者分类' : '管理分类' }}</h2>
            <p>
              {{
                authorId
                  ? `${authorName} · 可加入多个分类，选择后自动保存`
                  : '创建分类后，可在关注列表或作者主页添加作者。'
              }}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭分类设置"
            :disabled="working"
            @click="close"
          >
            <IconX aria-hidden="true" />
          </button>
        </header>

        <p v-if="loading" class="muted" role="status">正在加载分类…</p>
        <template v-else-if="store.initialized">
          <form class="category-input" @submit.prevent="createCategory">
            <input
              v-model="newName"
              aria-label="新分类名称"
              placeholder="新分类名称，如：风景、漫画"
              maxlength="30"
              :disabled="working"
            />
            <button type="submit" :disabled="working || !newName.trim()">
              新建{{ authorId ? '并加入' : '' }}
            </button>
          </form>

          <p v-if="!store.categories.length" class="muted">
            还没有分类，先创建一个吧。
          </p>
          <div class="category-list">
            <div
              v-for="category in store.categories"
              :key="category.id"
              class="category-row"
            >
              <form
                v-if="renaming === category.id"
                class="category-input"
                @submit.prevent="renameCategory(category.id)"
              >
                <input
                  v-model="renameName"
                  aria-label="修改分类名称"
                  maxlength="30"
                  :disabled="working"
                />
                <button type="submit" :disabled="working || !renameName.trim()">
                  保存
                </button>
                <button
                  type="button"
                  :disabled="working"
                  @click="renaming = ''"
                >
                  取消
                </button>
              </form>
              <template v-else>
                <label v-if="authorId" class="category-choice">
                  <input
                    type="checkbox"
                    :checked="category.authorIds.includes(authorId)"
                    :disabled="working"
                    @change="toggleCategory(category.id, $event)"
                  />
                  <span :title="category.name">{{ category.name }}</span>
                  <small>{{ category.authorIds.length }} 位作者</small>
                </label>
                <div v-else class="category-choice">
                  <span :title="category.name">{{ category.name }}</span>
                  <small>{{ category.authorIds.length }} 位作者</small>
                </div>
                <button
                  type="button"
                  :aria-label="`重命名分类 ${category.name}`"
                  :disabled="working"
                  @click="startRename(category)"
                >
                  <IconPencil aria-hidden="true" />
                </button>
                <button
                  type="button"
                  :aria-label="`删除分类 ${category.name}`"
                  :disabled="working"
                  @click="deleting = category.id"
                >
                  <IconTrash aria-hidden="true" />
                </button>
              </template>
              <div v-if="deleting === category.id" class="delete-confirm">
                <p>
                  删除“{{
                    category.name
                  }}”及其作者分类关系？关注和精选状态会保留。
                </p>
                <button
                  type="button"
                  :disabled="working"
                  @click="deleteCategory(category.id)"
                >
                  确认删除
                </button>
                <button
                  type="button"
                  :disabled="working"
                  @click="deleting = ''"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </template>

        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button
          v-if="!loading && !store.initialized"
          type="button"
          @click="load"
        >
          重新加载
        </button>
        <footer>
          <span class="muted">{{
            working ? '正在保存…' : '分类用于筛选关注更新，仅在本地保存。'
          }}</span>
          <button type="button" class="done" :disabled="working" @click="close">
            完成
          </button>
        </footer>
      </section>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { IconX, IconPencil, IconTrash } from '@tabler/icons-vue'
import type { AuthorCategory } from '~~/shared/author-categories'
import { useAuthorCategoriesStore } from '~/stores/author-categories'
import { useBodyScrollLock } from '~/composables/useBodyScrollLock'

const props = defineProps<{ authorId?: string; authorName?: string }>()
const emit = defineEmits<{ close: [] }>()
const store = useAuthorCategoriesStore()
const dialog = ref<HTMLDialogElement>()
const titleId = useId()
const loading = ref(true)
const saving = ref(false)
const working = computed(() => saving.value || store.busy)
const newName = ref('')
const renaming = ref('')
const renameName = ref('')
const deleting = ref('')
const error = ref('')
useBodyScrollLock(ref(true))

onMounted(() => {
  dialog.value?.showModal()
  void load()
})

function close() {
  if (working.value) return
  dialog.value?.close()
  emit('close')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    await store.init()
  } catch {
    error.value = '加载分类失败，请重试'
  } finally {
    loading.value = false
  }
}

async function save(operation: () => Promise<unknown>) {
  if (working.value) return
  saving.value = true
  error.value = ''
  try {
    await operation()
  } catch (cause) {
    const response = cause as { data?: { message?: string } }
    error.value =
      response.data?.message ||
      (cause instanceof TypeError || cause instanceof RangeError
        ? cause.message
        : '保存失败，请重试')
  } finally {
    saving.value = false
  }
}

function createCategory() {
  void save(async () => {
    const created = await store.create(newName.value)
    newName.value = ''
    if (props.authorId && created.id) {
      await store.assign(props.authorId, [
        ...store.forAuthor(props.authorId).map((category) => category.id),
        created.id,
      ])
    }
  })
}

function toggleCategory(id: string, event: Event) {
  // Keep the checkbox consistent with persisted state if saving fails.
  const input = event.target as HTMLInputElement
  input.checked =
    !!props.authorId &&
    store.forAuthor(props.authorId).some((category) => category.id === id)
  void save(async () => {
    if (!props.authorId) return
    const ids = store.forAuthor(props.authorId).map((category) => category.id)
    await store.assign(
      props.authorId,
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]
    )
  })
}

function startRename(category: AuthorCategory) {
  renaming.value = category.id
  renameName.value = category.name
  deleting.value = ''
}

function renameCategory(id: string) {
  void save(async () => {
    await store.rename(id, renameName.value)
    renaming.value = ''
  })
}

function deleteCategory(id: string) {
  void save(async () => {
    await store.remove(id)
    deleting.value = ''
  })
}
</script>

<style scoped lang="scss">
.category-editor {
  width: min(540px, calc(100vw - 32px));
  max-height: 85dvh;
  padding: 0;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 18px;
  box-shadow: 0 22px 70px rgb(0 0 0 / 28%);

  &::backdrop {
    background: rgb(18 13 17 / 52%);
    backdrop-filter: blur(5px);
  }
  section {
    padding: 24px;
  }
  header,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  header {
    align-items: flex-start;
    margin-bottom: 20px;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  p {
    margin: 8px 0;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  header p,
  .muted,
  small {
    color: var(--pf-muted);
    font-size: 0.75rem;
  }
  button,
  input {
    font: inherit;
    font-size: 0.8rem;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    padding: 8px 10px;
    border: 1px solid var(--pf-line);
    border-radius: 10px;
    color: var(--pf-text);
    background: var(--pf-bg);
    cursor: pointer;
  }
  button:hover {
    color: var(--pf-pink);
    border-color: var(--pf-pink);
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button svg {
    width: 16px;
    height: 16px;
  }
  input:not([type='checkbox']) {
    min-width: 0;
    width: 100%;
    padding: 10px;
    border: 1px solid var(--pf-line);
    border-radius: 10px;
    color: var(--pf-text);
    background: var(--pf-bg);
  }
  input[type='checkbox'] {
    accent-color: var(--pf-pink);
    width: 16px;
    height: 16px;
    flex: none;
  }
  .category-input {
    display: flex;
    flex: 1;
    gap: 8px;
  }
  .category-list {
    display: grid;
    gap: 8px;
    margin: 16px 0;
  }
  .category-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
    border-bottom: 1px solid var(--pf-line);
  }
  .category-choice {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .category-choice span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    white-space: nowrap;
  }
  .delete-confirm {
    width: 100%;
    font-size: 0.8rem;
  }
  .delete-confirm button {
    margin-right: 8px;
  }
  .error {
    color: var(--pf-pink);
    font-size: 0.8rem;
  }
  footer {
    margin-top: 20px;
  }
  .done {
    color: white;
    background: var(--pf-pink);
    border-color: var(--pf-pink);
  }
}
</style>
