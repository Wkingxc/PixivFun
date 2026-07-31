<template lang="pug">
#ugoira-viewer(:class='{ "is-loading": isLoading, "is-ready": firstLoaded }')
  .ugoira-frame
    canvas.media(
      :height='illust.height',
      :width='illust.width'
      ref='canvasRef'
      v-show='firstLoaded && !isLoading'
    )
    DeferLoad.media(
      :height='illust.height',
      :src='illust.urls.regular',
      :width='illust.width'
      loading='lazy'
      v-if='!firstLoaded || isLoading'
    )

    .ugoira-top-controls
      .ugoira-quality-switch(aria-label='动图画质')
        button(
          :class='{ active: !isHQLoaded }',
          :disabled='isLoading'
          @click='changeQuality(false)'
          type='button'
        ) 普通
        button(
          :class='{ active: isHQLoaded }',
          :disabled='isLoading'
          @click='changeQuality(true)'
          type='button'
        ) 原画
      button.ugoira-progress-switch(
        :aria-pressed='showPlaybackControls',
        :class='{ active: showPlaybackControls }'
        @click='showPlaybackControls = !showPlaybackControls'
        type='button'
      ) 进度条

    .ugoira-loading(aria-live='polite' role='status' v-if='isLoading')
      .ugoira-loading__copy
        span 正在加载动图帧
        strong {{ roundedDownloadProgress }}%
      .ugoira-loading__track(
        :aria-valuenow='roundedDownloadProgress'
        aria-label='动图帧加载进度'
        aria-valuemax='100'
        aria-valuemin='0'
        role='progressbar'
      )
        span(:style='{ width: `${roundedDownloadProgress}%` }')
      small(v-if='totalFrameCount') 已处理 {{ loadedFrameCount }} / {{ totalFrameCount }} 帧

  .ugoira-toolbar(v-if='showPlaybackControls')
    button.ugoira-control(
      :aria-label='isPlaying ? "暂停动图" : "继续播放动图"',
      :disabled='isLoading || !firstLoaded'
      @click='handlePause'
      type='button'
    )
      ITablerPlayerPause(aria-hidden='true' v-if='isPlaying')
      ITablerPlayerPlay(aria-hidden='true' v-else)
      span {{ isPlaying ? '暂停' : '继续' }}

    .ugoira-playback
      input(
        :disabled='isLoading || !firstLoaded',
        :value='playbackProgress'
        @input='handleSeek'
        aria-label='动图播放进度'
        max='100'
        min='0'
        step='0.1'
        type='range'
      )
      .ugoira-playback__meta
        span {{ isLoading ? '加载完成后自动播放' : '循环播放' }}
        span(v-if='playbackTotalFrames') 第 {{ playbackFrameIndex + 1 }} / {{ playbackTotalFrames }} 帧
</template>

<script lang="ts" setup>
import type { Artwork } from '~/types'
import { UgoiraPlayer } from '~/utils/UgoiraPlayer'
import { shouldNotifyUgoiraInitFailure } from '~/utils/ugoiraTimeline'
import DeferLoad from './DeferLoad.vue'
import {
  IconPlayerPause as ITablerPlayerPause,
  IconPlayerPlay as ITablerPlayerPlay,
} from '@tabler/icons-vue'

const props = defineProps<{
  illust: Artwork
}>()
const emit = defineEmits<{
  'on:player': [UgoiraPlayer]
}>()

const toast = useToast()

const firstLoaded = ref(false)
const isLoading = ref(false)
const canvasRef = ref<HTMLCanvasElement>()
const downloadProgress = ref(0)
const loadedFrameCount = ref(0)
const totalFrameCount = ref(0)
const isHQLoaded = ref(false)
const playbackProgress = ref(0)
const playbackFrameIndex = ref(0)
const playbackTotalFrames = ref(0)
const showPlaybackControls = ref(false)
let disposed = false
let downloadFailureNotified = false
const player = computed(() => {
  const p = new UgoiraPlayer(props.illust, {
    progressiveRender: false,
    onDownloadProgress: (progress, frameIndex, totalFrames) => {
      downloadProgress.value = progress
      loadedFrameCount.value = Math.round((progress / 100) * totalFrames)
      totalFrameCount.value = totalFrames
      console.log(
        `下载进度: ${progress.toFixed(1)}%（帧 ${frameIndex + 1}，已处理 ${loadedFrameCount.value}/${totalFrames}）`
      )
    },
    onDownloadComplete: () => {
      console.log('所有帧下载完成')
      downloadProgress.value = 100
      loadedFrameCount.value = totalFrameCount.value
    },
    onPlaybackProgress: (progress, frameIndex, totalFrames) => {
      playbackProgress.value = progress
      playbackFrameIndex.value = frameIndex
      playbackTotalFrames.value = totalFrames
    },
    onDownloadError: (error) => {
      if (disposed) return
      downloadFailureNotified = true
      console.error('下载失败:', error)

      // 下载失败后还原状态，让用户可以重新尝试
      firstLoaded.value = false
      isHQLoaded.value = false
      downloadProgress.value = 0
      loadedFrameCount.value = 0
      totalFrameCount.value = 0
      isLoading.value = false

      // 清理播放器状态
      p.destroy()

      toast.warning('Ugoira 下载失败，请重试')
    },
  })
  emit('on:player', p)
  return p
})
const isPlaying = ref(false)
const roundedDownloadProgress = computed(() =>
  Math.round(downloadProgress.value)
)

async function handleInit(originalQuality?: boolean) {
  if (disposed || isLoading.value) return
  downloadFailureNotified = false
  isLoading.value = true
  isPlaying.value = false
  downloadProgress.value = 0
  loadedFrameCount.value = 0
  totalFrameCount.value = 0
  playbackProgress.value = 0
  playbackFrameIndex.value = 0
  playbackTotalFrames.value = 0

  try {
    player.value.destroy()
    await player.value.fetchMeta()

    // 下载期间继续显示封面，准备完成后再切换到 canvas。
    firstLoaded.value = true
    isHQLoaded.value = !!originalQuality
    await nextTick()
    player.value.setupCanvas(canvasRef.value!)

    await player.value.fetchFrames(originalQuality)
    await player.value.preparePlayback()
    player.value.play()
    isPlaying.value = true
    isLoading.value = false
  } catch (error) {
    const shouldNotify = shouldNotifyUgoiraInitFailure(
      disposed,
      downloadFailureNotified
    )
    if (disposed) return
    if (shouldNotify) console.error('Ugoira 初始化失败:', error)

    // 初始化失败后还原状态，让用户可以重新尝试
    firstLoaded.value = false
    isHQLoaded.value = false
    downloadProgress.value = 0
    loadedFrameCount.value = 0
    totalFrameCount.value = 0
    playbackProgress.value = 0
    playbackFrameIndex.value = 0
    playbackTotalFrames.value = 0
    isLoading.value = false
    isPlaying.value = false

    // 清理播放器状态
    player.value.destroy()

    if (shouldNotify) toast.error('Ugoira 初始化失败，请重试')
  }
}

function handlePause() {
  if (isLoading.value || !firstLoaded.value) return
  if (isPlaying.value) {
    player.value.pause()
  } else {
    player.value.play()
  }
  isPlaying.value = !isPlaying.value
}

function changeQuality(originalQuality: boolean) {
  if (isLoading.value) return
  if (firstLoaded.value && isHQLoaded.value === originalQuality) return
  void handleInit(originalQuality)
}

function handleSeek(event: Event) {
  player.value.seekToProgress(Number((event.target as HTMLInputElement).value))
}

onMounted(() => {
  void handleInit(false)
})

onBeforeUnmount(() => {
  disposed = true
  player.value.destroy()
})
</script>

<style scoped lang="scss">
#ugoira-viewer {
  display: grid;
  gap: 12px;
  width: min(100%, 1040px);
  min-width: 0;
  max-width: 100%;
  line-height: 1.4;
}

.ugoira-frame {
  position: relative;
  display: grid;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: min(62vh, 520px);
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 35%, rgb(255 255 255 / 9%), transparent 42%),
    color-mix(in srgb, var(--pf-bg) 82%, #111);
  border: 1px solid var(--pf-line);
  border-radius: 16px;
  place-items: center;
}

.media {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 76vh;
  object-fit: contain;
}

.ugoira-top-controls {
  position: absolute;
  z-index: 3;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ugoira-quality-switch {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  background: color-mix(in srgb, var(--pf-surface) 88%, transparent);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 999px;
  box-shadow: 0 6px 20px rgb(0 0 0 / 16%);
  backdrop-filter: blur(10px);

  button {
    min-width: 48px;
    height: 30px;
    padding: 0 10px;
    color: var(--pf-muted);
    background: transparent;
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-size: 0.7rem;
    font-weight: 750;

    &.active {
      color: #fff;
      background: var(--pf-pink);
    }

    &:disabled {
      cursor: wait;
      opacity: 0.65;
    }
  }
}

.ugoira-progress-switch {
  height: 38px;
  padding: 0 13px;
  color: var(--pf-muted);
  background: color-mix(in srgb, var(--pf-surface) 88%, transparent);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 999px;
  box-shadow: 0 6px 20px rgb(0 0 0 / 16%);
  backdrop-filter: blur(10px);
  cursor: pointer;
  font: inherit;
  font-size: 0.7rem;
  font-weight: 750;

  &.active {
    color: #fff;
    background: var(--pf-pink);
    border-color: transparent;
  }
}

.spin-icon {
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
}

.ugoira-loading {
  position: absolute;
  z-index: 4;
  right: 16px;
  bottom: 16px;
  left: 16px;
  display: grid;
  gap: 7px;
  padding: 11px 13px;
  color: #fff;
  background: rgb(23 20 26 / 82%);
  border: 1px solid rgb(255 255 255 / 15%);
  border-radius: 12px;
  backdrop-filter: blur(12px);
}

.ugoira-loading__copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.74rem;
  font-weight: 650;
}

.ugoira-loading__track {
  height: 6px;
  overflow: hidden;
  background: rgb(255 255 255 / 18%);
  border-radius: 999px;

  span {
    display: block;
    height: 100%;
    background: var(--pf-pink);
    border-radius: inherit;
    transition: width 160ms ease;
  }
}

.ugoira-loading small {
  color: rgb(255 255 255 / 68%);
  font-size: 0.66rem;
}

.ugoira-toolbar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 14px;
}

.ugoira-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 11px;
  color: var(--pf-text);
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
  font-size: 0.74rem;
  font-weight: 700;

  svg {
    width: 17px;
    height: 17px;
  }

  &:hover:not(:disabled) {
    color: #fff;
    background: var(--pf-pink);
    border-color: transparent;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.ugoira-playback {
  display: grid;
  gap: 3px;
  min-width: 0;

  input {
    width: 100%;
    margin: 0;
    accent-color: var(--pf-pink);
    cursor: pointer;
  }

  input:disabled {
    cursor: wait;
    opacity: 0.5;
  }
}

.ugoira-playback__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--pf-muted);
  font-size: 0.66rem;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .ugoira-frame {
    min-height: 320px;
  }

  .ugoira-toolbar {
    grid-template-columns: 1fr;
  }

  .ugoira-control {
    justify-self: start;
  }
}
</style>
