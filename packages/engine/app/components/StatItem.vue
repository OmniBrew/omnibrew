<script setup lang="ts">
/** One labelled value in a stat grid (a power's casting time, an item's cost). Use inside a `<dl>`. */
defineProps<{ label: string }>()
</script>

<template>
  <div>
    <dt class="eyebrow text-muted">
      {{ label }}
    </dt>
    <dd class="mt-1 text-[0.9375rem]/6 text-highlighted">
      <slot />
    </dd>
  </div>
</template>
