<script setup lang="ts">
/** A sheet panel (design notes, "Character sheet"): `bg-muted`, 1 px border, 12 px padding, an overline title. */
defineProps<{ title?: string, as?: string }>()
</script>

<template>
  <component :is="as ?? 'section'" class="min-w-0 rounded-md border border-default bg-muted p-3">
    <header v-if="title || $slots.actions" class="mb-2 flex min-h-6 items-center justify-between gap-2">
      <h2 v-if="title" class="eyebrow text-muted">
        {{ title }}
      </h2>
      <slot name="actions" />
    </header>
    <slot />
  </component>
</template>
