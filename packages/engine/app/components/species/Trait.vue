<script setup lang="ts">
/**
 * One entry of a species' traits list: a heading and its text. `anchor` is the
 * element id that search results link to (`/species/drell#natural-hunters`).
 */
withDefaults(defineProps<{
  label: string
  anchor?: string
  /** Heading level, by how deep the list sits on the page. */
  level?: 3 | 4 | 5
}>(), { anchor: undefined, level: 3 })
</script>

<template>
  <div :id="anchor" class="scroll-mt-24">
    <component :is="`h${level}`" class="font-label text-base font-semibold text-highlighted">
      {{ label }}
    </component>
    <div class="mt-1 text-default">
      <slot />
    </div>
  </div>
</template>
