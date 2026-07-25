<template lang="pug">
section.daily-ranking-panel(aria-labelledby='daily-ranking-title')
  .panel-header
    h2#daily-ranking-title.plain 每日排行
    RouterLink(to='/ranking') 查看全部

  .ranking-list(v-if='artworks.length')
    RouterLink.ranking-item(
      :key='artwork.id',
      :to='`/artworks/${artwork.id}`'
      v-for='(artwork, index) in artworks.slice(0, 4)'
    )
      span.rank-badge(:data-rank='index + 1') {{ index + 1 }}
      .ranking-thumb-wrap
        DeferLoad.ranking-thumb(:src='getImageUrl(artwork)')
        ArtworkViewedOverlay(:artwork-id='artwork.id')
      .ranking-copy
        strong(:style='titleStyle(artwork.id)') {{ artwork.title }}
        span by {{ artwork.userName }}
        span.likes
          ITablerHeart(aria-hidden='true')
          | {{ formatCount(artwork.viewCount) }}

  .ranking-list(aria-label='正在加载每日排行' v-else-if='loading')
    .ranking-item.ranking-item--loading(:key='index' v-for='index in 4')
      FnbSkeleton(circle height='28px' width='28px')
      FnbSkeleton(height='104px' width='112px')
      .ranking-copy
        FnbSkeleton(text width='8em')
        FnbSkeleton(text width='5em')

  .ranking-empty(v-else) 暂时没有排行数据
</template>

<script lang="ts" setup>
import DeferLoad from '~/components/DeferLoad.vue'
import { IconHeart as ITablerHeart } from '@tabler/icons-vue'
import { toRegularUrl } from '~/utils/pximg'
import type { RankedArtworkInfo } from '~/types'
import { useLocalPersistenceStore } from '~/stores/local-persistence'

const props = defineProps<{
  artworks: RankedArtworkInfo[]
  loading: boolean
}>()
const localPersistence = useLocalPersistenceStore()

function getImageUrl(artwork: RankedArtworkInfo): string {
  return toRegularUrl(artwork.url)
}

function formatCount(value: number): string {
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

function titleStyle(id: string | number) {
  if (
    !localPersistence.isArtworkViewed(id) ||
    !localPersistence.viewedMarker.markArtworkTitle
  ) {
    return undefined
  }
  const { r, g, b, a } = localPersistence.viewedMarker.artworkVisitedColor
  return { color: `rgb(${r} ${g} ${b} / ${a})` }
}

watch(
  () => props.artworks,
  (items) => {
    void localPersistence
      .ensureArtworkVisits(items.map((item) => item.id))
      .catch(() => {})
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.daily-ranking-panel {
  min-width: 0;
  height: 360px;
  padding: 18px;
  overflow: hidden;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 20px;
  box-shadow: var(--pf-card-shadow);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;

  h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
  }

  a {
    color: var(--pf-muted);
    font-size: 0.75rem;
    text-decoration: none;

    &:hover {
      color: var(--pf-blue);
    }
  }
}

.ranking-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}

.ranking-item {
  display: grid;
  grid-template-columns: 28px 112px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 128px;
  padding: 8px;
  color: inherit;
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 14px;
  text-decoration: none;
  transition:
    border-color 150ms ease,
    transform 150ms ease;

  &:hover {
    border-color: color-mix(in srgb, var(--pf-blue) 38%, var(--pf-line));
    transform: translateY(-1px);

    .ranking-copy strong {
      color: var(--pf-blue);
    }
  }
}

.rank-badge {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  color: #5f6879;
  background: #dde2ea;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;

  &[data-rank='1'] {
    color: #fff;
    background: #ffb818;
  }

  &[data-rank='3'] {
    color: #fff;
    background: #e88954;
  }
}

.ranking-thumb {
  width: 112px;
  height: 104px;
  object-fit: cover;
  border-radius: 10px;
  background: var(--fnb-skeleton);
}

.ranking-thumb-wrap {
  position: relative;
  width: 112px;
  height: 104px;
  overflow: hidden;
  border-radius: 10px;
}

.ranking-copy {
  display: grid;
  min-width: 0;
  gap: 2px;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 0.86rem;
    font-weight: 650;
    transition: color 150ms ease;
  }

  span {
    color: var(--pf-muted);
    font-size: 0.7rem;
  }

  .likes {
    display: inline-flex;
    align-items: center;
    gap: 3px;

    svg {
      width: 11px;
      height: 11px;
    }
  }
}

.ranking-empty {
  display: grid;
  height: 260px;
  place-items: center;
  color: var(--pf-muted);
  font-size: 0.85rem;
}

@media (max-width: 560px) {
  .daily-ranking-panel {
    height: auto;
  }

  .ranking-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .ranking-item {
    grid-template-columns: 26px 96px minmax(0, 1fr);
    min-height: 104px;
  }

  .ranking-thumb {
    width: 96px;
    height: 88px;
  }

  .ranking-thumb-wrap {
    width: 96px;
    height: 88px;
  }
}
</style>
