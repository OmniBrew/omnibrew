<script setup lang="ts">
/**
 * A species variant: its name and text, what it changes (ability scores and
 * speed only when they differ from `base`, the species, and the traits it
 * adds), and its own subspecies choice.
 */
interface Trait { stem: string, name?: string | null, mechanics?: unknown, body?: unknown }
interface Fields {
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
type Entry = { trait: Trait, anchor: boolean }

defineProps<{
  variant: {
    species: Fields
    traits: Entry[]
    group?: {
      record?: { name?: string | null, body?: unknown } | null
      shared: Entry[]
      options: Array<{ species: Fields, traits: Entry[] }>
    }
  }
  base: Fields
}>()
</script>

<template>
  <section :id="recordId(variant.species)" class="scroll-mt-24">
    <h2 class="font-display text-3xl font-bold text-highlighted">
      {{ variant.species.name }}
    </h2>
    <ContentRenderer v-if="variant.species.body" :value="variant.species" class="mt-2" />
    <SpeciesTraits :species="variant.species" :traits="variant.traits" :base="base" class="mt-4" />
    <template v-if="variant.group">
      <h3 v-if="variant.group.record?.name" class="mt-8 font-display text-2xl font-bold text-highlighted">
        {{ variant.group.record.name }}
      </h3>
      <SpeciesOptions :group="variant.group" :level="4" class="mt-2" />
    </template>
  </section>
</template>
