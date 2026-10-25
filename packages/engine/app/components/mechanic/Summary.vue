<script setup lang="ts">
/**
 * What a list of mechanics grants, one labelled line per kind: ability score
 * increases, speeds, senses, resistances, immunities and skills (see
 * summarizeMechanics). Renders nothing when none of them is there.
 */
const props = defineProps<{
  mechanics?: unknown
  /** A skill's name from its id; defaults to the id, capitalized. */
  skillName?: (id: string) => string
}>()

const { t } = useI18n()
const { distance } = useUnits()
const capitalize = (id: string) => id.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const lines = computed(() => summarizeMechanics(t, props.mechanics, feet => distance(feet), props.skillName ?? capitalize))
</script>

<template>
  <dl v-if="lines.length" class="space-y-1 text-sm">
    <div v-for="line in lines" :key="line.key">
      <dt class="inline font-semibold text-highlighted">
        {{ t(line.label) }}:
      </dt>
      <dd class="inline">
        {{ line.text }}
      </dd>
    </div>
  </dl>
</template>
