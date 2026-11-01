<script setup lang="ts">
/** A consumable's count on its card (grenades, medi-gel): ready ones when slots are enforced, else all carried; Use spends one. */
import { actions, type SheetCard } from '@omnibrew/engine/rules'

const props = defineProps<{ id: string, card?: SheetCard, editable: boolean }>()
const { t } = useI18n()
const { sheet, character, apply } = useSheet()

const item = computed(() => {
  const uuid = props.card?.equipmentId as string | undefined
  return sheet.value.equipment.gear.find(g => (uuid ? g.entry.uuid === uuid : g.data.id === props.id))
})
const slotted = computed(() => {
  const o = character.value.options.game as Record<string, boolean>
  const type = item.value?.data.type
  return type === 'grenade' ? o.grenadeSlots : type === 'medi_gel' ? o.medigelSlots : false
})
const count = computed(() => (slotted.value ? item.value?.entry.equippedAmount ?? 0 : item.value?.entry.uses ?? 0))

function use() {
  const uuid = item.value?.entry.uuid
  if (!uuid || count.value <= 0) return
  apply(s => actions.edit(s.character, (c) => {
    const e = c.equipment.find(x => x.uuid === uuid)!
    e.uses = Math.max(0, (e.uses ?? 0) - 1)
    if (slotted.value) e.equippedAmount = Math.max(0, (e.equippedAmount ?? 0) - 1)
  }))
}
</script>

<template>
  <div v-if="item" class="flex items-center gap-1.5">
    <span class="font-mono text-sm tabular-nums text-highlighted">×{{ count }}</span>
    <UButton :label="t('sheet.me.use')" size="xs" variant="outline" :disabled="!editable || count <= 0" @click="use" />
  </div>
</template>
