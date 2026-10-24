<script setup lang="ts">
/**
 * MDC inline component for distances: `:distance{length="30"}`, stored in feet.
 * `large` reads the value as miles, `tiny` as inches; see useUnits for the rest.
 */
const props = defineProps<{
  length: number | string
  abbr?: boolean
  adj?: boolean
  large?: boolean
  tiny?: boolean
  numOnly?: boolean
  override?: string
  textIf?: 'imperial' | 'metric'
}>()

const { distance } = useUnits()
const text = computed(() => distance(Number(props.length), props))
</script>

<template>
  <span class="whitespace-nowrap">{{ text }}</span>
</template>
