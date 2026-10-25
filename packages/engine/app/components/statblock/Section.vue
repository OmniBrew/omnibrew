<script setup lang="ts">
/** A stat block section (Actions, Reactions, Legendary Actions): a ruled heading over its entries. */
defineProps<{ title: string }>()
</script>

<template>
  <section class="mt-6">
    <h3 class="border-b-2 border-secondary pb-1 font-display text-base font-semibold uppercase tracking-wider text-highlighted">
      {{ title }}
    </h3>
    <div class="mt-3 space-y-3">
      <slot />
    </div>
  </section>
</template>
