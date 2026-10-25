<script setup lang="ts" generic="T extends ClassFeatureLike">
/**
 * A class's features, or one subclass's, in level order: each feature's name
 * and description, plus the ability score increase for a class list (pass the
 * class's `abi` levels). `level` narrows it to one level (the class table's
 * level dialog, which also turns off the anchors so ids stay unique).
 */
import type { ClassFeatureLike } from '../../utils/progression'

const props = withDefaults(defineProps<{
  features: T[]
  subclass?: string
  level?: number
  /** The class's ability score increase levels (class lists only). */
  abi?: number[]
  /** The class's id, for the ability score increase's anchor. */
  klass?: string
  size?: 'md' | 'sm'
  rule?: 'accent' | 'muted'
  /** Give each feature its record id as an anchor. */
  anchors?: boolean
}>(), { subclass: undefined, level: undefined, abi: () => [], klass: '', size: 'md', rule: 'accent', anchors: true })

const { t } = useI18n()
const entries = computed(() => classFeatureEntries(props.features, { subclass: props.subclass, level: props.level, abi: props.abi, klass: props.klass }))
</script>

<template>
  <div>
    <KlassFeature
      v-for="(entry, i) in entries"
      :id="anchors ? entry.id : undefined"
      :key="entry.id"
      :title="entry.feature?.name ?? t('ability_score_increase_title')"
      :size="size"
      :rule="i < entries.length - 1 ? rule : false"
    >
      <ContentRenderer v-if="entry.feature" :value="entry.feature" />
      <template v-else-if="entry.abi">
        <ProseP>{{ abiText(t, entry.abi) }}</ProseP>
        <ProseP>{{ t('abi_feature.feat_text') }}</ProseP>
      </template>
    </KlassFeature>
  </div>
</template>
