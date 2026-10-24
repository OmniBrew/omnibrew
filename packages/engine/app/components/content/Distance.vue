<script setup lang="ts">
/**
 * MDC inline component for distances: `:distance{length="30" abbr}`.
 * Replaces the legacy `<me-distance length="30" abbr />` tag.
 */
const props = defineProps<{
  /** Feet. */
  length: number | string
  abbr?: boolean
  adj?: boolean
}>()

const { distance } = useUnits()
const text = computed(() => distance(Number(props.length), { abbr: props.abbr, adj: props.adj }))
</script>

<template>
  <span class="whitespace-nowrap">{{ text }}</span>
</template>
