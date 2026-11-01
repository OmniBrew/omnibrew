<script setup lang="ts">
/** Barrier ticks spent by a feature (the live MeCsActionResourceDisplayBarrierTicks): the ticks left as pips, Spend takes one. */
import { actions } from '@omnibrew/engine/rules'

defineProps<{ editable: boolean }>()
const { t } = useI18n()
const { sheet, apply } = useSheet()

const pool = computed(() => actions.vitalPools(sheet.value).find(p => p.id === 'barrier'))
const spend = () => pool.value && apply(s => actions.setPool(s, 'barrier', pool.value!.current - 1))
</script>

<template>
  <div v-if="pool" class="flex items-center gap-1.5">
    <span class="flex items-center gap-1" role="img" :aria-label="`${t('sheet.vitals.barrier')} ${pool.current}/${pool.max}`">
      <span v-for="n in pool.max" :key="n" class="size-2 rotate-45" :class="n <= pool.current ? ['bg-current', pool.color] : 'border border-accented'" />
    </span>
    <UButton :label="t('sheet.vitals.spend')" size="xs" variant="outline" :disabled="!editable || pool.current <= 0" @click="spend" />
  </div>
</template>
