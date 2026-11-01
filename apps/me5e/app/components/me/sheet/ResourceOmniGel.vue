<script setup lang="ts">
/** Omni-gel carried (the live MeCsActionResourceDisplayOmniGel): one count across the character's omni-gel, kept on its first entry. */
import { actions } from '@omnibrew/engine/rules'

defineProps<{ editable: boolean }>()
const { t } = useI18n()
const { sheet, apply } = useSheet()

const gel = computed(() => sheet.value.equipment.gear.filter(g => g.data.id === 'omni-gel'))
const count = computed(() => gel.value.reduce((a, g) => a + (g.entry.uses ?? 0), 0))

function set(value: number) {
  const n = Math.max(0, Math.min(999, value))
  const first = gel.value[0]
  apply(s => (first ? actions.updateItem(s.character, first.entry.uuid, { uses: n - (count.value - (first.entry.uses ?? 0)) }) : actions.addItem(s.character, { id: 'omni-gel', kind: 'gear' }, { uses: n })))
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <UButton icon="i-lucide-minus" size="xs" color="neutral" variant="outline" :disabled="!editable || count <= 0" :aria-label="t('sheet.resource.less')" @click="set(count - 1)" />
    <span class="min-w-10 text-center font-mono text-sm tabular-nums text-highlighted">{{ count }}</span>
    <UButton icon="i-lucide-plus" size="xs" color="neutral" variant="outline" :disabled="!editable" :aria-label="t('sheet.resource.more')" @click="set(count + 1)" />
    <span class="text-xs text-muted">{{ t('sheet.me.omni_gel') }}</span>
  </div>
</template>
