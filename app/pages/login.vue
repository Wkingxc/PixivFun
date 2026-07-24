<template lang="pug">
#auth-view
  form#login-form.not-logged-in(
    @submit.prevent='submit'
    v-if='!userStore.isLoggedIn'
  )
    section.login-primary
      button.cancel-button(@click='goBack' type='button')
        IFasAngleLeft(aria-hidden='true')
        | 取消
      p.eyebrow Pixiv 账户连接
      h1.title 设置 Pixiv 令牌
      p.intro 输入 PHPSESSID，在当前设备同步关注、收藏和个性化内容。
      .fnb-form-item
        label.fnb-form-item__label(for='phpsessid-input') PHPSESSID
          span.fnb-form-item__required *
        FnbInput(
          :class='validateSessionId(sessionIdInput) ? "valid" : "invalid"'
          aria-describedby='phpsessid-feedback'
          autocomplete='off'
          id='phpsessid-input'
          v-model='sessionIdInput'
        )
        #phpsessid-feedback.fnb-form-item__feedback(
          :class='(sessionIdInput && !validateSessionId(sessionIdInput)) || error ? "fnb-form-item__feedback--error" : "fnb-form-item__feedback--success"'
        ) {{ !sessionIdInput ? '请输入令牌' : !validateSessionId(sessionIdInput) ? '哎呀，这个格式看上去不太对……' : error ? error : '这个格式看上去没问题，点击保存试试' }}
      #submit
        FnbButton(
          :disabled='!!error || loading || !validateSessionId(sessionIdInput)'
          :loading='loading'
          type='submit'
          variant='primary'
        ) {{ loading ? '登录中……' : '保存令牌' }}
      .privacy-note
        strong 加密保存在当前站点
        span 登录后令牌只存在于浏览器不可读取的安全 Cookie 中，并仅用于代理 Pixiv 请求。

    aside.tips
      h2 如何获取 Pixiv 令牌？
      ol.guide-steps
        li 访问 #[ExternalLink(href='https://accounts.pixiv.net/portal' rel='noopener noreferrer' target='_blank') Pixiv 账户中心] 并登录您的账号
        li 按 #[kbd F12] 打开浏览器开发者工具
        li 切换到「应用」(Application) 选项卡（部分浏览器中显示为「存储」Storage），展开左侧「Cookie」列表
        li 找到 #[code PHPSESSID] 一行，双击复制它的值，粘贴到上方输入框
      .guide-image
        FnbImage(
          alt='获取 PHPSESSID 指引图'
          previewSrc='https://files.seeusercontent.com/2026/06/22/bkL1/PixPin_2026-06-22_12-51-31.png'
          src='https://files.seeusercontent.com/2026/06/22/bkL1/PixPin_2026-06-22_12-51-31.png'
        )
        .guide-image__hint 点击查看大图

      h2 安全吗？
      p 令牌会由本站服务端验证并加密封装，前端页面无法再次读取。第三方部署实例不在我们的控制范围内，请仅在您信任的实例上使用此功能。
      p 详细说明见：#[NuxtLink(to='/about#account-security') 安全说明]。

  section#login-form.logged-in(v-if='userStore.isLoggedIn')
    button.cancel-button(@click='goBack' type='button')
      IFasAngleLeft(aria-hidden='true')
      | 返回
    p.eyebrow Pixiv 账户连接
    h1 Pixiv 账户已连接
    p.intro 当前已连接 #[strong {{ userStore.userName }}]。为保护账户安全，本站不会再次显示 PHPSESSID。
    #submit
      FnbButton(
        :disabled='loading'
        :loading='loading'
        @click='remove'
        variant='danger'
      ) {{ loading ? '正在断开……' : '断开账户连接' }}
    p.logout-error(v-if='error') {{ error }}
</template>

<script lang="ts" setup>
definePageMeta({ name: 'login' })
import {
  validateSessionId,
  login,
  logout,
} from '~/composables/userData'
import { useUserStore } from '~/stores/session'
import { getSafeLoginBackTarget } from '~/utils/loginNavigation'
import IFasAngleLeft from '~icons/fa-solid/angle-left'

const sessionIdInput = ref('')
const error = ref('')
const loading = ref(false)
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const backTarget = computed(() =>
  getSafeLoginBackTarget(route.query.back)
)

function goBack(): void {
  router.replace(backTarget.value)
}

function getLoginError(err: unknown): string {
  const statusCode = (err as { statusCode?: number })?.statusCode
  if (statusCode === 401) return '令牌无效或已过期，请重新获取后再试。'
  if (statusCode === 429) return '尝试次数过多，请稍后再试。'
  if (statusCode === 502) return '暂时无法连接 Pixiv，请稍后再试。'
  return err instanceof Error ? err.message : '哎呀，出错了，请重试！'
}

async function submit(): Promise<void> {
  if (!validateSessionId(sessionIdInput.value)) {
    error.value = '哎呀，这个格式看上去不太对……'
    console.warn(error.value)
    return
  }
  try {
    loading.value = true
    const userData = await login(sessionIdInput.value)
    userStore.login(userData)
    error.value = ''
    goBack()
  } catch (err) {
    error.value = getLoginError(err)
  } finally {
    loading.value = false
  }
}

async function remove(): Promise<void> {
  try {
    loading.value = true
    if (!(await logout())) return
    userStore.logout()
    goBack()
  } catch (err) {
    error.value = getLoginError(err)
  } finally {
    loading.value = false
  }
}

watch(sessionIdInput, () => (error.value = ''))
</script>

<style scoped lang="scss">
#auth-view {
  min-height: calc(100vh - 64px);
  padding: clamp(28px, 5vw, 72px) 24px;
}

#login-form {
  box-sizing: border-box;
  width: min(1040px, 100%);
  margin: 0 auto;
  padding: clamp(28px, 3.5vw, 48px);
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 24px;
  box-shadow: var(--pf-card-shadow);
}

.not-logged-in {
  display: grid;
  grid-template-columns: minmax(300px, 0.82fr) minmax(420px, 1.18fr);
  gap: clamp(36px, 5vw, 64px);
  align-items: start;
}

.login-primary {
  position: sticky;
  top: 96px;
  min-width: 0;
}

.cancel-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 13px;
  color: var(--pf-text);
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
  font-weight: 650;

  &:hover {
    color: var(--pf-blue);
    background: var(--pf-soft-blue);
  }
}

.eyebrow {
  margin: 32px 0 8px;
  color: var(--pf-pink);
  font-size: 0.78rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.title {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.12;
}

.intro {
  margin: 14px 0 30px;
  color: var(--pf-muted);
  line-height: 1.65;
}

.tips {
  min-width: 0;
  padding-left: clamp(32px, 4vw, 52px);
  border-left: 1px solid var(--pf-line);

  h2 {
    margin: 0 0 16px;
    font-size: 1.35rem;
  }

  h2:not(:first-child) {
    margin-top: 28px;
  }

  p {
    color: var(--pf-muted);
    line-height: 1.7;
  }
}

.logged-in {
  max-width: 640px;

  h1 {
    margin: 28px 0 22px;
  }
}

.logout-error {
  margin-top: 14px;
  color: var(--fnb-danger);
}

input {
  display: block;
  width: 100%;
  padding: 4px 8px;
  font-size: 1.2rem;
}

#submit {
  margin: 20px 0 0;

  :deep(.fnb-button) {
    justify-content: center;
    width: 100%;
    min-height: 48px;
    border: 0;
    border-radius: 11px;
    box-shadow: none;

    &:hover {
      box-shadow: none;
      transform: translateY(-1px);
    }
  }
}

.privacy-note {
  display: grid;
  gap: 3px;
  margin-top: 20px;
  padding: 14px 16px;
  color: var(--pf-muted);
  background: var(--pf-soft-blue);
  border-radius: 12px;
  font-size: 0.78rem;

  strong {
    color: var(--pf-text);
  }
}

code {
  user-select: none;
}

kbd {
  display: inline-block;
  padding: 0.1em 0.4em;
  font-size: 0.85em;
  font-family: inherit;
  background: var(--fnb-bg-alt);
  border: 1px solid var(--fnb-border);
  border-radius: 3px;
  box-shadow: 0 1px 0 var(--fnb-border);
}

.fnb-form-item {
  margin-bottom: 0;

  &__label {
    display: block;
    margin-bottom: 8px;
    font-weight: 700;
  }

  &__required {
    color: var(--fnb-danger);
    margin-left: 0.25rem;
  }

  &__feedback {
    min-height: 1.4em;
    margin-top: 8px;
    font-size: 0.82rem;

    &--error {
      color: var(--fnb-danger);
    }

    &--success {
      color: var(--fnb-success, green);
    }
  }
}

.guide-steps {
  padding-left: 1.35rem;
  margin: 0;

  li {
    margin: 0 0 10px;
    padding-left: 4px;
    line-height: 1.65;
  }
}

.guide-image {
  margin: 20px 0 0;
  overflow: hidden;
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 14px;

  img {
    display: block;
    width: 100%;
  }

  &__hint {
    padding: 8px;
    color: var(--fnb-text-muted);
    font-size: 0.76rem;
    text-align: center;
  }
}

@media (max-width: 859px) {
  .not-logged-in {
    grid-template-columns: minmax(0, 1fr);
  }

  .login-primary {
    position: static;
  }

  .tips {
    padding-top: 32px;
    padding-left: 0;
    border-top: 1px solid var(--pf-line);
    border-left: 0;
  }
}

@media (max-width: 560px) {
  #auth-view {
    padding: 18px 14px 32px;
  }

  #login-form {
    padding: 20px;
    border-radius: 18px;
  }

  .eyebrow {
    margin-top: 26px;
  }

  .title {
    font-size: 2rem;
  }
}
</style>
