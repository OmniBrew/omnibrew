<script setup lang="ts">
/**
 * An item's name in a list row: a link to its page in its rarity's color, with
 * an optional type line and the Andromeda chip below.
 */
defineProps<{
  item: { name?: string, path?: string, rarity?: string, andromeda?: boolean }
  subtitle?: string
}>()
</script>

<template>
  <div class="min-w-0">
    <NuxtLink :to="item.path" class="font-semibold hover:underline" :class="rarityClass(item.rarity)" @click.stop>
      {{ item.name }}
    </NuxtLink>
    <p v-if="subtitle || item.andromeda" class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
      <span v-if="subtitle">{{ subtitle }}</span>
      <MeAndromedaChip v-if="item.andromeda" />
    </p>
  </div>
</template>
