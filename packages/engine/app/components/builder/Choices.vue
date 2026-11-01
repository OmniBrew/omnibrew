<script setup lang="ts">
/** The choices a builder step offers (rules/choices.ts), in source order; picks nested in picked records follow them. */
import { choiceView, choicesUnder } from '@omnibrew/engine/rules'

const props = defineProps<{ prefixes: string[], exclude?: string[] }>()
const { t, te } = useI18n()
const { sheet } = useSheet()

const labels = { weapon: (w: string) => (te(`weapon_types.${w}`) ? t(`weapon_types.${w}`, 2) : w), ability: (a: string) => t(`abilities.${a}.title`) }
const views = computed(() => choicesUnder(sheet.value, props.prefixes)
  .filter(p => !props.exclude?.some(x => p.path.startsWith(x)))
  .map(p => choiceView(sheet.value, p, labels))
  .filter(v => v.kind !== 'hidden'))
</script>

<template>
  <div v-if="views.length" class="flex flex-col gap-3">
    <BuilderChoice v-for="v in views" :key="v.point.path" :view="v" />
  </div>
</template>
