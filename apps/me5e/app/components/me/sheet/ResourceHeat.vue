<script setup lang="ts">
/**
 * Weapon heat (the live MeCsActionResourceDisplayHeat): Fire adds the weapon's heat use,
 * Reload clears it and spends a ready thermal clip when clips are enforced (vented
 * weapons need none).
 */
import { actions, type Rec } from '@omnibrew/engine/rules'

const props = defineProps<{ id: string, resource: Rec, current: number, max: number, editable: boolean }>()
const emit = defineEmits<{ add: [], reset: [] }>()

const { t } = useI18n()
const { sheet, character, apply } = useSheet()
const pct = computed(() => (props.max ? Math.min(100, (props.current / props.max) * 100) : 0))

function reload() {
  const enforce = (character.value.options.game as Record<string, boolean>).thermalClips
  const clip = sheet.value.equipment.gear.find(g => g.data.id === 'thermal-clip' && (g.entry.equippedAmount ?? 0) > 0)
  if (enforce && clip && props.current > 0 && !props.resource.vented) {
    apply(s => actions.edit(s.character, (c) => {
      c.state.resources[props.id] = 0
      const e = c.equipment.find(x => x.uuid === clip.entry.uuid)!
      e.equippedAmount = Math.max(0, (e.equippedAmount ?? 0) - 1)
      e.uses = Math.max(0, (e.uses ?? 0) - 1)
    }))
    return
  }
  emit('reset')
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <div class="flex h-8 min-w-24 items-center gap-2 rounded-sm border border-default px-2 text-xs" :title="t('heat_title')">
      <span class="eyebrow text-muted">{{ t('heat_title') }}</span>
      <div class="h-1.5 w-12 overflow-hidden rounded-full bg-accented">
        <div class="h-full rounded-full bg-error" :style="{ width: `${pct}%` }" />
      </div>
      <span class="font-mono tabular-nums">{{ current }}/{{ max }}</span>
    </div>
    <UButton :label="t('sheet.me.fire')" size="xs" variant="outline" :disabled="!editable || current + Number(resource.increment ?? 1) > max" @click="emit('add')" />
    <UButton :label="t('sheet.me.reload')" size="xs" color="neutral" variant="ghost" :disabled="!editable || current === 0" @click="reload" />
  </div>
</template>
