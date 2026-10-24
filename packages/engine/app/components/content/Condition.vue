<script setup lang="ts">
/**
 * MDC inline component for conditions: `:condition{id="primed" sub="necrotic"}`.
 * Replaces the legacy `<me-condition id="primed" sub="necrotic" />` tag.
 */
defineProps<{
  id: string
  /** Variant, e.g. the damage type of a prime. */
  sub?: string
}>()
</script>

<template>
  <span class="font-medium text-primary">{{ id }}<template v-if="sub"> ({{ sub }})</template></span>
</template>
