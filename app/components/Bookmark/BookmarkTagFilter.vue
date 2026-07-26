<template>
  <section class="bookmark-tag-filter" aria-label="收藏标签筛选">
    <div class="bookmark-tag-filter__heading">
      <div>
        <strong>收藏标签</strong>
        <span>按标签整理和筛选作品</span>
      </div>
      <span v-if="loading" class="bookmark-tag-filter__loading">读取中…</span>
    </div>
    <div class="pf-tag-cloud">
      <button
        class="pf-tag-capsule pf-tag-capsule--plain"
        :class="{ 'is-selected': modelValue === '' }"
        type="button"
        @click="$emit('update:modelValue', '')"
      >
        <span class="pf-tag-capsule__name">全部</span>
      </button>
      <button
        class="pf-tag-capsule pf-tag-capsule--plain"
        :class="{ 'is-selected': modelValue === UNCLASSIFIED_BOOKMARK_TAG }"
        type="button"
        @click="$emit('update:modelValue', UNCLASSIFIED_BOOKMARK_TAG)"
      >
        <span class="pf-tag-capsule__name">未分类</span>
      </button>
      <button
        v-for="tag in visibleTags"
        :key="tag.name"
        class="pf-tag-capsule"
        :class="{ 'is-selected': modelValue === tag.name }"
        type="button"
        @click="$emit('update:modelValue', tag.name)"
      >
        <span class="pf-tag-capsule__name">{{ tag.name }}</span>
        <span class="pf-tag-capsule__count">{{ tag.count }}</span>
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
