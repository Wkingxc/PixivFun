<template>
  <section class="bookmark-tag-filter" aria-label="收藏标签筛选">
    <div class="bookmark-tag-filter__heading">
      <div>
        <strong>收藏标签</strong>
        <span>按标签整理和筛选作品</span>
      </div>
      <span v-if="loading" class="bookmark-tag-filter__loading">读取中…</span>
    </div>
    <div class="bookmark-tag-filter__list">
      <button
        :class="{ active: modelValue === '' }"
        type="button"
        @click="$emit('update:modelValue', '')"
      >
        全部
      </button>
      <button
        :class="{ active: modelValue === UNCLASSIFIED_BOOKMARK_TAG }"
        type="button"
        @click="$emit('update:modelValue', UNCLASSIFIED_BOOKMARK_TAG)"
      >
        未分类
      </button>
      <button
        v-for="tag in visibleTags"
        :key="tag.name"
        :class="{ active: modelValue === tag.name }"
        type="button"
        @click="$emit('update:modelValue', tag.name)"
      >
        {{ tag.name }}
        <small>{{ tag.count }}</small>
      </button>
    </div>
  </section>
</template>

<script lang="ts" setup>
import {
  UNCLASSIFIED_BOOKMARK_TAG,
  type BookmarkTagItem,
} from '~/utils/bookmarkTags'

const props = defineProps<{
  items: BookmarkTagItem[]
  modelValue: string
  loading?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const visibleTags = computed(() =>
  props.items.filter(
    (tag) => tag.name && tag.name !== UNCLASSIFIED_BOOKMARK_TAG
  )
)
</script>

<style scoped lang="scss">
.bookmark-tag-filter {
  margin-bottom: 18px;
  padding: 15px 17px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--pf-pink) 8%, var(--pf-surface)),
    var(--pf-surface) 54%
  );
  border: 1px solid color-mix(in srgb, var(--pf-pink) 18%, var(--pf-line));
  border-radius: 16px;
  box-shadow: var(--pf-card-shadow);
}

.bookmark-tag-filter__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 11px;

  > div {
    display: flex;
    align-items: baseline;
    gap: 9px;
  }

  strong {
    font-size: 0.86rem;
    font-weight: 790;
  }

  span {
    color: var(--pf-muted);
    font-size: 0.7rem;
  }
}

.bookmark-tag-filter__loading {
  color: var(--pf-pink) !important;
}

.bookmark-tag-filter__list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;

  button {
    display: inline-flex;
    min-height: 31px;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    color: var(--pf-muted);
    background: var(--pf-bg);
    border: 1px solid var(--pf-line);
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 680;
    transition:
      color 140ms ease,
      background 140ms ease,
      border-color 140ms ease;

    &:hover,
    &.active {
      color: var(--pf-pink);
      background: var(--pf-soft-pink);
      border-color: color-mix(in srgb, var(--pf-pink) 34%, var(--pf-line));
    }

    &.active {
      box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--pf-pink) 12%, transparent);
    }

    small {
      min-width: 17px;
      padding: 1px 5px;
      color: inherit;
      background: color-mix(in srgb, currentcolor 8%, transparent);
      border-radius: 999px;
      font-size: 0.64rem;
      text-align: center;
    }
  }
}

@media (max-width: 560px) {
  .bookmark-tag-filter {
    padding: 13px;
  }

  .bookmark-tag-filter__heading > div {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }
}
</style>
