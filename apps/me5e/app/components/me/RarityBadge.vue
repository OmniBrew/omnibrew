<script setup lang="ts">
/** A rarity as a badge: the word, a diamond pip and the rarity's color. */
defineProps<{ rarity: string }>()
const { t } = useI18n()
</script>

<template>
  <span
    class="inline-flex h-5 items-center gap-1.5 rounded-xs px-1.5 font-label text-[11px]/3 font-semibold tracking-[0.08em] whitespace-nowrap uppercase ring ring-current/30 ring-inset bg-current/10"
    :class="rarity === 'common' || rarity === 'varies' ? 'text-toned' : rarityClass(rarity)"
  >
    <span class="size-1.5 shrink-0 rotate-45 bg-current" aria-hidden="true" />
    {{ t(`rarities.${rarity}`) }}
  </span>
</template>
