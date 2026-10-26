<script setup lang="ts">
/**
 * An item's description, in a list's expanded row or on its page: the
 * `summary` slot (rarity, type, cost), flavor text, the `stats` slot, the body,
 * then the default slot (set bonuses, badges). The item's picture sits beside
 * the text on wide screens.
 */
defineProps<{
  item: { name?: string, flavor?: string, image?: string, body?: unknown }
}>()

const slots = defineSlots<{
  summary?: () => unknown
  stats?: () => unknown
  default?: () => unknown
}>()
</script>

<template>
  <div class="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
    <div class="min-w-0 flex-1 space-y-3">
      <slot name="summary" />
      <p v-if="item.flavor" class="text-sm italic text-muted">
        {{ item.flavor }}
      </p>
      <slot name="stats" />
      <USeparator v-if="item.flavor || slots.stats || slots.summary" />
      <ContentRenderer v-if="item.body" :value="item" class="prose-record text-sm" />
      <slot />
    </div>
    <img
      v-if="item.image"
      :src="item.image"
      :alt="item.name ?? ''"
      loading="lazy"
      referrerpolicy="no-referrer"
      class="mx-auto max-h-48 max-w-full shrink-0 rounded-md bg-muted bg-[radial-gradient(120%_90%_at_50%_40%,color-mix(in_oklab,var(--ui-primary)_18%,var(--ui-bg-muted)),var(--ui-bg-muted))] object-contain p-3 ring ring-default ring-inset md:mx-0 md:max-h-72 md:w-1/4"
    >
  </div>
</template>
