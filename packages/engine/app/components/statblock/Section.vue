<script setup lang="ts">
/** A stat block section (Traits, Actions, Reactions): a caps heading over a faint brand rule, then its entries. */
defineProps<{ title: string }>()
</script>

<template>
  <section class="mt-4.5 first:mt-0">
    <h3 class="border-b border-[color-mix(in_oklab,var(--ui-tick)_55%,transparent)] pb-1.25 font-label text-[0.8125rem]/[1.125rem] font-semibold tracking-[0.12em] text-highlighted uppercase">
      {{ title }}
    </h3>
    <div class="mt-2.5 space-y-2">
      <slot />
    </div>
  </section>
</template>
