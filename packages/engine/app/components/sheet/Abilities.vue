<script setup lang="ts">
/** The six abilities: modifier (rolls a check) over the score, or the reverse with the "scores on top" preference. */
import { ABILITY_KEYS } from '@omnibrew/engine/character'

const { t } = useI18n()
const { sheet, character } = useSheet()
const rolls = useSheetRolls()

const scoreOnTop = computed(() => character.value.options.abilityScoreOnTop)
const rows = computed(() => ABILITY_KEYS.map((key) => {
  const a = sheet.value.abilities[key]
  return { key, mod: a?.mod ?? 0, total: a?.total ?? null }
}))
</script>

<template>
  <div class="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
    <SheetPanel v-for="a in rows" :key="a.key" class="flex flex-col items-center gap-1 !px-2 text-center" :data-sheet="`abilities.${a.key}`">
      <h2 class="eyebrow text-muted">
        <abbr :title="t(`abilities.${a.key}.title`)" class="no-underline">{{ t(`abilities.${a.key}.abbr`) }}</abbr>
      </h2>
      <SheetRollButton
        :label="t('sheet.roll.check_of', { ability: t(`abilities.${a.key}.title`) })"
        :value="scoreOnTop ? String(a.total ?? '–') : signed(a.mod)"
        class="!h-10 !min-w-16 !border-transparent !bg-transparent text-2xl hover:!border-primary"
        @roll="mode => rolls.check(t(`abilities.${a.key}.title`), a.mod, 'check', mode)"
      />
      <span class="rounded-xs border border-default bg-default px-2 font-mono text-xs text-muted">{{ scoreOnTop ? signed(a.mod) : (a.total ?? '–') }}</span>
    </SheetPanel>
  </div>
</template>
