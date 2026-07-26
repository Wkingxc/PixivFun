<template lang="pug">
template(v-if='repeat > 1')
  span.fnb-skeleton(
    :class='classes',
    :key='i',
    :style='sizeStyle'
    v-for='i in repeat'
  )
span.fnb-skeleton(:class='classes', :style='sizeStyle' v-else)
</template>

<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    width?: string
    height?: string
    circle?: boolean
    block?: boolean
    text?: boolean
    repeat?: number
  }>(),
  {
    repeat: 1,
  }
)

const classes = computed(() => ({
  'fnb-skeleton--circle': props.circle,
  'fnb-skeleton--block': props.block,
  'fnb-skeleton--text': props.text,
}))

const sizeStyle = computed(() => ({
  width: props.width,
  height: props.height,
}))
</script>

<style scoped lang="scss">
.fnb-skeleton {
  display: inline-block;
  background: var(--pf-skeleton);
  animation: imgProgress 0.8s ease infinite alternate;
  border-radius: 8px;

  &--circle {
    border-radius: 50%;
  }

  &--block {
    display: block;
    width: 100%;
  }

  &--text {
    height: 1em;
    display: inline-block;
  }
}
</style>
