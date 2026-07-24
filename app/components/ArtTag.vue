<template lang="pug">
FnbTag.artwork-tag(
  @click='handleActivate'
  @mousedown='handlePointerDown'
  clickable
)
  span.artwork-tag__name {{ tag }}
  span.artwork-tag__translation(v-if='visibleTranslation') {{ visibleTranslation }}
</template>

<script lang="ts" setup>
import {
  shouldNavigateArtworkTag,
  type PointerPosition,
} from '~/utils/artworkTagNavigation'

const props = defineProps<{
  tag: string
  translation?: string
  searchQuery?: Record<string, string>
}>()
const router = useRouter()
let pointerStart: PointerPosition | null = null

const searchUrl = computed(() => {
  const params = new URLSearchParams({
    q: props.tag,
    ...(props.searchQuery ?? {}),
  })
  return `/search?${params.toString()}`
})
const visibleTranslation = computed(() => {
  const translation = props.translation?.trim()
  return translation && translation !== props.tag ? translation : ''
})

function handlePointerDown(event: MouseEvent): void {
  if (event.button !== 0) {
    pointerStart = null
    return
  }

  pointerStart = {
    x: event.clientX,
    y: event.clientY,
  }
}

function handleActivate(event: Event): void {
  if (event instanceof MouseEvent) {
    const shouldNavigate = shouldNavigateArtworkTag(
      pointerStart,
      { x: event.clientX, y: event.clientY },
      window.getSelection()?.toString() || ''
    )
    pointerStart = null
    if (!shouldNavigate) return
  }

  void router.push(searchUrl.value)
}
</script>

<style scoped lang="scss">
.artwork-tag {
  gap: 0.45em;
  margin: 2px;
  user-select: text;
}

.artwork-tag__translation {
  color: var(--fnb-text-muted);
  font-weight: 400;
}
</style>
