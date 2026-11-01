<script setup lang="ts">
/** Skills in three columns (one on phones): proficiency dot, name, ability, roll button. Advantage effects roll with it. */
import type { Rec } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet } = useSheet()
const rolls = useSheetRolls()

const skills = computed(() => {
  const records = sheet.value.content.list('skills')
  return Object.values(sheet.value.skills)
    .map(s => ({ ...s, ability: records.find(r => r.id === s.id)?.link as string | undefined }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

/** The skill's own advantage or disadvantage (both cancel). */
function skillMode(notes: Rec[]) {
  const adv = notes.some(n => n.effect?.type === 'advantage')
  const dis = notes.some(n => n.effect?.type === 'disadvantage')
  return adv && !dis ? 'advantage' : dis && !adv ? 'disadvantage' : null
}
</script>

<template>
  <SheetPanel :title="t('skills_title')">
    <template #actions>
      <span class="flex items-center gap-3 text-xs text-muted max-sm:hidden">
        <span class="flex items-center gap-1"><SheetProfDot :level="1" />{{ t('sheet.proficiency.1') }}</span>
        <span class="flex items-center gap-1"><SheetProfDot :level="2" />{{ t('sheet.proficiency.2') }}</span>
      </span>
    </template>
    <ul class="grid gap-x-6 gap-y-1 md:grid-flow-col md:grid-cols-3" :style="{ gridTemplateRows: `repeat(${Math.ceil(skills.length / 3)}, auto)` }">
      <li v-for="s in skills" :key="s.id" class="flex min-h-8 items-center gap-2 text-sm" :data-sheet="`skills.${s.id}`">
        <SheetProfDot :level="s.expertise ? 2 : s.proficient ? 1 : 0" />
        <span class="min-w-0 flex-1 truncate">{{ s.name }} <span v-if="s.ability" class="text-xs text-muted">{{ t(`abilities.${s.ability}.abbr`) }}</span></span>
        <UIcon v-if="skillMode(s.notes)" :name="skillMode(s.notes) === 'advantage' ? 'i-lucide-chevrons-up' : 'i-lucide-chevrons-down'" class="size-4 text-muted" :title="t(`sheet.roll.${skillMode(s.notes)}`)" />
        <SheetRollButton :label="t('sheet.roll.check_of', { ability: s.name })" :value="signed(s.mod)" @roll="mode => rolls.check(s.name, s.mod, 'skill', mode ?? skillMode(s.notes))" />
      </li>
    </ul>
  </SheetPanel>
</template>
