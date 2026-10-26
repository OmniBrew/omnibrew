<script setup lang="ts">
/**
 * A weapon's properties and stats: damage, range and weight. The default slot
 * adds the game's own stats (ME5e: heat) as more `<StatItem>`s after range;
 * `hideProperties` leaves out the properties those stats show.
 */
import type { ItemDamage, ItemProperty, ItemRangeValue } from '../../utils/items'

defineProps<{
  weapon: { damage?: unknown, additionalDamage?: unknown[], range?: ItemRangeValue, weight?: number, properties?: unknown[] }
  hideProperties?: string[]
}>()
const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <ItemProperties :properties="weapon.properties as ItemProperty[]" :hide="hideProperties" />
    <dl class="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-default py-3 md:grid-cols-4 [&_dd]:font-mono [&_dd]:tabular-nums">
      <StatItem :label="t('damage_title')">
        {{ itemDamage(t, weapon.damage as ItemDamage, weapon.additionalDamage as ItemDamage[]) }}
      </StatItem>
      <StatItem :label="t('range_title')">
        <ItemRange :range="weapon.range" />
      </StatItem>
      <slot />
      <StatItem :label="t('weight_title')">
        <ItemWeight :pounds="weapon.weight" />
      </StatItem>
    </dl>
  </div>
</template>
