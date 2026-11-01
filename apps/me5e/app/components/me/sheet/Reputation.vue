<script setup lang="ts">
/**
 * Reputation (the live MeCsReputation): paragon and renegade, and a benefit pick at
 * each threshold reached (`reputation/<threshold>/benefits`); a pick whose
 * prerequisite no longer holds is flagged.
 */
import { actions } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet, character, editable, apply } = useSheet()

type Threshold = { threshold: number, options: Array<{ id: string, name: string, available: boolean }>, selected: string | null, needsAttention: boolean }
const thresholds = computed(() => sheet.value.section<Threshold[]>('reputation'))
const state = computed(() => character.value.state.game as { paragon: number, renegade: number })
const MAX = 100

const setRep = (key: 'paragon' | 'renegade', v: unknown) => apply(s => actions.edit(s.character, (c) => {
  (c.state.game as Record<string, number>)[key] = Math.max(0, Math.floor(Number(v)) || 0)
}))
const pick = (threshold: number, id: string) => apply(s => actions.edit(s.character, (c) => {
  const path = `reputation/${threshold}/benefits`
  c.choices = c.choices.filter(x => x.path !== path)
  if (id) c.choices.push({ path, values: [id] })
}))
</script>

<template>
  <SheetPanel :title="t('sheet.me.reputation')">
    <div class="flex flex-col gap-3">
      <div v-for="key in ['paragon', 'renegade'] as const" :key="key" class="flex items-center gap-3">
        <img :src="`/images/misc/${key}.png`" alt="" class="size-7 shrink-0">
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2 text-sm">
            <span>{{ t(`sheet.me.${key}`) }}</span>
            <UInputNumber v-if="editable" :model-value="state[key] ?? 0" :min="0" size="xs" class="w-20" :ui="{ base: 'font-mono text-end' }" :aria-label="t(`sheet.me.${key}`)" @update:model-value="v => setRep(key, v)" />
            <span v-else class="font-mono">{{ state[key] ?? 0 }}</span>
          </div>
          <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-accented">
            <div class="h-full rounded-full" :class="key === 'paragon' ? 'bg-alliance-600 dark:bg-alliance-400' : 'bg-n7-600 dark:bg-n7-400'" :style="{ width: `${Math.min(100, ((state[key] ?? 0) / MAX) * 100)}%` }" />
          </div>
        </div>
      </div>
      <div v-for="th in thresholds" :key="th.threshold" class="flex flex-col gap-1 text-sm">
        <label :for="`rep-${th.threshold}`" class="flex items-center gap-1 text-xs text-muted">
          {{ t('sheet.me.benefit_at', { n: th.threshold }) }}
          <UIcon v-if="th.needsAttention" name="i-lucide-triangle-alert" class="size-3.5 text-warning" :title="t('sheet.me.benefit_attention')" />
        </label>
        <USelect
          :id="`rep-${th.threshold}`"
          :model-value="th.selected ?? NONE"
          :items="[{ label: t('sheet.me.choose_benefit'), value: NONE }, ...th.options.map(o => ({ label: o.available ? o.name : `${o.name} (${t('sheet.me.unavailable')})`, value: o.id, disabled: !o.available && o.id !== th.selected }))]"
          :disabled="!editable"
          size="sm"
          class="w-full"
          @update:model-value="v => pick(th.threshold, fromSelect(v))"
        />
      </div>
    </div>
  </SheetPanel>
</template>
