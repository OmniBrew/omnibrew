<script setup lang="ts">
/** ME's defensive overrides (Settings & Overrides): shield capacity and regen typed over the source's, and which shield source counts. */
import { actions } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet, character, apply } = useSheet()

type Source = { id: string, name: string, capacity: number, regen: number }
const sources = computed(() => sheet.value.section<Source[]>('shieldSources'))
const shields = computed(() => sheet.value.section<{ max: number, regen: number, source: string }>('shields'))
const o = computed(() => character.value.overrides.game as { shields: number | null, regen: number | null, shieldSource?: string })
const set = (key: 'shields' | 'regen', v: unknown) => apply(s => actions.edit(s.character, (c) => {
  (c.overrides.game as Record<string, unknown>)[key] = v === null || v === undefined || v === '' ? null : Math.floor(Number(v)) || null
}))
const setSource = (v: string) => apply(s => actions.edit(s.character, (c) => {
  const g = c.overrides.game as Record<string, unknown>
  if (v) g.shieldSource = v
  else delete g.shieldSource
}))
</script>

<template>
  <div class="grid grid-cols-3 gap-3">
    <UFormField :label="t('sheet.me.shields_override')" :hint="String(shields.max)">
      <UInputNumber :model-value="o.shields ?? undefined" :min="0" :placeholder="t('sheet.settings.auto')" @update:model-value="v => set('shields', v)" />
    </UFormField>
    <UFormField :label="t('sheet.me.regen_override')" :hint="String(shields.regen)">
      <UInputNumber :model-value="o.regen ?? undefined" :min="0" :placeholder="t('sheet.settings.auto')" @update:model-value="v => set('regen', v)" />
    </UFormField>
    <UFormField :label="t('sheet.me.shield_source')">
      <USelect
        :model-value="o.shieldSource ?? NONE"
        :items="[{ label: t('sheet.settings.auto'), value: NONE }, ...sources.map(s => ({ label: `${s.name} (${s.capacity}/${s.regen})`, value: s.id }))]"
        @update:model-value="v => setSource(fromSelect(v))"
      />
    </UFormField>
  </div>
</template>
