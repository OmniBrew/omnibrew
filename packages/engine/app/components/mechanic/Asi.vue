<script setup lang="ts">
/**
 * A record's ability score increases as text ("+2 Charisma, +1 Constitution",
 * "+1 to your choice of Strength or Dexterity"), from its `asi` and
 * `asi-choice` mechanics. `text` (the content's own wording) wins when set.
 */
const props = defineProps<{
  mechanics?: unknown
  text?: string | null
}>()

const { t } = useI18n()
const summary = computed(() => props.text || summarizeAsi(t, props.mechanics))
</script>

<template>
  <span>{{ summary }}</span>
</template>
