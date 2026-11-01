<script setup lang="ts">
/** Passive Perception, Investigation and Insight, then the senses the character has. */
const { t } = useI18n()
const { sheet } = useSheet()
const { distance } = useUnits()

const PASSIVE = [['perception', 'wis'], ['investigation', 'int'], ['insight', 'wis']] as const
const passives = computed(() => PASSIVE.map(([id, ability]) => ({ id, ability, value: sheet.value.skills[id]?.passive ?? 10, name: sheet.value.skills[id]?.name ?? id })))
const senses = computed(() => Object.entries(sheet.value.senses).filter(([, d]) => d > 0))
</script>

<template>
  <SheetPanel :title="t('senses_title')">
    <ul class="flex flex-col gap-1 text-sm">
      <li v-for="p in passives" :key="p.id" class="flex min-h-7 items-center gap-3" :data-sheet="`passive.${p.id}`">
        <span class="w-6 font-mono text-base font-semibold text-highlighted">{{ p.value }}</span>
        <span>{{ t('sheet.passive', { skill: p.name }) }} <span class="text-xs text-muted">{{ t(`abilities.${p.ability}.abbr`) }}</span></span>
      </li>
      <li v-for="[id, d] in senses" :key="id" class="flex min-h-7 items-center gap-3" :data-sheet="`senses.${id}`">
        <span class="font-mono text-sm font-semibold text-highlighted">{{ distance(d, { abbr: true }) }}</span>
        <span>{{ t(`senses.${id.replaceAll('-', '_')}_title`) }}</span>
      </li>
    </ul>
  </SheetPanel>
</template>
