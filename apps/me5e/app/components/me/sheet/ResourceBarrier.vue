<script setup lang="ts">
/** The Barrier action's uses (the live MeCsActionResourceDisplayBarrier): using it spends a use and fills the barrier ticks. */
import { actions } from '@omnibrew/engine/rules'

defineProps<{ editable: boolean }>()
const { t } = useI18n()
const { sheet, apply } = useSheet()

type Barrier = { ticks: { max: number, used: number }, uses: { max: number, used: number } }
const b = computed(() => sheet.value.section<Barrier>('barrier'))
const set = (used: number) => apply(s => actions.edit(s.character, (c) => {
  const g = c.state.game as { barrier: { used: number, ticksUsed: number } }
  if (used > g.barrier.used) g.barrier.ticksUsed = 0
  g.barrier.used = Math.max(0, Math.min(used, b.value.uses.max))
}))
</script>

<template>
  <div class="flex items-center gap-1.5">
    <UCheckbox
      v-for="n in b.uses.max"
      :key="n"
      :model-value="b.uses.used >= n"
      :disabled="!editable"
      :aria-label="t('sheet.resource.use_n', { n, max: b.uses.max })"
      @update:model-value="set(b.uses.used >= n ? n - 1 : n)"
    />
    <span class="text-xs text-muted">{{ t('sheet.resource.per_short') }}</span>
  </div>
</template>
