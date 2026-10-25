<script setup lang="ts">
/**
 * MDC inline component for conditions: `:condition{id="primed" sub="necrotic"}`.
 * `id` is a conditions record; `sub` a variant (a prime's damage type); `label` replaces the text.
 */
const props = defineProps<{
  id: string
  sub?: string
  label?: string
}>()

const text = computed(() => props.label || (props.sub ? `${props.id}: ${props.sub}` : props.id))
</script>

<template>
  <span class="font-medium text-primary">{{ text }}</span>
</template>
