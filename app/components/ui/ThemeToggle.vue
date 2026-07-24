<template lang="pug">
button.theme-toggle(
  :aria-label='label',
  :title='label'
  @click='toggleTheme'
  type='button'
)
  component(:is='icon', :size='20', :stroke-width='2')
</template>

<script lang="ts" setup>
import { IconMoon, IconSun } from '@tabler/icons-vue'
import { nextExplicitTheme } from '~/utils/refineModernArtwork'

const colorMode = useColorMode()
const { setTheme } = useTheme()

const targetTheme = computed(() => nextExplicitTheme(colorMode.value))
const label = computed(() =>
  targetTheme.value === 'dark' ? '切换到暗色主题' : '切换到亮色主题'
)
const icon = computed(() => (targetTheme.value === 'dark' ? IconMoon : IconSun))

function toggleTheme() {
  setTheme(targetTheme.value)
}
</script>

<style scoped lang="scss">
.theme-toggle {
  display: grid;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--pf-muted);
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  transition:
    color 150ms,
    background 150ms;

  &:hover {
    color: var(--pf-pink);
    background: var(--pf-soft-pink);
  }

  &:focus-visible {
    outline: 2px solid var(--pf-pink);
    outline-offset: 2px;
  }
}
</style>
