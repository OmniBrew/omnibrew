<script setup lang="ts">
/** Saving throws, two columns, each with its proficiency dot and roll button. */
import { ABILITY_KEYS } from '@omnibrew/engine/character'

const { t } = useI18n()
const { sheet } = useSheet()
const rolls = useSheetRolls()
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
        <SheetRollButton
          :label="t('sheet.roll.save_of', { ability: t(`abilities.${key}.title`) })"
          :value="signed(sheet.saves[key]?.mod ?? 0)"
          @roll="mode => rolls.check(t(`abilities.${key}.title`), sheet.saves[key]?.mod ?? 0, 'save', mode)"
        />
      </li>
    </ul>
  </SheetPanel>
</template>
