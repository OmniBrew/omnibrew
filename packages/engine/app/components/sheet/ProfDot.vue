<script setup lang="ts">
/**
 * Proficiency without color (design notes): a hollow ring, a filled primary dot when
 * proficient, a ringed dot for expertise.
 */
const props = defineProps<{ level: 0 | 1 | 2 }>()
const { t } = useI18n()
</script>

<template>
  <span class="inline-flex size-3 shrink-0 items-center justify-center" :title="t(`sheet.proficiency.${props.level}`)">
    <span v-if="props.level === 2" class="flex size-3 items-center justify-center rounded-full ring-1 ring-primary"><span class="size-1.5 rounded-full bg-primary" /></span>
    <span v-else-if="props.level === 1" class="size-2 rounded-full bg-primary" />
    <span v-else class="size-2 rounded-full border border-accented" />
    <span class="sr-only">{{ t(`sheet.proficiency.${props.level}`) }}</span>
  </span>
</template>
