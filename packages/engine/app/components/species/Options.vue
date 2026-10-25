<script setup lang="ts">
/**
 * A species' subspecies choice: the text introducing it (the `subspecies`
 * record), the traits most options share, then each option with its text and
 * traits list. Each option's element has its id, for links to it.
 */
interface Trait { stem: string, name?: string | null, mechanics?: unknown, body?: unknown }
interface Option {
  stem: string
  name?: string | null
  body?: unknown
  mechanics?: unknown
  abilityScoreIncrease?: string | null
  age?: string | null
  alignment?: string | null
  size?: string | null
  speedColor?: string | null
}

const props = withDefaults(defineProps<{
  group: {
    record?: { body?: unknown } | null
    shared: Array<{ trait: Trait, anchor: boolean }>
    options: Array<{ species: Option, traits: Array<{ trait: Trait, anchor: boolean }> }>
  }
  /** Heading level of the option names. */
  level?: 2 | 3 | 4
}>(), { level: 3 })
const traitLevel = computed(() => (props.level + 1) as 3 | 4 | 5)
</script>

<template>
  <div class="space-y-8">
    <div v-if="group.record?.body || group.shared.length">
      <ContentRenderer v-if="group.record?.body" :value="group.record" />
      <SpeciesTraits v-if="group.shared.length" :species="{}" :traits="group.shared" :level="traitLevel" class="mt-4" />
    </div>
    <section v-for="option in group.options" :id="recordId(option.species)" :key="option.species.stem" class="scroll-mt-24">
      <component :is="`h${level}`" class="border-b-2 border-primary pb-1 font-display font-semibold text-highlighted" :class="level === 4 ? 'text-xl' : 'text-2xl'">
        {{ option.species.name }}
      </component>
      <ContentRenderer v-if="option.species.body" :value="option.species" class="mt-3" />
      <SpeciesTraits :species="option.species" :traits="option.traits" :level="traitLevel" class="mt-4" />
    </section>
  </div>
</template>
