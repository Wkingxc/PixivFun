<template lang="pug">
table.fnb-table
  slot
</template>

<style scoped lang="scss">
.fnb-table {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  color: var(--pf-text);
  background: var(--pf-surface);

  :deep(th),
  :deep(td) {
    padding: 0.65rem 0.8rem;
    border-bottom: 1px solid var(--pf-line);
    text-align: left;
  }

  :deep(th) {
    background: var(--pf-bg);
    font-weight: 700;
  }

  :deep(tr:hover td) {
    background: color-mix(in srgb, var(--pf-soft-pink) 42%, transparent);
  }
}
</style>
