<template>
  <Teleport to="body">
    <Transition name="bookmark-dialog">
      <div
        v-if="isOpen"
        class="bookmark-dialog"
        role="presentation"
        @mousedown.self="closeBookmarkEditor"
      >
        <section
          aria-labelledby="bookmark-dialog-title"
          aria-modal="true"
          class="bookmark-dialog__panel"
          role="dialog"
        >
          <header class="bookmark-dialog__header">
            <span class="bookmark-dialog__icon">
              <ITablerBookmark aria-hidden="true" />
            </span>
            <div>
              <h2 id="bookmark-dialog-title">收藏设置</h2>
              <p>{{ targetTitle }}</p>
            </div>
            <button
              aria-label="关闭收藏设置"
              class="bookmark-dialog__close"
              type="button"
              @click="closeBookmarkEditor"
            >
              <ITablerX aria-hidden="true" />
            </button>
          </header>

          <div class="bookmark-dialog__body">
            <div v-if="loading" class="bookmark-dialog__loading">
              <span class="bookmark-dialog__spinner" />
              正在读取收藏标签…
            </div>

            <template v-else>
              <fieldset class="bookmark-dialog__section">
                <legend>可见范围</legend>
                <div class="visibility-options">
                  <button
                    :class="{ active: !privateBookmark }"
                    type="button"
                    @click="privateBookmark = false"
                  >
                    <ITablerWorld aria-hidden="true" />
                    <span>
                      <strong>公开收藏</strong>
                      <small>会显示在你的公开收藏页</small>
                    </span>
                    <ITablerCheck
                      v-if="!privateBookmark"
                      aria-hidden="true"
                      class="visibility-options__check"
                    />
                  </button>
                  <button
                    :class="{ active: privateBookmark }"
                    type="button"
                    @click="privateBookmark = true"
                  >
                    <ITablerLock aria-hidden="true" />
                    <span>
                      <strong>私密收藏</strong>
                      <small>仅自己可见</small>
                    </span>
                    <ITablerCheck
                      v-if="privateBookmark"
                      aria-hidden="true"
                      class="visibility-options__check"
                    />
                  </button>
                </div>
              </fieldset>

              <fieldset class="bookmark-dialog__section">
                <legend>
                  收藏标签
                  <span>{{ selectedTags.length }}/{{ MAX_BOOKMARK_TAGS }}</span>
                </legend>

                <div v-if="selectedTags.length" class="selected-tags">
                  <button
                    v-for="tag in selectedTags"
                    :key="tag"
                    :aria-label="`移除标签 ${tag}`"
                    type="button"
                    @click="removeTag(tag)"
                  >
                    {{ tag }}
                    <ITablerX aria-hidden="true" />
                  </button>
                </div>
                <p v-else class="bookmark-dialog__empty">
                  暂未添加标签，可从下方选择或输入自定义标签。
                </p>

                <form class="tag-input" @submit.prevent="addCustomTags">
                  <input
                    v-model="tagInput"
                    aria-label="输入收藏标签"
                    autocomplete="off"
                    placeholder="输入标签，空格或逗号分隔"
                    type="text"
                  />
                  <button :disabled="!tagInput.trim()" type="submit">
                    <ITablerPlus aria-hidden="true" />
                    添加
                  </button>
                </form>

                <div v-if="userBookmarkTags.length" class="suggested-tags">
                  <p>
                    我的收藏标签
                    <small>已设置与常用标签优先</small>
                  </p>
                  <div>
                    <button
                      v-for="tag in userBookmarkTags"
                      :key="tag.name"
                      :class="{ active: selectedTags.includes(tag.name) }"
                      type="button"
                      @click="toggleTag(tag.name)"
                    >
                      {{ tag.name }}
                      <small v-if="tag.count">{{ tag.count }}</small>
                    </button>
                  </div>
                </div>

                <div
                  v-if="artworkRecommendedTags.length"
                  class="suggested-tags suggested-tags--recommend"
                >
                  <p>
                    作品推荐标签
                    <small>来自当前作品</small>
                  </p>
                  <div>
                    <button
                      v-for="tag in artworkRecommendedTags"
                      :key="tag.name"
                      :class="{ active: selectedTags.includes(tag.name) }"
                      type="button"
                      @click="toggleTag(tag.name)"
                    >
                      {{ tag.name }}
                    </button>
                  </div>
                </div>

                <p v-if="settingsWarning" class="bookmark-dialog__warning">
                  {{ settingsWarning }}
                </p>
              </fieldset>
            </template>
          </div>

          <footer class="bookmark-dialog__footer">
            <button
              v-if="target?.bookmarkData"
              class="bookmark-dialog__remove"
              :disabled="submitting || loading"
              type="button"
              @click="removeCurrentBookmark"
            >
              <ITablerTrash aria-hidden="true" />
              取消收藏
            </button>
            <span v-else />
            <div>
              <button
                class="bookmark-dialog__cancel"
                :disabled="submitting"
                type="button"
                @click="closeBookmarkEditor"
              >
                取消
              </button>
              <button
                class="bookmark-dialog__save"
                :disabled="submitting || loading"
                type="button"
                @click="saveBookmark"
              >
                <span v-if="submitting" class="bookmark-dialog__spinner" />
                <ITablerBookmark v-else aria-hidden="true" />
                {{ target?.bookmarkData ? '保存设置' : '添加收藏' }}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import {
  IconBookmark as ITablerBookmark,
  IconCheck as ITablerCheck,
  IconLock as ITablerLock,
  IconPlus as ITablerPlus,
  IconTrash as ITablerTrash,
  IconWorld as ITablerWorld,
  IconX as ITablerX,
} from '@tabler/icons-vue'
import { useArtworkStore } from '~/stores/artwork'
import { useUserStore } from '~/stores/session'
import {
  getArtworkRecommendedBookmarkTags,
  prioritizeBookmarkTags,
  splitBookmarkTagInput,
  type ArtworkBookmarkSettings,
  type BookmarkTagItem,
} from '~/utils/bookmarkTags'

const MAX_BOOKMARK_TAGS = 10
const artworkStore = useArtworkStore()
const userStore = useUserStore()
const toast = useToast()
const { closeBookmarkEditor, isOpen, markBookmarkChanged, target } =
  useBookmarkEditor()

useBodyScrollLock(isOpen)
onKeyStroke('Escape', () => {
  if (isOpen.value && !submitting.value) closeBookmarkEditor()
})

const loading = ref(false)
const submitting = ref(false)
const privateBookmark = ref(false)
const selectedTags = ref<string[]>([])
const tagInput = ref('')
const availableTags = ref<BookmarkTagItem[]>([])
const initialSettings = ref<ArtworkBookmarkSettings>({
  tags: [],
  private: false,
})
const settingsWarning = ref('')
let loadRequestId = 0

const artworkId = computed(
  () => target.value?.illustId || target.value?.id || ''
)
const targetTitle = computed(
  () =>
    target.value?.illustTitle ||
    target.value?.title ||
    `作品 ${artworkId.value}`
)

function getArtworkTags(): string[] {
  const tags = target.value?.tags
  if (Array.isArray(tags)) return tags
  return tags?.tags?.map((item) => item.tag) ?? []
}

const userBookmarkTags = computed<BookmarkTagItem[]>(() =>
  prioritizeBookmarkTags(availableTags.value, selectedTags.value).slice(0, 40)
)
const artworkRecommendedTags = computed<BookmarkTagItem[]>(() =>
  getArtworkRecommendedBookmarkTags(
    getArtworkTags(),
    userBookmarkTags.value
  ).slice(0, 24)
)

watch(
  [isOpen, target],
  ([open, currentTarget]) => {
    if (!open || !currentTarget) return
    void loadBookmarkSettings(currentTarget.bookmarkData?.private ?? false)
  },
  { immediate: true }
)

async function loadBookmarkSettings(fallbackPrivate: boolean) {
  const requestId = ++loadRequestId
  const fallbackTags = target.value?.bookmarkData?.tags ?? []
  loading.value = true
  settingsWarning.value = ''
  tagInput.value = ''
  privateBookmark.value = fallbackPrivate
  selectedTags.value = [...fallbackTags]
  availableTags.value = []
  initialSettings.value = { tags: [...fallbackTags], private: fallbackPrivate }

  if (!userStore.isLoggedIn || !userStore.userId) {
    toast.warning('登录后才能管理收藏标签')
    closeBookmarkEditor()
    loading.value = false
    return
  }

  const tagRequest = artworkStore
    .fetchBookmarkTags(userStore.userId)
    .then((groups) => {
      if (requestId !== loadRequestId) return
      const counts = new Map<string, number>()
      for (const tag of [...groups.public, ...groups.private]) {
        counts.set(tag.name, (counts.get(tag.name) ?? 0) + tag.count)
      }
      availableTags.value = [...counts].map(([name, count]) => ({
        name,
        count,
      }))
    })
    .catch(() => {
      if (requestId === loadRequestId) {
        settingsWarning.value = '常用标签读取失败，仍可输入自定义标签。'
      }
    })

  if (target.value?.bookmarkData) {
    try {
      const settings = await artworkStore.fetchArtworkBookmarkSettings(
        artworkId.value,
        fallbackPrivate,
        fallbackTags
      )
      if (requestId !== loadRequestId) return
      initialSettings.value = settings
      privateBookmark.value = settings.private
      selectedTags.value = [...settings.tags]
    } catch {
      if (requestId === loadRequestId) {
        settingsWarning.value =
          '现有标签读取失败；本次可新增标签和修改可见范围，不会删除原标签。'
      }
    }
  }

  await tagRequest
  if (requestId === loadRequestId) loading.value = false
}

function removeTag(tag: string) {
  selectedTags.value = selectedTags.value.filter((item) => item !== tag)
}

function addTags(tags: string[]) {
  const next = [...new Set([...selectedTags.value, ...tags])]
  if (next.length > MAX_BOOKMARK_TAGS) {
    toast.warning(`每个作品最多设置 ${MAX_BOOKMARK_TAGS} 个收藏标签`)
  }
  selectedTags.value = next.slice(0, MAX_BOOKMARK_TAGS)
}

function addCustomTags() {
  addTags(splitBookmarkTagInput(tagInput.value))
  tagInput.value = ''
}

function toggleTag(tag: string) {
  if (selectedTags.value.includes(tag)) {
    removeTag(tag)
  } else {
    addTags([tag])
  }
}

function resolveBookmarkId(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const result = data as Record<string, unknown>
  const id =
    result.last_bookmark_id ??
    result.bookmark_id ??
    result.bookmarkId ??
    result.id
  return typeof id === 'string' || typeof id === 'number' ? String(id) : ''
}

async function saveBookmark() {
  const currentTarget = target.value
  if (!currentTarget || !artworkId.value || submitting.value) return
  submitting.value = true

  const nextSettings: ArtworkBookmarkSettings = {
    tags: [...selectedTags.value],
    private: privateBookmark.value,
  }

  try {
    if (currentTarget.bookmarkData) {
      await artworkStore.updateBookmark(
        currentTarget.bookmarkData.id,
        initialSettings.value,
        nextSettings
      )
      currentTarget.bookmarkData.private = nextSettings.private
      currentTarget.bookmarkData.tags = [...nextSettings.tags]
    } else {
      const data = await artworkStore.addBookmark(artworkId.value, {
        tags: nextSettings.tags,
        private: nextSettings.private,
      })
      const bookmarkId = resolveBookmarkId(data)
      if (!bookmarkId) throw new Error('Pixiv 未返回收藏编号')
      currentTarget.bookmarkData = {
        id: bookmarkId as `${number}`,
        private: nextSettings.private,
        tags: [...nextSettings.tags],
      }
      if ('bookmarkCount' in currentTarget) currentTarget.bookmarkCount += 1
    }
    markBookmarkChanged()
    toast.success('收藏设置已保存')
    closeBookmarkEditor()
  } catch (error) {
    console.warn('bookmark settings save failed', error)
    toast.error('收藏设置保存失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

async function removeCurrentBookmark() {
  const currentTarget = target.value
  if (!currentTarget?.bookmarkData || submitting.value) return
  submitting.value = true
  try {
    await artworkStore.removeBookmark(currentTarget.bookmarkData.id)
    currentTarget.bookmarkData = null
    if ('bookmarkCount' in currentTarget) {
      currentTarget.bookmarkCount = Math.max(0, currentTarget.bookmarkCount - 1)
    }
    markBookmarkChanged()
    toast.success('已取消收藏')
    closeBookmarkEditor()
  } catch (error) {
    console.warn('bookmark remove failed', error)
    toast.error('取消收藏失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.bookmark-dialog {
  position: fixed;
  z-index: 10020;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(35 19 30 / 48%);
  backdrop-filter: blur(8px);
}

.bookmark-dialog__panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(620px, 100%);
  max-height: min(780px, calc(100vh - 48px));
  overflow: hidden;
  color: var(--pf-text);
  background:
    radial-gradient(
      circle at 100% 0,
      color-mix(in srgb, var(--pf-pink) 13%, transparent),
      transparent 36%
    ),
    var(--pf-surface);
  border: 1px solid color-mix(in srgb, var(--pf-pink) 22%, var(--pf-line));
  border-radius: 24px;
  box-shadow: 0 28px 90px rgb(46 21 37 / 34%);
}

.bookmark-dialog__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--pf-line);

  h2,
  p {
    margin: 0;
  }

  h2 {
    font-size: 1.08rem;
    font-weight: 800;
  }

  p {
    margin-top: 3px;
    overflow: hidden;
    color: var(--pf-muted);
    font-size: 0.78rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.bookmark-dialog__icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, var(--pf-pink), #f18aae);
  border-radius: 14px;
  box-shadow: 0 8px 20px color-mix(in srgb, var(--pf-pink) 28%, transparent);

  svg {
    width: 22px;
    height: 22px;
  }
}

.bookmark-dialog__close {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  color: var(--pf-muted);
  background: transparent;
  border: 0;
  border-radius: 12px;
  cursor: pointer;

  &:hover {
    color: var(--pf-pink);
    background: var(--pf-soft-pink);
  }
}

.bookmark-dialog__body {
  overflow-y: auto;
  padding: 18px 22px 22px;
}

.bookmark-dialog__loading {
  display: flex;
  min-height: 250px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--pf-muted);
  font-size: 0.88rem;
}

.bookmark-dialog__spinner {
  display: inline-block;
  width: 17px;
  height: 17px;
  flex: 0 0 auto;
  border: 2px solid color-mix(in srgb, var(--pf-pink) 24%, transparent);
  border-top-color: var(--pf-pink);
  border-radius: 50%;
  animation: bookmark-spin 0.7s linear infinite;
}

.bookmark-dialog__section {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;

  & + & {
    margin-top: 22px;
    padding-top: 20px;
    border-top: 1px solid var(--pf-line);
  }

  legend {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 0.9rem;
    font-weight: 780;

    span {
      color: var(--pf-muted);
      font-size: 0.72rem;
      font-weight: 650;
    }
  }
}

.visibility-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  button {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    min-height: 68px;
    padding: 12px 13px;
    color: var(--pf-text);
    text-align: left;
    background: var(--pf-bg);
    border: 1px solid var(--pf-line);
    border-radius: 14px;
    cursor: pointer;

    > svg:first-child {
      width: 21px;
      height: 21px;
      color: var(--pf-muted);
    }

    strong,
    small {
      display: block;
    }

    strong {
      font-size: 0.84rem;
    }

    small {
      margin-top: 3px;
      color: var(--pf-muted);
      font-size: 0.68rem;
    }

    &.active {
      background: color-mix(in srgb, var(--pf-pink) 8%, var(--pf-surface));
      border-color: color-mix(in srgb, var(--pf-pink) 52%, var(--pf-line));
      box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--pf-pink) 12%, transparent);

      > svg:first-child,
      .visibility-options__check {
        color: var(--pf-pink);
      }
    }
  }
}

.visibility-options__check {
  width: 18px;
  height: 18px;
}

.selected-tags,
.suggested-tags > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-tags button,
.suggested-tags button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  padding: 5px 10px;
  color: color-mix(in srgb, var(--pf-pink) 82%, var(--pf-text));
  background: var(--pf-soft-pink);
  border: 1px solid color-mix(in srgb, var(--pf-pink) 25%, var(--pf-line));
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 680;

  svg {
    width: 14px;
    height: 14px;
  }
}

.tag-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-top: 12px;

  input {
    min-width: 0;
    height: 40px;
    padding: 0 13px;
    color: var(--pf-text);
    background: var(--pf-bg);
    border: 1px solid var(--pf-line);
    border-radius: 12px;
    outline: none;
    font: inherit;
    font-size: 0.82rem;

    &:focus {
      border-color: var(--pf-pink);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-pink) 13%, transparent);
    }
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 14px;
    color: var(--pf-pink);
    background: var(--pf-soft-pink);
    border: 1px solid color-mix(in srgb, var(--pf-pink) 28%, var(--pf-line));
    border-radius: 12px;
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 740;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    svg {
      width: 16px;
      height: 16px;
    }
  }
}

.suggested-tags {
  margin-top: 16px;

  > p {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0 0 9px;
    color: var(--pf-muted);
    font-size: 0.72rem;
    font-weight: 680;

    small {
      color: color-mix(in srgb, var(--pf-muted) 78%, transparent);
      font-size: 0.65rem;
      font-weight: 560;
    }
  }

  button {
    color: var(--pf-muted);
    background: var(--pf-bg);
    border-color: var(--pf-line);

    &.active {
      color: var(--pf-pink);
      background: var(--pf-soft-pink);
      border-color: color-mix(in srgb, var(--pf-pink) 30%, var(--pf-line));
    }

    small {
      opacity: 0.72;
    }
  }
}

.suggested-tags--recommend {
  margin-top: 18px;
  padding-top: 15px;
  border-top: 1px dashed color-mix(in srgb, var(--pf-pink) 20%, var(--pf-line));
}

.bookmark-dialog__empty,
.bookmark-dialog__warning {
  margin: 0;
  color: var(--pf-muted);
  font-size: 0.76rem;
}

.bookmark-dialog__warning {
  margin-top: 14px;
  padding: 9px 11px;
  color: #a55b28;
  background: color-mix(in srgb, #f2a154 10%, var(--pf-surface));
  border: 1px solid color-mix(in srgb, #f2a154 28%, var(--pf-line));
  border-radius: 10px;
}

.bookmark-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 22px 18px;
  background: color-mix(in srgb, var(--pf-bg) 62%, var(--pf-surface));
  border-top: 1px solid var(--pf-line);

  > div {
    display: flex;
    gap: 8px;
  }

  button {
    display: inline-flex;
    min-height: 40px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 16px;
    border-radius: 12px;
    cursor: pointer;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 760;

    &:disabled {
      cursor: wait;
      opacity: 0.55;
    }

    svg {
      width: 17px;
      height: 17px;
    }
  }
}

.bookmark-dialog__remove {
  color: #d34d64;
  background: transparent;
  border: 1px solid transparent;

  &:hover {
    background: color-mix(in srgb, #e85d75 9%, var(--pf-surface));
  }
}

.bookmark-dialog__cancel {
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
}

.bookmark-dialog__save {
  min-width: 112px;
  color: #fff;
  background: linear-gradient(135deg, var(--pf-pink), #ed7da5);
  border: 1px solid var(--pf-pink);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--pf-pink) 23%, transparent);
}

.bookmark-dialog-enter-active,
.bookmark-dialog-leave-active {
  transition: opacity 160ms ease;

  .bookmark-dialog__panel {
    transition:
      transform 180ms ease,
      opacity 160ms ease;
  }
}

.bookmark-dialog-enter-from,
.bookmark-dialog-leave-to {
  opacity: 0;

  .bookmark-dialog__panel {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}

@keyframes bookmark-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 620px) {
  .bookmark-dialog {
    align-items: end;
    padding: 0;
  }

  .bookmark-dialog__panel {
    width: 100%;
    max-height: calc(100vh - 20px);
    border-radius: 22px 22px 0 0;
  }

  .bookmark-dialog__header,
  .bookmark-dialog__body {
    padding-right: 16px;
    padding-left: 16px;
  }

  .visibility-options {
    grid-template-columns: 1fr;
  }

  .bookmark-dialog__footer {
    align-items: stretch;
    padding-right: 16px;
    padding-left: 16px;

    > div {
      flex: 1;
    }

    .bookmark-dialog__cancel,
    .bookmark-dialog__save {
      flex: 1;
    }
  }
}
</style>
