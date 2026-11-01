<script setup lang="ts">
/**
 * Consumables carried (the live MeCsEquipmentConsumables): grenades, medi-gel and
 * thermal clips ready against the capacities the character's armor and features give,
 * when the slot rules are on (Preferences); and the shoulder mounts.
 */
import { actions } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet, character, editable, apply } = useSheet()

const caps = computed(() => sheet.value.section<{ grenades: number, mediGel: number, thermalClips: number, weaponSlots: number }>('capacities'))
const options = computed(() => character.value.options.game as Record<string, boolean>)

const kinds = computed(() => [
  { id: 'grenade', label: t('sheet.me.grenades'), on: options.value.grenadeSlots, max: caps.value.grenades, match: (type: string, id: string) => type === 'grenade' && id !== 'grenade' },
  { id: 'medi_gel', label: t('sheet.me.medi_gel'), on: options.value.medigelSlots, max: caps.value.mediGel, match: (type: string) => type === 'medi_gel' },
  { id: 'thermal_clip', label: t('sheet.me.thermal_clips'), on: options.value.thermalClips, max: caps.value.thermalClips, match: (_: string, id: string) => id === 'thermal-clip' },
].filter(k => k.on).map((k) => {
  const items = sheet.value.equipment.gear.filter(g => k.match(String(g.data.type), String(g.data.id)))
  return { ...k, items, ready: items.reduce((a, g) => a + (g.entry.equippedAmount ?? 0), 0) }
}).filter(k => k.items.length))

function ready(uuid: string, uses: number, current: number, room: number, delta: number) {
  const next = Math.max(0, Math.min(uses, current + delta, current + room))
  apply(s => actions.updateItem(s.character, uuid, { equippedAmount: next, equipped: next > 0 }))
}
</script>

<template>
  <div v-if="kinds.length" class="grid gap-3 sm:grid-cols-2">
    <SheetPanel v-for="k in kinds" :key="k.id" :title="`${k.label} ${k.ready}/${k.max}`">
      <ul class="flex flex-col gap-1 text-sm">
        <li v-for="g in k.items" :key="g.entry.uuid" class="flex items-center gap-2">
          <span class="flex-1 truncate">{{ g.data.name }} <span class="text-xs text-muted">×{{ g.entry.uses ?? 0 }}</span></span>
          <UButton icon="i-lucide-minus" size="xs" color="neutral" variant="outline" :disabled="!editable || !(g.entry.equippedAmount ?? 0)" :aria-label="t('sheet.me.unready', { name: g.data.name })" @click="ready(g.entry.uuid, g.entry.uses ?? 0, g.entry.equippedAmount ?? 0, k.max - k.ready, -1)" />
          <span class="w-6 text-center font-mono">{{ g.entry.equippedAmount ?? 0 }}</span>
          <UButton icon="i-lucide-plus" size="xs" color="neutral" variant="outline" :disabled="!editable || k.ready >= k.max || (g.entry.equippedAmount ?? 0) >= (g.entry.uses ?? 0)" :aria-label="t('sheet.me.ready', { name: g.data.name })" @click="ready(g.entry.uuid, g.entry.uses ?? 0, g.entry.equippedAmount ?? 0, k.max - k.ready, 1)" />
        </li>
      </ul>
    </SheetPanel>
  </div>
  <MeSheetShoulderMounts />
</template>
