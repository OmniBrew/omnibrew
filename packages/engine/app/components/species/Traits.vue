<script setup lang="ts">
/**
 * A species' traits list: ability score increase, age, alignment, size and
 * speed from the species record, then its trait records. A variant passes its
 * species as `base`: its ability score increase and speed show only when they
 * differ. A trait that picks from an edge family lists the options under it.
 */
interface SpeciesFields {
  mechanics?: unknown
  abilityScoreIncrease?: string | null
  age?: string | null
  alignment?: string | null
  size?: string | null
  speedColor?: string | null
}
interface Trait { stem: string, name?: string | null, mechanics?: unknown, body?: unknown }

const props = withDefaults(defineProps<{
  species: SpeciesFields
  traits: Array<{ trait: Trait, anchor: boolean }>
  base?: SpeciesFields
  level?: 3 | 4 | 5
}>(), { base: undefined, level: 3 })

const { t } = useI18n()
const showAsi = computed(() => {
  const { species, base } = props
  const differs = !base || (species.abilityScoreIncrease ?? '') !== (base.abilityScoreIncrease ?? '') || !sameAsi(species.mechanics, base.mechanics)
  return differs && !!(species.abilityScoreIncrease || summarizeAsi(t, species.mechanics))
})
const showSpeed = computed(() => {
  const { species, base } = props
  const differs = !base || !sameSpeeds(species.mechanics, base.mechanics)
  return differs && !!(species.speedColor || mechanicsOfType(species.mechanics, 'speed', 'speed-note').length)
})
const facts = computed(() => ([['age_title', props.species.age], ['alignment_title', props.species.alignment], ['size_title', props.species.size]] as Array<[string, string | null | undefined]>)
  .filter((f): f is [string, string] => !!f[1]))
const choices = (trait: Trait) => mechanicsOfType(trait.mechanics, 'model-choice')
</script>

<template>
  <div class="space-y-5">
    <SpeciesTrait v-if="showAsi" :label="t('ability_score_increase_title')" :level="level">
      <MechanicAsi :mechanics="species.mechanics" :text="species.abilityScoreIncrease" />
    </SpeciesTrait>
    <SpeciesTrait v-for="[label, value] in facts" :key="label" :label="t(label)" :level="level">
      {{ value }}
    </SpeciesTrait>
    <SpeciesTrait v-if="showSpeed" :label="t('speed_title')" :level="level">
      <MechanicSpeeds :mechanics="species.mechanics" :prefix="species.speedColor" />
    </SpeciesTrait>
    <SpeciesTrait
      v-for="{ trait, anchor } in traits"
      :key="trait.stem"
      :label="trait.name ?? ''"
      :anchor="anchor ? recordId(trait) : undefined"
      :level="level"
    >
      <ContentRenderer v-if="trait.body" :value="trait" />
      <MechanicModelChoice v-for="(m, i) in choices(trait)" :key="i" :mechanic="m" />
    </SpeciesTrait>
  </div>
</template>
