<script setup lang="ts">
/** Switches the reader's unit system (metric ↔ imperial) for every distance and weight. */
const preferences = usePreferences()
const { t } = useI18n()
const label = computed(() => t(preferences.units === 'metric' ? 'settings.metric' : 'settings.imperial'))
</script>

<template>
  <UTooltip :text="t('shell.switch_units')">
    <UButton
      color="neutral"
      variant="ghost"
      :label="label"
      icon="i-lucide-ruler"
      :aria-label="t('shell.switch_units')"
      @click="preferences.toggleUnits()"
    />
  </UTooltip>
</template>
