<template lang="pug">
.google-drive-sync
  .status
    ITablerBrandGoogleDrive(aria-hidden='true')
    span {{ statusText }}

  .actions(v-if='connected')
    button(
      :disabled='busy'
      @click='upload'
      title='合并记录和名单，上传本机标记与阅读偏好'
      type='button'
    )
      ITablerCloudUpload(aria-hidden='true')
      | {{ action === 'upload' ? '上传中…' : '上传数据' }}
    button(
      :disabled='busy'
      @click='sync'
      title='合并云端记录和名单，并恢复标记与阅读偏好'
      type='button'
    )
      ITablerCloudDownload(aria-hidden='true')
      | {{ action === 'sync' ? '下载中…' : '下载合并' }}
    button.danger(
      :disabled='busy'
      @click='disconnect'
      title='断开 Google Drive'
      type='button'
    )
      ITablerUnlink(aria-hidden='true')
      | 断开连接

  button.connect(:disabled='busy' @click='connect' type='button' v-else)
    ITablerLink(aria-hidden='true')
    | {{ action === 'connect' ? '等待授权…' : '连接 Google Drive' }}
  p(role='status' v-if='syncMessage') {{ syncMessage }}
  button(@click='reload' type='button' v-if='syncMessage') 刷新页面应用数据
</template>

<script lang="ts" setup>
import {
  IconBrandGoogleDrive as ITablerBrandGoogleDrive,
  IconCloudDownload as ITablerCloudDownload,
  IconCloudUpload as ITablerCloudUpload,
  IconLink as ITablerLink,
  IconUnlink as ITablerUnlink,
} from '@tabler/icons-vue'
import { useLocalPersistenceStore } from '~/stores/local-persistence'
import type { summarizeLocalBackup } from '~~/shared/local-backup'

type Action = 'status' | 'connect' | 'upload' | 'sync' | 'disconnect' | null

const localPersistenceStore = useLocalPersistenceStore()
const toast = useToast()
const connected = ref(false)
const syncMessage = ref('')
function reload() {
  window.location.reload()
}
const action = ref<Action>(null)
const busy = computed(() => action.value !== null)
const statusText = computed(() => {
  if (action.value === 'status') return '正在检查 Google Drive…'
  if (connected.value) return 'Google Drive 已连接'
  return 'Google Drive 未连接'
})
let statusPoll: ReturnType<typeof setInterval> | undefined

async function refreshStatus(silent = false): Promise<boolean> {
  if (!silent) action.value = 'status'
  try {
    const response = await $fetch<{ connected: boolean }>(
      '/api/cloud/google/status'
    )
    connected.value = response.connected
    return response.connected
  } finally {
    if (!silent && action.value === 'status') action.value = null
  }
}

async function connect() {
  action.value = 'connect'
  const popup = window.open(
    'about:blank',
    'pixivfun-google-drive',
    'popup,width=560,height=720'
  )
  if (!popup) {
    action.value = null
    toast.warning('请允许 PixivFun 打开 Google 授权窗口')
    return
  }
  popup.opener = null
  try {
    const response = await $fetch<{
      authorizationUrl: string
      expiresAt: number
    }>('/api/cloud/google/connect', { method: 'POST' })
    popup.location.href = response.authorizationUrl
    pollConnection(response.expiresAt)
  } catch {
    popup?.close()
    action.value = null
    toast.error('无法启动 Google Drive 授权')
  }
}

function pollConnection(expiresAt: number) {
  stopPolling()
  statusPoll = setInterval(() => {
    void (async () => {
      if (Date.now() >= expiresAt) {
        stopPolling()
        action.value = null
        toast.warning('Google Drive 授权已超时，请重试')
        return
      }
      try {
        if (await refreshStatus(true)) {
          stopPolling()
          action.value = null
          toast.success('Google Drive 已连接')
        }
      } catch {
        // Keep polling until the short-lived authorization flow expires.
      }
    })()
  }, 1_000)
}

async function upload() {
  action.value = 'upload'
  try {
    const result = await $fetch<{
      created: boolean
      artworks: number
      authors: number
    }>('/api/cloud/google/upload', { method: 'POST' })
    toast.success(
      `数据备份已上传（${result.artworks} 条作品访问、${result.authors} 条作者访问，含精选作者、分类及标记偏好）`
    )
  } catch {
    toast.error('Google Drive 上传失败')
  } finally {
    action.value = null
  }
}

async function sync() {
  action.value = 'sync'
  try {
    const result = await $fetch<{
      found: boolean
      artworksAdded: number
      authorsAdded: number
      summary?: ReturnType<typeof summarizeLocalBackup>
      legacy?: boolean
    }>('/api/cloud/google/sync', { method: 'POST' })
    if (!result.found) {
      toast.info('云端还没有 PixivFun 数据，请先上传')
      return
    }
    await Promise.all([
      localPersistenceStore.refreshCheckedArtworkVisits(),
      localPersistenceStore.refreshCheckedAuthorVisits(),
    ])
    syncMessage.value = result.legacy
      ? '云端是旧版仅访问记录备份，不含精选作者、分类和标记样式。请在原电脑使用新版重新上传。'
      : `数据已合并。精选作者 ${result.summary?.featuredAuthors ?? 0} 位、分类 ${result.summary?.categories ?? 0} 个，标记与阅读偏好已恢复。请刷新页面应用全部数据。`
    toast.success(
      `已新增 ${result.artworksAdded} 个作品和 ${result.authorsAdded} 个作者记录`
    )
  } catch {
    toast.error('Google Drive 同步失败')
  } finally {
    action.value = null
  }
}

async function disconnect() {
  action.value = 'disconnect'
  try {
    await $fetch('/api/cloud/google/disconnect', { method: 'POST' })
    connected.value = false
    toast.success('已断开 Google Drive')
  } catch {
    await refreshStatus(true).catch(() => {})
    toast.error('Google Drive 断开操作未完全成功')
  } finally {
    action.value = null
  }
}

function stopPolling() {
  if (statusPoll) clearInterval(statusPoll)
  statusPoll = undefined
}

onMounted(() => {
  void refreshStatus().catch(() => {
    toast.error('无法检查 Google Drive 连接状态，请刷新页面重试')
  })
})

onBeforeUnmount(stopPolling)
</script>

<style scoped lang="scss">
.google-drive-sync {
  display: grid;
  gap: 12px;
  margin-top: 18px;
  justify-items: start;
}

.status {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
  color: var(--pf-text);
  font-size: 0.94rem;
  font-weight: 600;

  svg {
    width: 18px;
    height: 18px;
    color: var(--pf-blue);
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  color: var(--pf-text);
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 9px;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 650;

  &:hover:not(:disabled) {
    color: var(--pf-blue);
    background: var(--pf-soft-blue);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.55;
  }

  svg {
    width: 16px;
    height: 16px;
  }
}

.danger:hover:not(:disabled) {
  color: #d84a62;
  background: rgb(216 74 98 / 8%);
}
</style>
