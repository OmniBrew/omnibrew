<script setup lang="ts">
/**
 * An item's name in a list row: a link to its page in its rarity's color, then a
 * muted line with the rarity word and the type ("Uncommon · Heavy Pistol"), so
 * color is never the only cue, and the Andromeda chip.
 */
const props = defineProps<{
  item: { name?: string, path?: string, rarity?: string, andromeda?: boolean }
  subtitle?: string
}>()
const { t } = useI18n()
const line = computed(() => [props.item.rarity ? t(`rarities.${props.item.rarity}`) : '', props.subtitle].filter(Boolean).join(' · '))
</script>

<template>
  <div class="min-w-0">
    <NuxtLink :to="item.path" class="font-semibold hover:underline" :class="rarityClass(item.rarity)" @click.stop>
      {{ item.name }}
    </NuxtLink>
    <p v-if="line || item.andromeda" class="mt-px flex flex-wrap items-center gap-2 text-[0.78125rem]/4 text-muted">
      <span v-if="line">{{ line }}</span>
      <MeAndromedaChip v-if="item.andromeda" />
    </p>
  </div>
</template>
