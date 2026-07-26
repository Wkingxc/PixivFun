<template>
  <section class="bookmark-batch" :class="{ active }">
    <button
      v-if="!active"
      class="bookmark-batch__start"
      type="button"
      @click="$emit('start')"
    >
      <ITablerChecklist aria-hidden="true" />
      批量管理收藏
    </button>

    <template v-else>
      <div class="bookmark-batch__summary">
        <strong>已选择 {{ selectedCount }} 项</strong>
        <button type="button" @click="$emit('toggle-all')">
          <ITablerSquareCheck v-if="allSelected" aria-hidden="true" />
          <ITablerSquare v-else aria-hidden="true" />
          {{ allSelected ? '取消全选' : `全选本页 ${totalCount} 项` }}
        </button>
      </div>

      <div class="bookmark-batch__visibility">
        <span>可见范围</span>
        <button
          :disabled="loading || !selectedCount"
          type="button"
          @click="$emit('set-visibility', false)"
        >
          <ITablerWorld aria-hidden="true" />
          转为公开
        </button>
        <button
          :disabled="loading || !selectedCount"
          type="button"
          @click="$emit('set-visibility', true)"
        >
          <ITablerLock aria-hidden="true" />
          转为私密
        </button>
      </div>

      <button
        class="bookmark-batch__cancel"
        :disabled="loading"
        type="button"
        @click="$emit('cancel')"
      >
        <ITablerX aria-hidden="true" />
        取消批量
      </button>

      <div class="bookmark-batch__tag-panel">
        <div class="bookmark-batch__tag-heading">
          <div>
            <strong>添加收藏标签</strong>
            <span>选择已有标签，或输入名称新建标签</span>
          </div>
          <span>{{ pendingTags.length }}/10</span>
        </div>

        <form class="bookmark-batch__tag-create" @submit.prevent="addInputTags">
          <input
            v-model="tagInput"
            aria-label="搜索已有标签或输入新标签"
            autocomplete="off"
            :disabled="loading || pendingTags.length >= 10"
            placeholder="搜索已有标签，或输入新标签后回车"
            type="text"
          />
          <button
            :disabled="loading || pendingTags.length >= 10 || !tagInput.trim()"
            type="submit"
          >
            <ITablerPlus aria-hidden="true" />
            加入
          </button>
          <button
            class="bookmark-batch__apply-tags"
            :disabled="loading || !selectedCount || !pendingTags.length"
            type="button"
            @click="applyTags"
          >
            <ITablerTagPlus aria-hidden="true" />
            应用标签
          </button>
        </form>

        <div v-if="pendingTags.length" class="bookmark-batch__pending">
          <span>待添加</span>
          <button
            v-for="tag in pendingTags"
            :key="tag"
            :aria-label="`移除待添加标签 ${tag}`"
            type="button"
            @click="toggleTag(tag)"
          >
            {{ tag }}
            <ITablerX aria-hidden="true" />
          </button>
        </div>

        <div class="bookmark-batch__suggestion-heading">
          <span>已有收藏标签</span>
          <small v-if="tagInput.trim()">筛选结果</small>
        </div>
        <div
          v-if="filteredAvailableTags.length"
          class="bookmark-batch__suggestions"
        >
          <button
            v-for="tag in filteredAvailableTags"
            :key="tag.name"
            :aria-pressed="pendingTags.includes(tag.name)"
            :class="{ selected: pendingTags.includes(tag.name) }"
            :disabled="
              loading ||
              (pendingTags.length >= 10 && !pendingTags.includes(tag.name))
            "
            type="button"
            @click="toggleTag(tag.name)"
          >
            <ITablerCheck
              v-if="pendingTags.includes(tag.name)"
              aria-hidden="true"
            />
            <span>{{ tag.name }}</span>
            <small>{{ tag.count }}</small>
          </button>
        </div>
        <p v-else class="bookmark-batch__empty">
          {{
            tagInput.trim()
              ? '没有匹配的已有标签，可以直接加入并新建'
              : '暂无已有收藏标签，可以在上方新建'
          }}
        </p>
      </div>
    </template>
  </section>
</template>

<script lang="ts" setup>
import {
  IconCheck as ITablerCheck,
  IconChecklist as ITablerChecklist,
  IconLock as ITablerLock,
  IconPlus as ITablerPlus,
  IconSquare as ITablerSquare,
  IconSquareCheck as ITablerSquareCheck,
  IconTagPlus as ITablerTagPlus,
  IconWorld as ITablerWorld,
  IconX as ITablerX,
} from '@tabler/icons-vue'
import {
  mergeBookmarkTags,
  prioritizeBookmarkTags,
  splitBookmarkTagInput,
  type BookmarkTagItem,
} from '~/utils/bookmarkTags'

const props = defineProps<{
  active: boolean
  selectedCount: number
  totalCount: number
  allSelected: boolean
  loading?: boolean
  availableTags?: BookmarkTagItem[]
}>()

const emit = defineEmits<{
  start: []
  cancel: []
  'toggle-all': []
  'add-tags': [tags: string[]]
  'set-visibility': [privateBookmarks: boolean]
}>()

const tagInput = ref('')
const pendingTags = ref<string[]>([])

const filteredAvailableTags = computed(() => {
  const query = tagInput.value.trim().toLocaleLowerCase()
  const availableTagNames = new Set(
    (props.availableTags ?? []).map((tag) => tag.name)
  )
  return prioritizeBookmarkTags(
    props.availableTags ?? [],
    pendingTags.value
  ).filter(
    (tag) =>
      availableTagNames.has(tag.name) &&
      (!query || tag.name.toLocaleLowerCase().includes(query))
  )
})

function addInputTags() {
  const tags = splitBookmarkTagInput(tagInput.value)
  if (!tags.length) return
  pendingTags.value = mergeBookmarkTags(pendingTags.value, tags)
  tagInput.value = ''
}

function toggleTag(tag: string) {
  if (pendingTags.value.includes(tag)) {
    pendingTags.value = pendingTags.value.filter((item) => item !== tag)
    return
  }
  pendingTags.value = mergeBookmarkTags(pendingTags.value, [tag])
}

function applyTags() {
  if (!pendingTags.value.length || !props.selectedCount) return
  emit('add-tags', pendingTags.value)
}

watch(
  () => props.active,
  (active) => {
    if (active) return
    tagInput.value = ''
    pendingTags.value = []
  }
)
</script>

<style scoped lang="scss">
.bookmark-batch {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin: -6px 0 16px;
  padding: 0;

  &.active {
    position: sticky;
    z-index: 11;
    top: 122px;
    flex-wrap: wrap;
    justify-content: flex-start;
    padding: 11px 13px;
    background: color-mix(in srgb, var(--pf-surface) 94%, transparent);
    border: 1px solid color-mix(in srgb, var(--pf-pink) 22%, var(--pf-line));
    border-radius: 16px;
    box-shadow: 0 10px 28px rgb(63 32 50 / 13%);
    backdrop-filter: blur(14px);
  }

  button,
  input {
    min-height: 36px;
    border-radius: 10px;
    font: inherit;
    font-size: 0.76rem;
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 12px;
    color: var(--pf-text);
    background: var(--pf-surface);
    border: 1px solid var(--pf-line);
    cursor: pointer;
    font-weight: 720;

    &:hover:not(:disabled) {
      color: var(--pf-pink);
      background: var(--pf-soft-pink);
      border-color: color-mix(in srgb, var(--pf-pink) 34%, var(--pf-line));
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.48;
    }

    svg {
      width: 17px;
      height: 17px;
    }
  }
}

.bookmark-batch__start {
  color: var(--pf-pink) !important;
  background: var(--pf-soft-pink) !important;
  border-color: color-mix(
    in srgb,
    var(--pf-pink) 28%,
    var(--pf-line)
  ) !important;
}

.bookmark-batch__summary {
  display: flex;
  align-items: center;
  gap: 8px;

  strong {
    min-width: 86px;
    color: var(--pf-pink);
    font-size: 0.78rem;
  }
}

.bookmark-batch__visibility {
  display: flex;
  align-items: center;
  gap: 7px;

  > span {
    color: var(--pf-muted);
    font-size: 0.68rem;
  }
}

.bookmark-batch__cancel {
  margin-left: auto;
}

.bookmark-batch__tag-panel {
  display: grid;
  width: 100%;
  gap: 10px;
  padding: 12px;
  background: color-mix(in srgb, var(--pf-soft-pink) 46%, var(--pf-bg));
  border: 1px solid color-mix(in srgb, var(--pf-pink) 16%, var(--pf-line));
  border-radius: 13px;
}

.bookmark-batch__tag-heading,
.bookmark-batch__suggestion-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bookmark-batch__tag-heading {
  > div {
    display: grid;
    gap: 2px;
  }

  strong {
    color: var(--pf-text);
    font-size: 0.78rem;
  }

  span {
    color: var(--pf-muted);
    font-size: 0.68rem;
  }
}

.bookmark-batch__tag-create {
  display: flex;
  gap: 7px;

  input {
    min-width: 160px;
    flex: 1;
    padding: 0 11px;
    color: var(--pf-text);
    background: var(--pf-surface);
    border: 1px solid var(--pf-line);
    outline: none;

    &:focus {
      border-color: var(--pf-pink);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-pink) 12%, transparent);
    }
  }
}

.bookmark-batch .bookmark-batch__apply-tags {
  color: #fff;
  background: var(--pf-pink);
  border-color: var(--pf-pink);

  &:hover:not(:disabled) {
    color: #fff;
    background: color-mix(in srgb, var(--pf-pink) 88%, #fff);
  }
}

.bookmark-batch__pending {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;

  > span {
    margin-right: 2px;
    color: var(--pf-muted);
    font-size: 0.68rem;
  }

  button {
    min-height: 28px;
    padding: 0 9px;
    color: var(--pf-pink);
    background: var(--pf-surface);
    border-color: color-mix(in srgb, var(--pf-pink) 30%, var(--pf-line));

    svg {
      width: 13px;
      height: 13px;
    }
  }
}

.bookmark-batch__suggestion-heading {
  color: var(--pf-muted);
  font-size: 0.68rem;

  small {
    color: var(--pf-pink);
  }
}

.bookmark-batch__suggestions {
  display: flex;
  max-height: 118px;
  flex-wrap: wrap;
  gap: 6px;
  overflow-y: auto;

  button {
    min-height: 30px;
    padding: 0 9px;
    font-size: 0.7rem;

    small {
      color: var(--pf-muted);
      font-size: 0.62rem;
    }

    &.selected {
      color: #fff;
      background: var(--pf-pink);
      border-color: var(--pf-pink);

      small {
        color: rgb(255 255 255 / 78%);
      }
    }

    svg {
      width: 14px;
      height: 14px;
    }
  }
}

.bookmark-batch__empty {
  margin: 0;
  color: var(--pf-muted);
  font-size: 0.7rem;
}

@media (max-width: 760px) {
  .bookmark-batch.active {
    top: 112px;
  }

  .bookmark-batch__summary,
  .bookmark-batch__visibility {
    width: 100%;
  }

  .bookmark-batch__tag-create {
    flex-wrap: wrap;

    input {
      min-width: 100%;
    }
  }

  .bookmark-batch__cancel {
    margin-left: 0;
  }
}
</style>
