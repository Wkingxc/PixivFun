<template lang="pug">
.proxy-settings
  label.proxy-toggle
    ITablerWorldWww(aria-hidden='true')
    span 启用网络代理
    input(aria-label='启用网络代理' type='checkbox' v-model='enabled')

  form.proxy-form(@submit.prevent='save')
    label.proxy-address(:class='{ disabled: !enabled }')
      span 代理地址
      input(
        :disabled='!enabled'
        autocomplete='off'
        placeholder='http://127.0.0.1:7890'
        spellcheck='false'
        type='text'
        v-model='url'
      )
    small 默认关闭，仅支持 HTTP/HTTPS 代理
    button(:disabled='saving || !dirty' type='submit') {{ saving ? '保存中…' : '保存代理设置' }}
</template>

<script lang="ts" setup>
import { IconWorldWww as ITablerWorldWww } from '@tabler/icons-vue'
import { normalizeProxyUrl } from '~~/shared/local-preferences'
import { useLocalPersistenceStore } from '~/stores/local-persistence'
import { useSideNavStore } from '~/stores/session'

const localPersistenceStore = useLocalPersistenceStore()
const sideNavStore = useSideNavStore()
const toast = useToast()
const enabled = ref(false)
const url = ref('')
const saving = ref(false)

const normalizedDraftUrl = computed(() => {
  try {
    return normalizeProxyUrl(url.value)
  } catch {
    return url.value.trim()
  }
})
const dirty = computed(() => {
  const saved = localPersistenceStore.preferences.networkProxy
  return (
    enabled.value !== saved.enabled || normalizedDraftUrl.value !== saved.url
  )
})

function resetDraft() {
  const saved = localPersistenceStore.preferences.networkProxy
  enabled.value = saved.enabled
  url.value = saved.url
}

async function save() {
  let normalizedUrl: string
  try {
    normalizedUrl = normalizeProxyUrl(url.value)
  } catch {
    toast.warning('请输入有效的 HTTP/HTTPS 代理地址')
    return
  }
  if (enabled.value && !normalizedUrl) {
    toast.warning('请先填写代理地址，再启用代理')
    return
  }

  saving.value = true
  try {
    await localPersistenceStore.patchPreferences({
      networkProxy: {
        enabled: enabled.value,
        url: normalizedUrl,
      },
    })
    url.value = normalizedUrl
    toast.success(enabled.value ? '网络代理已启用' : '网络代理已关闭')
  } catch {
    toast.error('代理设置保存失败，请重试')
  } finally {
    saving.value = false
  }
}

watch(
  () => sideNavStore.isOpened,
  (opened) => {
    if (opened && !saving.value) resetDraft()
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.proxy-settings {
  display: grid;
  gap: 9px;
  padding: 2px 10px;
}

.proxy-toggle {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 34px;
  color: var(--pf-text);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;

  svg {
    width: 18px;
    height: 18px;
  }

  input {
    width: 17px;
    height: 17px;
    accent-color: var(--pf-pink);
  }
}

.proxy-form {
  display: grid;
  gap: 7px;
}

.proxy-address {
  display: grid;
  gap: 5px;
  color: var(--pf-text);
  font-size: 0.78rem;
  font-weight: 600;

  input {
    width: 100%;
    min-width: 0;
    height: 34px;
    padding: 0 9px;
    color: var(--pf-text);
    background: var(--pf-surface);
    border: 1px solid var(--pf-line);
    border-radius: 8px;
    outline: none;
    font: inherit;

    &:focus {
      border-color: var(--pf-pink);
      box-shadow: 0 0 0 2px rgb(244 118 162 / 14%);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  }
}

small {
  color: var(--pf-muted);
  font-size: 0.72rem;
  line-height: 1.45;
}

button {
  min-height: 32px;
  color: white;
  background: var(--pf-pink);
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }
}
</style>
