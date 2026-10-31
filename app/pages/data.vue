<template lang="pug">
#data-view.modern-route-page.modern-page-shell
  h1 数据备份与恢复
  Card(title='换电脑或保留一份备份')
    p 导出访问记录、作者分类、精选作者、隐藏作品、屏蔽作者及阅读与外观偏好，也会保存当前浏览器的布局设置。
    p.tip 不包含 Pixiv 登录凭据、Google Drive 授权、网络代理和图片缓存。新电脑需要重新登录；程序目录仍需单独复制。
    p.tip Windows 默认用户数据目录：%APPDATA%\PixivFun，可按 Win+R 输入此路径查看。
    button.action(:disabled='busy' @click='exportBackup' type='button') {{ exporting ? '正在导出…' : '导出数据备份' }}
  Card(title='导入备份')
    p 选择 PixivFun 的 JSON 备份，兼容以前“导出访问记录”生成的文件。最大 32 MB。
    p.tip 访问记录、同名作者分类的成员、精选作者、隐藏作品和屏蔽作者会合并去重，保留本机已有数据。
    p.error(v-if='legacyBackup') 此文件是旧版“仅访问记录”导出，不含精选作者、作者分类和标记样式，无法从中恢复这些数据。请回到原电脑重新导出“数据备份”。
    input(
      :disabled='busy || completed'
      @change='selectFile'
      accept='.json,application/json'
      aria-label='选择 PixivFun 备份文件'
      type='file'
    )
    p.error(role='alert' v-if='error') {{ error }}
    .preview(v-if='backup')
      p {{ filename }} · {{ new Date(backup.exportedAt).toLocaleString('zh-CN') }}
      ul
        li 作品访问记录：{{ backup.data.visitedArtworkIds.length }}
        li 作者访问记录：{{ backup.data.visitedAuthorIds.length }}
        li 作者分类：{{ backup.categories.length }} · 精选作者：{{ backup.featuredAuthors.length }}
        li 隐藏作品：{{ backup.hiddenArtworks.length }} · 屏蔽作者：{{ backup.preferences?.contentFilter?.blockedAuthors?.length ?? 0 }}
      label(v-if='hasPreferences')
        input(
          :disabled='busy || completed'
          type='checkbox'
          v-model='restorePreferences'
        )
        | 同时恢复阅读、外观与布局偏好（覆盖本机对应设置）
      button.action(
        :disabled='busy || completed'
        @click='importBackup'
        type='button'
      ) {{ importing ? '正在导入…' : '确认合并导入' }}
    .result(role='status' v-if='completed')
      p {{ resultMessage }}
      button.action(@click='reload' type='button') 刷新页面应用数据
  Card(title='Google Drive 记录同步')
    p 在下方连接同一个 Google 账号，旧电脑点击“上传数据”，新电脑点击“下载合并”。同步访问记录、精选作者、分类、隐藏作品、屏蔽作者及标记与阅读偏好；下载时恢复云端偏好，保留并合并本机记录。浏览器布局设置请通过上面的文件备份迁移。
    GoogleDriveSync
</template>

<script lang="ts" setup>
import Card from '~/components/Card.vue'
import GoogleDriveSync from '~/components/Data/GoogleDriveSync.vue'
import { setTitle } from '~/utils/setTitle'
import {
  BROWSER_PREFERENCE_KEYS,
  MAX_BACKUP_BYTES,
  parseLocalBackup,
  type LocalBackup,
  type summarizeLocalBackup,
} from '~~/shared/local-backup'

const backup = shallowRef<LocalBackup>()
const filename = ref('')
const restorePreferences = ref(false)
const legacyBackup = ref(false)
const exporting = ref(false)
const importing = ref(false)
const reading = ref(false)
const completed = ref(false)
const error = ref('')
const resultMessage = ref('')
const busy = computed(() => exporting.value || importing.value || reading.value)
const hasPreferences = computed(
  () =>
    !!backup.value?.preferences ||
    !!Object.keys(backup.value?.browserPreferences ?? {}).length
)

async function exportBackup() {
  exporting.value = true
  error.value = ''
  try {
    const backupDocument = parseLocalBackup(
      await $fetch<LocalBackup>('/api/local/backup')
    )
    for (const key of BROWSER_PREFERENCE_KEYS) {
      const value = localStorage.getItem(key)
      if (value !== null) backupDocument.browserPreferences[key] = value
    }
    const blob = new Blob([JSON.stringify(parseLocalBackup(backupDocument))], {
      type: 'application/json',
    })
    if (blob.size > MAX_BACKUP_BYTES - 1024)
      throw new Error('备份超过 32 MB，暂时请通过复制用户数据目录迁移')
    const url = URL.createObjectURL(blob)
    const link = createDownloadLink(url)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '导出失败，请重试'
  } finally {
    exporting.value = false
  }
}

function createDownloadLink(url: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = `pixivfun-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.append(link)
  return link
}

async function selectFile(event: Event) {
  backup.value = undefined
  legacyBackup.value = false
  error.value = ''
  restorePreferences.value = false
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  reading.value = true
  try {
    if (file.size > MAX_BACKUP_BYTES - 1024)
      throw new Error('备份文件过大，最大支持 32 MB')
    const raw = JSON.parse((await file.text()).replace(/^\uFEFF/, ''))
    const parsed = parseLocalBackup(raw)
    legacyBackup.value = raw.format === undefined && raw.version === undefined
    restorePreferences.value = !legacyBackup.value && !!parsed.preferences
    backup.value = parsed
    filename.value = file.name
  } catch (cause) {
    error.value =
      cause instanceof SyntaxError
        ? '无法解析 JSON，请选择有效的 PixivFun 备份'
        : cause instanceof Error
          ? cause.message
          : '读取失败'
  } finally {
    reading.value = false
  }
}

async function importBackup() {
  if (!backup.value) return
  importing.value = true
  error.value = ''
  try {
    const result = await $fetch<{
      imported: { artworks: number; authorVisits: number }
      summary?: ReturnType<typeof summarizeLocalBackup>
    }>('/api/local/backup', {
      method: 'POST',
      body: {
        backup: backup.value,
        restorePreferences: restorePreferences.value,
      },
    })
    completed.value = true
    resultMessage.value = `导入成功，新增 ${result.imported.artworks} 条作品访问记录、${result.imported.authorVisits} 条作者访问记录，其他数据已合并。请刷新页面使所有列表和设置生效。`
    if (result.summary) {
      const summary = result.summary
      resultMessage.value += ` 本机现有精选作者 ${summary.featuredAuthors} 位、分类 ${summary.categories} 个（成员关系 ${summary.categoryMembers} 条）、隐藏作品 ${summary.hiddenArtworks} 条、屏蔽作者 ${summary.blockedAuthors} 位。${restorePreferences.value ? '标记颜色与阅读偏好已恢复。' : '保留本机标记颜色与阅读偏好。'}`
    }
    if (restorePreferences.value) {
      try {
        for (const [key, value] of Object.entries(
          backup.value.browserPreferences
        ))
          localStorage.setItem(key, value)
      } catch {
        resultMessage.value +=
          ' 浏览器拒绝保存部分布局设置，数据库数据已成功导入。'
      }
    }
  } catch (cause) {
    const response = cause as { data?: { message?: string } }
    error.value =
      response.data?.message || '导入失败，原有数据未被替换，请检查文件后重试'
  } finally {
    importing.value = false
  }
}

function reload() {
  window.location.reload()
}
onMounted(() => setTitle('数据备份与恢复'))
</script>

<style scoped lang="scss">
#data-view {
  display: grid;
  gap: 18px;
  max-width: 900px;
}
p {
  line-height: 1.7;
}
.tip,
.records {
  color: var(--pf-muted);
  font-size: 0.86rem;
}
.records {
  display: inline-block;
  margin-left: 18px;
}
.action {
  padding: 10px 16px;
  margin-top: 12px;
  color: var(--pf-text);
  background: var(--pf-soft-blue);
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
}
.action:disabled {
  opacity: 0.55;
  cursor: default;
}
.preview,
.result {
  margin-top: 18px;
  padding: 16px;
  border: 1px solid var(--pf-line);
  border-radius: 12px;
  overflow-wrap: anywhere;
}
.preview label {
  display: block;
  line-height: 1.7;
}
.error {
  color: #d84a62;
  overflow-wrap: anywhere;
}
input[type='file'] {
  max-width: 100%;
}
</style>
