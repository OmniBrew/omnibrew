<script setup lang="ts">
/** One line of a stat block: a bold label and its value ("Armor Class 14"). */
defineProps<{ label: string }>()
</script>

<template>
  <p>
    <span class="font-semibold text-highlighted">{{ label }}</span>{{ ' ' }}<slot />
  </p>
</template>
