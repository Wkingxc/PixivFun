<template>
  <section class="artwork-tag-panel" aria-label="收藏整理">
    <button
      class="artwork-tag-panel__toggle"
      :aria-expanded="open"
      type="button"
      @click="toggle"
    >
      <ITablerChevronRight
        aria-hidden="true"
        class="artwork-tag-panel__chevron"
        :class="{ open }"
      />
      <span class="artwork-tag-panel__title">
        <strong>收藏整理</strong>
        <span>按作品标签筛选，或按作者聚合收藏</span>
      </span>
      <span class="artwork-tag-panel__status">
        <span v-if="viewMode === 'authors'" class="artwork-tag-panel__selected">
          作者聚合
        </span>
        <span
          v-else-if="selectedTags.length"
          class="artwork-tag-panel__selected"
        >
          已选 {{ selectedTags.length }} 个 · 命中 {{ matchedCount }} 件
        </span>
        <span v-if="scanning"
          >统计中 {{ scannedCount }}/{{ totalCount || '…' }}</span
        >
        <span v-else-if="viewMode === 'authors' && scanned">
          {{ authorCount }} 位作者 · {{ matchedCount }} 件收藏
        </span>
        <span v-else-if="scanned">
          {{ stats.length }} 个标签 · {{ scannedCount }} 件收藏
        </span>
        <span v-else>展开后开始统计</span>
      </span>
    </button>

    <div v-show="open" class="artwork-tag-panel__body">
      <div class="artwork-tag-panel__views" aria-label="收藏整理方式">
        <button
          :aria-pressed="viewMode === 'artwork-tags'"
          :class="{ active: viewMode === 'artwork-tags' }"
          type="button"
          @click="selectViewMode('artwork-tags')"
        >
          <ITablerTags aria-hidden="true" />
          作品标签
        </button>
        <button
          :aria-pressed="viewMode === 'authors'"
          :class="{ active: viewMode === 'authors' }"
          type="button"
          @click="selectViewMode('authors')"
        >
          <ITablerUsers aria-hidden="true" />
          作者聚合
        </button>
      </div>

      <div v-if="viewMode === 'authors'" class="artwork-tag-panel__authors">
        <div class="artwork-tag-panel__author-copy">
          <strong>按作者聚合</strong>
          <span>同一作者的收藏集中展示</span>
          <span v-if="selectedTags.length" class="active-filter">
            已应用 {{ selectedTags.length }} 个作品标签
          </span>
        </div>
        <div class="artwork-tag-panel__sort" aria-label="作者排序">
          <span>作者排序</span>
          <button
            :aria-pressed="authorSort === 'count'"
            :class="{ active: authorSort === 'count' }"
            type="button"
            @click="$emit('update:authorSort', 'count')"
          >
            件数最多
          </button>
          <button
            :aria-pressed="authorSort === 'recent'"
            :class="{ active: authorSort === 'recent' }"
            type="button"
            @click="$emit('update:authorSort', 'recent')"
          >
            最近收藏
          </button>
          <button
            class="refresh"
            :disabled="scanning"
            title="重新整理"
            type="button"
            @click="$emit('refresh')"
          >
            <ITablerRefresh aria-hidden="true" />
            <span class="sr-only">重新整理</span>
          </button>
        </div>
      </div>

      <div v-else class="artwork-tag-panel__tools">
        <input
          v-model.trim="query"
          aria-label="搜索作品标签"
          placeholder="搜索作品标签"
          type="search"
        />
        <button
          v-if="selectedTags.length"
          type="button"
          @click="$emit('update:selectedTags', [])"
        >
          <ITablerFilterOff aria-hidden="true" />
          清除筛选
        </button>
        <button :disabled="scanning" type="button" @click="$emit('refresh')">
          <ITablerRefresh aria-hidden="true" />
          重新统计
        </button>
      </div>

      <p v-if="error" class="artwork-tag-panel__notice error">{{ error }}</p>
      <p v-else-if="truncated" class="artwork-tag-panel__notice">
        收藏数量较多，当前整理了最新的 {{ scannedCount }} 件（共
        {{ totalCount }} 件），统计与作者排序以这些作品为准。
      </p>

      <div
        v-if="viewMode === 'artwork-tags' && visibleTags.length"
        class="artwork-tag-panel__cloud pf-tag-cloud"
      >
        <button
          v-for="tag in visibleTags"
          :key="tag.name"
          :aria-pressed="selectedTags.includes(tag.name)"
          class="pf-tag-capsule"
          :class="{ 'is-selected': selectedTags.includes(tag.name) }"
          type="button"
          @click="toggleTag(tag.name)"
          @focus="describeTag(tag.name)"
          @mouseenter="describeTag(tag.name)"
        >
          <span class="pf-tag-capsule__name">{{ tag.name }}</span>
          <span v-if="translationOf(tag.name)" class="pf-tag-capsule__sub">
            {{ '#' + translationOf(tag.name) }}
          </span>
          <span class="pf-tag-capsule__count">{{ tag.count }}</span>
        </button>
      </div>
      <p v-else-if="scanning" class="artwork-tag-panel__notice">
        正在读取收藏并整理数据…
      </p>
      <p
        v-else-if="viewMode === 'artwork-tags' && query"
        class="artwork-tag-panel__notice"
      >
        没有匹配的作品标签
      </p>
      <p
        v-else-if="viewMode === 'artwork-tags' && !visibleTags.length"
        class="artwork-tag-panel__notice"
      >
        还没有统计到作品标签，可以点击“重新统计”重试。
      </p>

      <button
        v-if="viewMode === 'artwork-tags' && hiddenTagCount > 0"
        class="artwork-tag-panel__more"
        type="button"
        @click="limit += TAG_DISPLAY_STEP"
      >
        显示更多（还有 {{ hiddenTagCount }} 个）
      </button>

      <div
        v-if="viewMode === 'artwork-tags' && describedTag"
        class="artwork-tag-panel__detail"
      >
        <div class="artwork-tag-panel__detail-title">
          <strong>{{ describedTag }}</strong>
          <span v-if="describedInfo?.translation">
            {{ '#' + describedInfo.translation }}
          </span>
          <small v-if="describedInfo?.parentTag">
            {{ '母标签 ' + describedInfo.parentTag }}
          </small>
        </div>
        <p v-if="!describedInfo">读取标签简介…</p>
        <p v-else-if="describedInfo.abstract">{{ describedInfo.abstract }}</p>
        <p v-else class="muted">这个标签没有简介</p>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import {
  IconChevronRight as ITablerChevronRight,
  IconFilterOff as ITablerFilterOff,
  IconRefresh as ITablerRefresh,
  IconTags as ITablerTags,
  IconUsers as ITablerUsers,
} from '@tabler/icons-vue'
import {
  pinSelectedArtworkTags,
  searchArtworkTagStats,
  type ArtworkTagStat,
} from '~/utils/bookmarkArtworkTags'
import type {
  BookmarkAuthorSort,
  BookmarkCollectionViewMode,
} from '~/utils/bookmarkAuthorGroups'

const TAG_DISPLAY_STEP = 40

const props = defineProps<{
  stats: ArtworkTagStat[]
  selectedTags: string[]
  matchedCount: number
  scannedCount: number
  totalCount: number
  scanning?: boolean
  scanned?: boolean
  truncated?: boolean
  error?: string
  viewMode: BookmarkCollectionViewMode
  authorSort: BookmarkAuthorSort
  authorCount: number
}>()

const emit = defineEmits<{
  'update:selectedTags': [tags: string[]]
  'update:viewMode': [mode: BookmarkCollectionViewMode]
  'update:authorSort': [sort: BookmarkAuthorSort]
  expand: []
  refresh: []
}>()

const open = ref(false)
const query = ref('')
const limit = ref(TAG_DISPLAY_STEP)
const describedTag = ref('')
const tagInfo = useTagInfo()

const matchedTags = computed(() =>
  searchArtworkTagStats(props.stats, query.value)
)
const visibleTags = computed(() =>
  pinSelectedArtworkTags(matchedTags.value, props.selectedTags, limit.value)
)
const hiddenTagCount = computed(() =>
  Math.max(0, matchedTags.value.length - limit.value)
)

const describedInfo = computed(() =>
  describedTag.value ? tagInfo.get(describedTag.value) : undefined
)

function translationOf(name: string): string {
  return tagInfo.get(name)?.translation ?? ''
}

function describeTag(name: string) {
  describedTag.value = name
  tagInfo.ensure(name)
}

function toggle() {
  open.value = !open.value
  if (open.value) emit('expand')
}

function selectViewMode(mode: BookmarkCollectionViewMode) {
  emit('update:viewMode', mode)
  emit('expand')
}

// Names and descriptions cost one request each, so only ask for the chips on
// screen, and only once the scan settled (the top tags churn while it runs).
watch(
  [open, () => props.scanning, visibleTags],
  () => {
    if (!open.value || props.scanning) return
    for (const tag of visibleTags.value) tagInfo.ensure(tag.name)
  },
  { immediate: true }
)

function toggleTag(name: string) {
  emit(
    'update:selectedTags',
    props.selectedTags.includes(name)
      ? props.selectedTags.filter((tag) => tag !== name)
      : [...props.selectedTags, name]
  )
}

watch(query, () => {
  limit.value = TAG_DISPLAY_STEP
})
</script>

<style scoped lang="scss">
.artwork-tag-panel {
  margin-bottom: 18px;
  overflow: hidden;
  background: color-mix(in srgb, var(--pf-surface) 96%, transparent);
  border: 1px solid var(--pf-line);
  border-radius: 16px;
  box-shadow: var(--pf-card-shadow);
}

.artwork-tag-panel__toggle {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  color: var(--pf-text);
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  text-align: left;

  &:hover {
    background: color-mix(in srgb, var(--pf-pink) 5%, transparent);
  }
}

.artwork-tag-panel__chevron {
  width: 1rem;
  height: 1rem;
  flex: none;
  color: var(--pf-muted);
  transition: transform 160ms ease;

  &.open {
    transform: rotate(90deg);
  }
}

.artwork-tag-panel__title {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 9px;

  strong {
    font-size: 0.86rem;
    font-weight: 790;
  }

  span {
    overflow: hidden;
    color: var(--pf-muted);
    font-size: 0.7rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.artwork-tag-panel__status {
  display: flex;
  align-items: center;
  margin-left: auto;
  gap: 8px;
  color: var(--pf-muted);
  font-size: 0.7rem;
  white-space: nowrap;
}

.artwork-tag-panel__selected {
  padding: 3px 9px;
  color: var(--pf-pink);
  background: var(--pf-soft-pink);
  border-radius: 999px;
  font-weight: 720;
}

.artwork-tag-panel__body {
  padding: 4px 16px 15px;
  border-top: 1px solid var(--pf-line);
}

.artwork-tag-panel__views {
  display: inline-flex;
  padding: 3px;
  margin: 12px 0 2px;
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 11px;

  button {
    display: inline-flex;
    min-height: 34px;
    align-items: center;
    gap: 6px;
    padding: 0 13px;
    color: var(--pf-muted);
    background: transparent;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    font: inherit;
    font-size: 0.74rem;
    font-weight: 720;

    &.active {
      color: #fff;
      background: var(--pf-pink);
      box-shadow: 0 5px 14px color-mix(in srgb, var(--pf-pink) 22%, transparent);
    }

    svg {
      width: 15px;
      height: 15px;
    }
  }
}

.artwork-tag-panel__authors {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 10px;
  padding: 11px 0 2px;
}

.artwork-tag-panel__author-copy {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;

  strong {
    font-size: 0.78rem;
  }

  span {
    color: var(--pf-muted);
    font-size: 0.7rem;
  }

  .active-filter {
    padding: 3px 8px;
    color: var(--pf-pink);
    background: var(--pf-soft-pink);
    border-radius: 999px;
    font-weight: 700;
  }
}

.artwork-tag-panel__sort {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;

  > span {
    margin-right: 2px;
    color: var(--pf-muted);
    font-size: 0.7rem;
    font-weight: 650;
  }

  button {
    display: inline-flex;
    min-height: 32px;
    align-items: center;
    justify-content: center;
    padding: 0 11px;
    color: var(--pf-muted);
    background: var(--pf-bg);
    border: 1px solid var(--pf-line);
    border-radius: 9px;
    cursor: pointer;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 720;

    &.active {
      color: #fff;
      background: var(--pf-pink);
      border-color: var(--pf-pink);
    }

    &.refresh {
      width: 32px;
      padding: 0;

      &:hover:not(:disabled) {
        color: var(--pf-pink);
        border-color: color-mix(in srgb, var(--pf-pink) 35%, var(--pf-line));
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      svg {
        width: 15px;
        height: 15px;
      }
    }
  }
}

.artwork-tag-panel__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  margin: 12px 0;

  input {
    min-width: 160px;
    max-width: 280px;
    min-height: 34px;
    flex: 1;
    padding: 0 11px;
    color: var(--pf-text);
    background: var(--pf-bg);
    border: 1px solid var(--pf-line);
    border-radius: 10px;
    font: inherit;
    font-size: 0.76rem;
    outline: 0;

    &:focus {
      border-color: var(--pf-pink);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-pink) 12%, transparent);
    }
  }

  button {
    display: inline-flex;
    min-height: 34px;
    align-items: center;
    gap: 5px;
    padding: 0 12px;
    color: var(--pf-muted);
    background: var(--pf-bg);
    border: 1px solid var(--pf-line);
    border-radius: 10px;
    cursor: pointer;
    font: inherit;
    font-size: 0.74rem;
    font-weight: 700;

    &:hover:not(:disabled) {
      color: var(--pf-pink);
      background: var(--pf-soft-pink);
      border-color: color-mix(in srgb, var(--pf-pink) 32%, var(--pf-line));
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    svg {
      width: 15px;
      height: 15px;
    }
  }
}

.artwork-tag-panel__notice {
  margin: 0 0 4px;
  color: var(--pf-muted);
  font-size: 0.72rem;

  &.error {
    color: var(--pf-pink);
  }
}

.artwork-tag-panel__cloud {
  // Tall enough for three rows of capsules before the cloud starts scrolling.
  max-height: 312px;
  overflow-y: auto;
}

.artwork-tag-panel__detail {
  margin-top: 11px;
  padding: 9px 11px;
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 11px;

  p {
    margin: 5px 0 0;
    color: var(--pf-text);
    font-size: 0.72rem;
    line-height: 1.55;

    &.muted {
      color: var(--pf-muted);
    }
  }
}

.artwork-tag-panel__detail-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 7px;

  strong {
    font-size: 0.76rem;
    font-weight: 780;
  }

  span {
    color: var(--pf-pink);
    font-size: 0.68rem;
  }

  small {
    color: var(--pf-muted);
    font-size: 0.64rem;
  }
}

.artwork-tag-panel__more {
  margin-top: 10px;
  padding: 5px 12px;
  color: var(--pf-pink);
  background: transparent;
  border: 1px dashed color-mix(in srgb, var(--pf-pink) 40%, var(--pf-line));
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
}

@media (max-width: 560px) {
  .artwork-tag-panel__title span {
    display: none;
  }

  .artwork-tag-panel__status {
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .artwork-tag-panel__authors,
  .artwork-tag-panel__author-copy {
    align-items: flex-start;
    flex-direction: column;
  }

  .artwork-tag-panel__authors {
    gap: 10px;
  }

  .artwork-tag-panel__sort {
    width: 100%;

    button {
      flex: 1;
    }
  }
}
</style>
