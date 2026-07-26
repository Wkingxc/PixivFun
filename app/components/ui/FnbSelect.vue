<template lang="pug">
.fnb-select(:class='{ open }' ref='selectRef')
  button.fnb-select-trigger(
    :aria-activedescendant='open ? `fnb-opt-${modelValue}` : undefined',
    :aria-expanded='open'
    @click='open = !open'
    @keydown='onTriggerKeydown'
    aria-haspopup='listbox'
    role='combobox'
    type='button'
  )
    span.fnb-select-label {{ currentLabel }}
    span.fnb-select-arrow(:class='{ flipped: open }') ▼
  Transition(name='fnb-select-dropdown')
    ul.fnb-select-dropdown(ref='dropdownRef' role='listbox' v-if='open')
      li.fnb-select-option(
        :aria-selected='opt.value === modelValue',
        :class='{ selected: opt.value === modelValue, focused: i === focusedIndex }',
        :id='`fnb-opt-${opt.value}`',
        :key='opt.value'
        @click='select(opt.value)'
        role='option'
        v-for='(opt, i) in options'
      ) {{ opt.label }}
</template>

<script lang="ts" setup>
const props = defineProps<{
  options: { label: string; value: string }[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const focusedIndex = ref(-1)
const selectRef = ref<HTMLElement>()
const dropdownRef = ref<HTMLElement>()

const currentLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue)
  return opt?.label ?? props.modelValue
})

function select(value: string) {
  emit('update:modelValue', value)
  open.value = false
  focusedIndex.value = -1
}

function onTriggerKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      e.preventDefault()
      if (!open.value) {
        open.value = true
        focusedIndex.value = props.options.findIndex(
          (o) => o.value === props.modelValue
        )
        if (focusedIndex.value === -1) focusedIndex.value = 0
      } else {
        moveFocus(e.key === 'ArrowDown' ? 1 : -1)
      }
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (open.value && focusedIndex.value >= 0) {
        select(props.options[focusedIndex.value]!.value)
      } else {
        open.value = !open.value
        if (open.value) {
          focusedIndex.value = props.options.findIndex(
            (o) => o.value === props.modelValue
          )
          if (focusedIndex.value === -1) focusedIndex.value = 0
        }
      }
      break
    case 'Escape':
      e.preventDefault()
      open.value = false
      focusedIndex.value = -1
      break
  }
}

function moveFocus(delta: number) {
  const len = props.options.length
  if (!len) return
  focusedIndex.value = (focusedIndex.value + delta + len) % len
}

onClickOutside(selectRef, () => {
  open.value = false
  focusedIndex.value = -1
})
</script>

<style scoped lang="scss">
.fnb-select {
  position: relative;
  display: inline-block;
  min-width: 6rem;
}

.fnb-select-trigger {
  width: 100%;
  min-height: 36px;
  padding: 0.35rem 0.8rem;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  box-shadow: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4em;
  font-weight: 650;
  font-size: 0.8rem;
  font-family: inherit;
  transition: all 150ms;

  &:hover {
    border-color: color-mix(in srgb, var(--pf-pink) 38%, var(--pf-line));
  }

  &:focus-visible {
    outline: 2px solid var(--pf-pink);
    outline-offset: 2px;
  }
}

.fnb-select-arrow {
  font-size: 0.6rem;
  transition: transform 0.2s;
  &.flipped {
    transform: rotate(180deg);
  }
}

.fnb-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgb(46 34 54 / 14%);
  z-index: 50;
  overflow: hidden;
  list-style: none;
  padding: 0;
  margin: 0;
}

.fnb-select-option {
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;

  &:hover,
  &.focused {
    background: var(--pf-bg);
    color: var(--pf-text);
  }

  &.selected {
    background: var(--pf-soft-pink);
    color: var(--pf-pink);
    font-weight: 700;
  }
}

.fnb-select-dropdown-enter-active,
.fnb-select-dropdown-leave-active {
  transition: all 0.15s ease;
}
.fnb-select-dropdown-enter-from,
.fnb-select-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
