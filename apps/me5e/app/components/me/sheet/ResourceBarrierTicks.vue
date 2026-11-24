<script setup lang="ts">
/** Barrier ticks spent by a feature (the live MeCsActionResourceDisplayBarrierTicks): the ticks left as pips, Spend takes one. */
import { actions } from '@omnibrew/engine/rules'

const props = defineProps<{ editable: boolean, resource?: { increment?: number } }>()
const { t } = useI18n()
const { sheet, apply } = useSheet()

const pool = computed(() => actions.vitalPools(sheet.value).find(p => p.id === 'barrier'))
/** Ticks one use spends (Cabal Cloak 2, Heightened Power 3). */
const cost = computed(() => props.resource?.increment ?? 1)
const spend = () => pool.value && apply(s => actions.setPool(s, 'barrier', pool.value!.current - cost.value))
</script>

<template>
  <div v-if="pool" class="flex items-center gap-1.5">
    <span class="flex items-center gap-1" role="img" :aria-label="`${t('sheet.vitals.barrier')} ${pool.current}/${pool.max}`">
      <span v-for="n in pool.max" :key="n" class="size-2 rotate-45" :class="n <= pool.current ? ['bg-current', pool.color] : 'border border-accented'" />
    </span>
    <UButton :label="cost > 1 ? t('sheet.vitals.spend_n', { n: cost }) : t('sheet.vitals.spend')" size="xs" variant="outline" :disabled="!editable || pool.current < cost" @click="spend" />
  </div>
</template>
