<script setup lang="ts">
/** One labelled value in a stat grid (a power's casting time, an item's cost). Use inside a `<dl>`. */
defineProps<{ label: string }>()
</script>

<template>
  <div>
    <dt class="font-display text-xs font-semibold uppercase tracking-wider text-muted">
      {{ label }}
    </dt>
    <dd class="mt-0.5 text-sm text-default">
      <slot />
    </dd>
  </div>
</template>
