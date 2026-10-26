<script setup lang="ts">
/**
 * An ME5e armor piece or suit: flavor text, description, the set bonus of its
 * armor set, picture and Andromeda chip. `summary` adds the rarity/type/cost
 * line (list rows).
 */
defineProps<{
  armor: {
    name?: string
    rarity?: string
    armorType?: string
    coverage?: string
    slot?: string
    cost?: number | string
    author?: string
    andromeda?: boolean
    set?: string
    flavor?: string
    image?: string
    body?: unknown
  }
  summary?: boolean
}>()
const { t } = useI18n()
</script>

<template>
  <ItemInfo :item="armor">
    <template v-if="summary" #summary>
      <ItemSubtitle :text="armorSubtitle(t, armor)" :cost="armor.cost" :text-class="rarityClass(armor.rarity)" pip :author="armor.author" />
    </template>
    <MeArmorSetBonus v-if="armor.set" :set="armor.set" />
    <MeAndromedaChip v-if="armor.andromeda" />
  </ItemInfo>
</template>
