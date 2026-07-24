<template lang="pug">
footer.global-footer
  .top.flex.container
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

const yearStr = ref(new Date().getFullYear().toString())
</script>

<style scoped lang="scss">
.global-footer {
  background-color: var(--fnb-surface);
  font-size: 1rem;
  color: var(--fnb-text);
  border-top: 3px solid var(--fnb-border);
}

.top {
  padding-top: 2rem;
  padding-bottom: 2rem;
  gap: 1.5rem;
}

.bottom {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  background-color: var(--fnb-bg);
}

a {
  color: var(--fnb-text);
  font-weight: 600;

  &:hover {
    background: var(--fnb-highlight);
    color: var(--fnb-on-light);
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
  background: var(--fnb-highlight);
  color: var(--fnb-on-light);
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
