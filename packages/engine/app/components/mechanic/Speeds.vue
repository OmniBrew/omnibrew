<script setup lang="ts">
/**
 * A record's speeds as the species trait reads ("Your base walking speed is 9
 * meters."), in the reader's units, after an optional lead-in (`prefix`, a
 * species' flavor text about its speed).
 */
const props = defineProps<{
  mechanics?: unknown
  prefix?: string | null
}>()

const { t } = useI18n()
const { distance } = useUnits()
const text = computed(() => [props.prefix, ...summarizeSpeeds(t, props.mechanics, feet => distance(feet), true)].filter(Boolean).join(' '))
</script>

<template>
  <span>{{ text }}</span>
</template>
