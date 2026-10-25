<script setup lang="ts">
/**
 * An ME5e class table: the engine's class table plus the columns of ME5e
 * mechanics (biotic barrier uses and ticks) and ME5e's names for power points
 * ("Tech Points", "Tech Point Limit"), as n7.world shows them.
 */
import type { ClassFeaturesCollectionItem, SubclassesCollectionItem } from '@nuxt/content'

defineProps<{
  progression: ClassProgression
  levels: { level?: number, profBonus?: number }[]
  features: ClassFeaturesCollectionItem[]
  subclasses: SubclassesCollectionItem[]
  klass: string
  subclassLabel: string
}>()

const ME_COLUMNS: MechanicColumns[] = [
  { type: 'me:barrier', columns: [
    { field: 'uses', label: 'class_feature_columns.barrier_uses', order: 10 },
    { field: 'ticks', label: 'class_feature_columns.barrier_ticks', order: 10 },
  ] },
  { type: 'powercasting-points', columns: [
    { field: 'points', label: 'class_feature_columns.tech_points', order: 20 },
    { field: 'limit', label: 'class_feature_columns.tech_point_limit', order: 20 },
  ] },
]
</script>

<template>
  <KlassTable
    :progression="progression"
    :levels="levels"
    :features="features"
    :subclasses="subclasses"
    :klass="klass"
    :subclass-label="subclassLabel"
    :mechanic-columns="ME_COLUMNS"
  />
</template>
