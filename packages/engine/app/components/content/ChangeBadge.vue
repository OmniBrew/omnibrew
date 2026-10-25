<script setup lang="ts">
/** MDC inline component that marks a heading as new or changed: `:change-badge{type="new"}`. */
defineProps<{
  type: 'new' | 'change'
}>()
</script>

<template>
  <UBadge :label="type" :color="type === 'new' ? 'info' : 'warning'" variant="subtle" size="sm" class="ml-2 align-middle" />
</template>
