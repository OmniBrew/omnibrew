<script setup lang="ts">
/** Switches the reader's unit system (metric or imperial) for every distance and weight: two segments, M and FT. */
import type { UnitSystem } from '../../stores/preferences'

const preferences = usePreferences()
const { t } = useI18n()
const options: UnitSystem[] = ['metric', 'imperial']

function choose(units: UnitSystem) {
  if (preferences.units !== units) preferences.toggleUnits()
}
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    icon="i-lucide-ruler"
    :aria-label="`${t('shell.switch_units')} (${t(`settings.${preferences.units}`)})`"
    class="min-[900px]:hidden"
    @click="preferences.toggleUnits()"
  />
  <div role="group" :aria-label="t('shell.switch_units')" class="hidden gap-0.5 rounded-md p-0.5 ring ring-accented ring-inset min-[900px]:inline-flex">
    <UButton
      v-for="u in options"
      :key="u"
      size="xs"
      color="neutral"
      :variant="preferences.units === u ? 'soft' : 'ghost'"
      :aria-pressed="preferences.units === u"
      :aria-label="t(`settings.${u}`)"
      class="h-6.5 px-2 text-xs uppercase tracking-[0.08em]"
      :class="preferences.units === u ? 'text-highlighted' : 'text-muted'"
      @click="choose(u)"
    >
      {{ t(`shell.units_abbr.${u}`) }}
    </UButton>
  </div>
</template>
