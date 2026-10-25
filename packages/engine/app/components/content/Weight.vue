<script setup lang="ts">
/** MDC inline component for weights: `:weight{amount="55"}`, stored in pounds. */
const props = defineProps<{
  amount: number | string
  abbr?: boolean
  adj?: boolean
  numOnly?: boolean
  override?: string
}>()

const { weight } = useUnits()
const text = computed(() => weight(Number(props.amount), props))
</script>

<template>
  <span class="whitespace-nowrap">{{ text }}</span>
</template>
