<script setup lang="ts">
/**
 * Saving throws, two columns, each with its proficiency dot and roll button. A save with
 * advantage or disadvantage shows it (with the effect's note) and rolls with it; saves
 * "against" conditions and other effects are listed underneath, as the live sheet did.
 */
import { ABILITY_KEYS } from '@omnibrew/engine/character'
import type { Rec } from '@omnibrew/engine/rules'

const { t, locale } = useI18n()
const { game } = useAppConfig()
const { sheet } = useSheet()
const rolls = useSheetRolls()

/** The save's own advantage or disadvantage (both cancel). */
function saveMode(notes: Rec[] = []) {
  const adv = notes.some(n => n.effect?.type === 'advantage')
  const dis = notes.some(n => n.effect?.type === 'disadvantage')
  return adv && !dis ? 'advantage' : dis && !adv ? 'disadvantage' : null
}
const modeTitle = (key: string) => {
  const notes = sheet.value.saves[key]?.notes ?? []
  const mode = saveMode(notes)
  if (!mode) return ''
  const said = notes.map(n => n.effect?.note ?? n.note).filter(Boolean)
  return [t(`sheet.roll.${mode}`), ...said].join(': ')
}

const conditionName = (id: string) => (sheet.value.content.get(game.sheet.conditions, id)?.name ?? id).toLowerCase()
const orList = (ids: string[]) => new Intl.ListFormat(locale.value, { type: 'disjunction' }).format(ids.map(conditionName))
const lines = computed(() => {
  const n = sheet.value.saveNotes
  return [
    ...(n.advantageAgainst.length ? [{ type: 'advantage', text: t('sheet.saves.advantage_against', { list: orList(n.advantageAgainst) }) }] : []),
    ...n.notes.filter(x => x.type === 'advantage').map(x => ({ type: 'advantage', text: t('sheet.saves.advantage_note', { note: x.note }) })),
    ...(n.disadvantageAgainst.length ? [{ type: 'disadvantage', text: t('sheet.saves.disadvantage_against', { list: orList(n.disadvantageAgainst) }) }] : []),
    ...n.notes.filter(x => x.type === 'disadvantage').map(x => ({ type: 'disadvantage', text: t('sheet.saves.disadvantage_note', { note: x.note }) })),
  ]
})
</script>

<template>
  <SheetPanel :title="t('saving_throws_title')">
    <ul class="grid grid-flow-col grid-cols-2 grid-rows-3 gap-x-6 gap-y-1">
      <li v-for="key in ABILITY_KEYS" :key="key" class="flex min-h-8 items-center gap-2 text-sm" :data-sheet="`saves.${key}`">
        <SheetProfDot :level="sheet.saves[key]?.proficient ? 1 : 0" />
        <span class="flex-1 truncate">
          <span class="max-sm:hidden">{{ t(`abilities.${key}.title`) }}</span>
          <span class="sm:hidden">{{ t(`abilities.${key}.abbr`) }}</span>
        </span>
        <UIcon v-if="saveMode(sheet.saves[key]?.notes)" :name="saveMode(sheet.saves[key]?.notes) === 'advantage' ? 'i-lucide-chevrons-up' : 'i-lucide-chevrons-down'" class="size-4 shrink-0 text-muted" :title="modeTitle(key)" :aria-label="modeTitle(key)" role="img" />
        <SheetRollButton
          :label="t('sheet.roll.save_of', { ability: t(`abilities.${key}.title`) })"
          :value="signed(sheet.saves[key]?.mod ?? 0)"
          @roll="mode => rolls.check(t(`abilities.${key}.title`), sheet.saves[key]?.mod ?? 0, 'save', mode ?? saveMode(sheet.saves[key]?.notes))"
        />
      </li>
    </ul>
    <ul v-if="lines.length" class="mt-2 flex flex-col gap-1 border-t border-default pt-2 text-xs text-muted" data-sheet="saves.notes">
      <li v-for="(line, i) in lines" :key="i" class="flex items-start gap-1.5">
        <UIcon :name="line.type === 'advantage' ? 'i-lucide-chevrons-up' : 'i-lucide-chevrons-down'" class="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <span>{{ line.text }}</span>
      </li>
    </ul>
  </SheetPanel>
</template>
