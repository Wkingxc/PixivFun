<template lang="pug">
.novel-reader
  template(:key='index' v-for='(block, index) in blocks')
    h2.chapter(v-if='block.type === "chapter"') {{ block.title }}
    .page-divider(v-else-if='block.type === "divider"')
      span {{ block.label || '分页' }}
    figure.embedded-image(v-else-if='block.type === "uploadedImage"')
      img(:alt='block.alt', :src='block.src' loading='lazy')
    .pixiv-image(v-else-if='block.type === "pixivImage"')
      RouterLink(:to='pixivImageLink(block.id)') 插入作品 {{ block.id }}
    p.paragraph(v-else-if='block.type === "paragraph"')
      template(:key='tokenIndex' v-for='(token, tokenIndex) in block.inlines')
        span(v-if='token.type === "text"') {{ token.text }}
        ruby(v-else-if='token.type === "ruby"')
          | {{ token.base }}
          rt {{ token.ruby }}
        a(
          :href='token.href'
          rel='noopener noreferrer'
          target='_blank'
          v-else-if='token.type === "link"'
        ) {{ token.text }}
        span.page-jump(v-else-if='token.type === "jump"') 第 {{ token.page }} 页
        strong(v-else-if='token.type === "bold"')
          template(
            :key='childIndex'
            v-for='(child, childIndex) in token.inlines'
          )
            span(v-if='child.type === "text"') {{ child.text }}
            ruby(v-else-if='child.type === "ruby"')
              | {{ child.base }}
              rt {{ child.ruby }}
            a(
              :href='child.href'
              rel='noopener noreferrer'
              target='_blank'
              v-else-if='child.type === "link"'
            ) {{ child.text }}
            span.page-jump(v-else-if='child.type === "jump"') 第 {{ child.page }} 页
            span.emphasis(
              :style='{ textEmphasis: child.mark, WebkitTextEmphasis: child.mark }'
              v-else-if='child.type === "emphasis"'
            ) {{ child.text }}
        em(v-else-if='token.type === "italic"')
          template(
            :key='childIndex'
            v-for='(child, childIndex) in token.inlines'
          )
            span(v-if='child.type === "text"') {{ child.text }}
            ruby(v-else-if='child.type === "ruby"')
              | {{ child.base }}
              rt {{ child.ruby }}
            a(
              :href='child.href'
              rel='noopener noreferrer'
              target='_blank'
              v-else-if='child.type === "link"'
            ) {{ child.text }}
            span.page-jump(v-else-if='child.type === "jump"') 第 {{ child.page }} 页
            span.emphasis(
              :style='{ textEmphasis: child.mark, WebkitTextEmphasis: child.mark }'
              v-else-if='child.type === "emphasis"'
            ) {{ child.text }}
        span.emphasis(
          :style='{ textEmphasis: token.mark, WebkitTextEmphasis: token.mark }'
          v-else-if='token.type === "emphasis"'
        ) {{ token.text }}
</template>

<script lang="ts" setup>
import type { NovelContentBlock } from '~/types'

defineProps<{
  blocks: NovelContentBlock[]
}>()

function pixivImageLink(id: string): string {
  const [illustId] = id.split('-')
  return `/artworks/${illustId}`
}
</script>

<style scoped lang="scss">
.novel-reader {
  max-width: min(100%, 74ch);
  margin: 0 auto;
  padding: clamp(1rem, 2vw, 2rem) 0;
  font-size: clamp(1rem, 0.96rem + 0.28vw, 1.16rem);
  line-height: 1.9;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
}

.paragraph {
  white-space: pre-wrap;
  margin: 0 0 1.35em;
}

.chapter {
  margin: 2.5rem 0 1rem;
  font-size: clamp(1.35rem, 1.1rem + 1vw, 2rem);
  line-height: 1.35;
}

.page-divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 2rem 0;
  color: var(--pf-muted);
  font-size: 0.9rem;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--pf-line);
  }
}

.embedded-image {
  margin: 2rem auto;
  text-align: center;

  img {
    max-width: 100%;
    height: auto;
    border: 1px solid var(--pf-line);
    border-radius: 12px;
  }
}

.pixiv-image {
  margin: 1.5rem 0;
  padding: 1rem;
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  text-align: center;
}

ruby rt {
  font-size: 0.65em;
}

.page-jump {
  color: var(--pf-muted);
  font-size: 0.9em;
}

.emphasis {
  text-emphasis-position: over right;
}
</style>
