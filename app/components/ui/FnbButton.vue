<template lang="pug">
component.fnb-button(
  :class='[`fnb-button--${variant}`, `fnb-button--${size}`, { "fnb-button--disabled": disabled || loading, "fnb-button--loading": loading }]',
  :disabled='tag === "button" || !tag ? disabled || loading : undefined',
  :href='href',
  :is='tag || (href ? "a" : "button")'
  v-bind='$attrs'
)
  span.fnb-button__spinner(v-if='loading')
    svg.spin(height='1em' viewBox='0 0 24 24' width='1em')
      circle(
        cx='12'
        cy='12'
        fill='none'
        r='10'
        stroke='currentColor'
        stroke-dasharray='31.4 31.4'
        stroke-linecap='round'
        stroke-width='3'
      )
  slot(name='icon' v-if='!loading')
  slot
</template>

<script lang="ts" setup>
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    variant?: 'default' | 'primary' | 'success' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    loading?: boolean
    disabled?: boolean
    tag?: string
    href?: string
  }>(),
  {
    variant: 'default',
    size: 'md',
  }
)
</script>

<style scoped lang="scss">
.fnb-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 40px;
  padding: 0.55rem 1rem;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  box-shadow: none;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  transition:
    color 150ms ease,
    background 150ms ease,
    border-color 150ms ease,
    transform 150ms ease;

  &:hover:not(.fnb-button--disabled) {
    color: var(--pf-pink);
    background: var(--pf-soft-pink);
    border-color: color-mix(in srgb, var(--pf-pink) 36%, var(--pf-line));
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid var(--pf-pink);
    outline-offset: 2px;
  }

  &--primary {
    color: #fff;
    background: var(--pf-blue);
    border-color: var(--pf-blue);

    &:hover:not(.fnb-button--disabled) {
      color: #fff;
      background: color-mix(in srgb, var(--pf-blue) 86%, #fff);
      border-color: var(--pf-blue);
    }
  }

  &--success {
    color: #16864c;
    background: color-mix(in srgb, #36d879 13%, var(--pf-surface));
    border-color: color-mix(in srgb, #36d879 45%, var(--pf-line));
  }

  &--danger {
    color: #d74755;
    background: color-mix(in srgb, #ed5a68 12%, var(--pf-surface));
    border-color: color-mix(in srgb, #ed5a68 42%, var(--pf-line));
  }

  &--sm {
    min-height: 34px;
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 700;
  }

  &--lg {
    min-height: 48px;
    padding: 0.8rem 1.4rem;
    font-size: 1.1rem;
  }

  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;

    transform: none;
  }

  &--loading {
    cursor: wait;
  }

  &__spinner {
    display: inline-flex;
    animation: spin 1s linear infinite;
  }

  // Icon slot: slightly larger than text for visual balance (≈ 18/14)
  :deep(.fnb-icon) {
    font-size: 1.25em;
  }
}
</style>
