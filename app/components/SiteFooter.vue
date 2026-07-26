<template lang="pug">
footer.global-footer(:class='{ compact }')
  .top.flex.container(v-if='!compact')
    section.flex-1
      h4 探索更多
      ul
        li
          ExternalLink(href='/api/random?format=image') 随机图片
        li
          RouterLink(to='/ranking') 今日排行
        li
          RouterLink(to='/about') 关于本站
    section.flex-1
      h4 相关资源
      ul
        li
          ExternalLink(href='https://www.pixiv.net/' target='_blank') Pixiv
        li
          ExternalLink(
            href='https://www.pixiv.net/settings/viewing'
            target='_blank'
          ) 浏览与显示设置

  .bottom.align-center
    p.copyright
      | Copyright &copy; {{ yearStr }}
      |
      | {{ PROJECT_NAME }}
      | &nbsp;
      em v{{ version }}
</template>

<script lang="ts" setup>
import ExternalLink from './ExternalLink.vue'
import { PROJECT_NAME, version } from '~/config'

withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false,
  }
)

const yearStr = ref(new Date().getFullYear().toString())
</script>

<style scoped lang="scss">
.global-footer {
  background-color: var(--pf-surface);
  font-size: 1rem;
  color: var(--pf-text);
  border-top: 1px solid var(--pf-line);
}

.top {
  padding-top: 2rem;
  padding-bottom: 2rem;
  gap: 1.5rem;
}

.bottom {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  background-color: var(--pf-bg);
}

.compact {
  border-top-width: 1px;

  .bottom {
    min-height: 54px;
    display: grid;
    place-items: center;
    padding: 12px 24px;
  }

  .copyright {
    margin: 0;
    color: var(--pf-muted);
    font-size: 0.78rem;
  }
}

a {
  color: var(--pf-text);
  font-weight: 600;

  &:hover {
    color: var(--pf-pink);
    background: var(--pf-soft-pink);
    padding: 0 0.2em;
  }

  &::after {
    visibility: visible;
    transform: scaleX(1);
    width: 40%;
    height: 1px;
  }

  &:hover::after {
    width: 100%;
  }
}

h4 {
  position: relative;
  margin: 1rem 0 0.5rem 0;
  padding: 0.2em 0.4em;
  font-size: 1.1rem;
  color: var(--pf-text);
  background: transparent;
  display: inline-block;
}

ul {
  padding-left: 1rem;
  margin: 0.2rem 0;

  a {
    display: inline;
    font-weight: 400;
  }
}

@media screen and (max-width: 600px) {
  .top {
    flex-direction: column;
  }
}
</style>
