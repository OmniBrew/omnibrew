<script setup lang="ts">
/** An item's weight in the reader's units ("8kg"), "-" when it has none. */
const props = defineProps<{ pounds?: number }>()
const { weight } = useUnits()
const text = computed(() => itemWeight(props.pounds, weight))
</script>

<template>
  <span class="whitespace-nowrap">{{ text }}</span>
</template>
