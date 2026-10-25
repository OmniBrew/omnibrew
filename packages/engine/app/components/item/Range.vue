<script setup lang="ts">
/** A weapon's range in the reader's units: "24/72m", or "2m" for reach. */
import type { ItemRangeValue } from '../../utils/items'

const props = defineProps<{ range?: ItemRangeValue }>()
const { distance } = useUnits()
const text = computed(() => itemRange(props.range, distance))
</script>

<template>
  <span class="whitespace-nowrap">{{ text }}</span>
</template>
