<script setup lang="ts">
/**
 * An item's rarity-and-type line ("Uncommon Heavy Pistol") with its cost, and
 * the homebrew author. The game colors the line by rarity with `textClass`.
 */
defineProps<{
  text: string
  cost?: number | string | null
  textClass?: string
  author?: string | null
  /** A diamond pip before the text (a rarity's cue besides its color). */
  pip?: boolean
}>()
const { t } = useI18n()
</script>

<template>
  <p class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
    <span class="inline-flex items-center gap-1.5 eyebrow" :class="textClass"><span v-if="pip" class="size-1.5 shrink-0 rotate-45 bg-current" aria-hidden="true" />{{ text }}</span>
    <span v-if="cost" class="text-sm text-muted">{{ itemCredits(t, cost, t('digit_separator')) }}</span>
    <span v-if="author" class="text-sm italic text-muted">by {{ author }}</span>
  </p>
</template>
