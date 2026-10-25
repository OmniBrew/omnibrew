<script setup lang="ts" generic="S extends { stem?: string, name?: string, author?: string }, T extends ClassFeatureLike">
/**
 * A class's subclasses, each with its name, homebrew author, description
 * (`flavor`) and features. `filter` adds a menu to show one subclass; `level`
 * shows only that level's features (the class table's level dialog).
 */
import type { ClassFeatureLike } from '../../utils/progression'

const props = withDefaults(defineProps<{
  subclasses: S[]
  /** The class's features; each subclass shows those whose `subclass` is its id. */
  features: T[]
  level?: number
  flavor?: boolean
  filter?: boolean
  anchors?: boolean
}>(), { level: undefined, flavor: false, filter: false, anchors: true })

const { t } = useI18n()
const route = useRoute()
const ALL = 'all'
const chosen = ref(ALL)
const options = computed(() => [
  { label: t('all_title'), value: ALL },
  ...props.subclasses.map(s => ({ label: s.name ?? recordId(s), value: recordId(s) })),
])
// One level's view leaves out subclasses with nothing at that level.
const shown = computed(() => props.subclasses.filter(s => (chosen.value === ALL || recordId(s) === chosen.value)
  && (props.level === undefined || classFeatureEntries(props.features, { subclass: recordId(s), level: props.level }).length)))

// A link to one subclass's section shows them all again, so the target isn't filtered out.
watch(() => route.hash, () => {
  chosen.value = ALL
})
</script>

<template>
  <div>
    <div v-if="filter && subclasses.length > 1" class="mb-6 flex justify-end">
      <USelect v-model="chosen" :items="options" :aria-label="t('choose_subclass')" class="w-full sm:w-64" />
    </div>
    <KlassFeature
      v-for="(subclass, i) in shown"
      :id="anchors ? recordId(subclass) : undefined"
      :key="recordId(subclass)"
      size="lg"
      :rule="i < shown.length - 1 ? 'accent' : false"
    >
      <template #title>
        <h2 class="font-display text-3xl font-semibold text-highlighted">
          {{ subclass.name }}
        </h2>
        <p v-if="subclass.author" class="text-sm italic text-primary">
          by {{ subclass.author }}
        </p>
      </template>
      <ContentRenderer v-if="flavor" :value="subclass" class="mb-4" />
      <KlassFeatureList
        :features="features"
        :subclass="recordId(subclass)"
        :level="level"
        size="sm"
        rule="muted"
        :anchors="anchors"
        class="mt-4 border-s-2 border-default ps-4"
      />
    </KlassFeature>
  </div>
</template>
