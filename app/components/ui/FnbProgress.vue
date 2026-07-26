<template lang="pug">
.fnb-progress
  .fnb-progress__track
    .fnb-progress__fill(:style='fillStyle')
  .fnb-progress__label(v-if='showValue') {{ Math.round(percentage) }}%
</template>

<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    percentage?: number
    color?: string
    height?: number
    showValue?: boolean
  }>(),
  {
    percentage: 0,
    height: 6,
  }
)

const fillStyle = computed(() => ({
  width: `${Math.min(100, Math.max(0, props.percentage))}%`,
  backgroundColor: props.color || 'var(--pf-blue)',
  height: `${props.height}px`,
}))
</script>

<style scoped lang="scss">
.fnb-progress__track {
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  overflow: hidden;
}

.fnb-progress__fill {
  border-radius: inherit;
  transition: width 300ms ease;
}

.fnb-progress__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
  margin-top: 0.25rem;
}
</style>
