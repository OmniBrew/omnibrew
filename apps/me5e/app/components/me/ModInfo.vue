<script setup lang="ts">
/**
 * An ME5e armor or weapon mod: flavor text, where it goes and what it fits,
 * then its description. `summary` adds the rarity/type/cost line (list rows).
 */
defineProps<{
  mod: {
    name?: string
    rarity?: string
    modType?: string
    placement?: string
    availability?: string[]
    cost?: number | string
    author?: string
    flavor?: string
    image?: string
    body?: unknown
  }
  summary?: boolean
}>()
const { t } = useI18n()
</script>

<template>
  <ItemInfo :item="mod">
    <template v-if="summary" #summary>
      <ItemSubtitle :text="modSubtitle(t, mod)" :cost="mod.cost" :text-class="rarityClass(mod.rarity)" :author="mod.author" />
    </template>
    <template #stats>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <StatItem :label="t('mod_placement_title')">
          {{ mod.placement ? t(`mod_placements.${mod.placement}`) : '-' }}
        </StatItem>
        <StatItem :label="t('mod_availability_title')">
          {{ modAvailability(t, mod) }}
        </StatItem>
      </dl>
    </template>
  </ItemInfo>
</template>
