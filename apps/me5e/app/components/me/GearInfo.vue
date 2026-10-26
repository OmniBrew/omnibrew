<script setup lang="ts">
/**
 * An ME5e gear item: charges (heavy weapons), description (grenade and
 * medi-gel tables list their marks) and picture. `summary` adds the
 * rarity/type/cost line (list rows).
 */
defineProps<{
  gear: {
    name?: string
    rarity?: string
    gearType?: string
    subType?: string
    cost?: number | string
    weight?: number
    charges?: number
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
  <ItemInfo :item="gear">
    <template v-if="summary" #summary>
      <ItemSubtitle :text="gearSubtitle(t, gear)" :cost="gear.cost" :text-class="rarityClass(gear.rarity)" pip :author="gear.author" />
    </template>
    <template #stats>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <StatItem :label="t('weight_title')">
          <ItemWeight :pounds="gear.weight" />
        </StatItem>
        <StatItem v-if="gear.charges" :label="t('charges_title')">
          {{ gear.charges }}
        </StatItem>
      </dl>
    </template>
  </ItemInfo>
</template>
