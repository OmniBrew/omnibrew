<script setup lang="ts">
/**
 * An ME5e weapon: the engine's weapon stats with heat (the `heat` property's
 * value, shown as a stat rather than a property), the description, picture and
 * Andromeda chip. `summary` adds the rarity/type/cost line (list rows).
 */
const props = defineProps<{
  weapon: {
    name?: string
    rarity?: string
    weaponType?: string
    cost?: number | string
    author?: string
    andromeda?: boolean
    damage?: unknown
    additionalDamage?: unknown[]
    range?: { short: number, long?: number }
    weight?: number
    properties?: unknown[]
    flavor?: string
    image?: string
    body?: unknown
  }
  summary?: boolean
}>()
const { t } = useI18n()
const heat = computed(() => weaponHeat(props.weapon))
</script>

<template>
  <ItemInfo :item="weapon">
    <template v-if="summary" #summary>
      <ItemSubtitle :text="weaponSubtitle(t, weapon)" :cost="weapon.cost" :text-class="rarityClass(weapon.rarity)" :author="weapon.author" />
    </template>
    <template #stats>
      <ItemWeaponStats :weapon="weapon" :hide-properties="['heat']">
        <StatItem :label="t('heat_title')">
          {{ heat ?? '-' }}
        </StatItem>
      </ItemWeaponStats>
    </template>
    <MeAndromedaChip v-if="weapon.andromeda" />
  </ItemInfo>
</template>
