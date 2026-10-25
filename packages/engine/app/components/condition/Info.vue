<script setup lang="ts">
/**
 * A condition's rules, plus its variants when it has some: `children` names an
 * edge type whose edges are listed after the text (ME5e's primed condition
 * lists its primer detonations).
 */
const props = defineProps<{
  condition: { stem: string, children?: string, body?: unknown }
}>()

const { data: children } = await useAsyncData(`condition-children:${recordId(props.condition)}`, () =>
  props.condition.children ? queryCollection('edges').where('type', '=', props.condition.children).order('name', 'ASC').all() : Promise.resolve([]), { default: () => [] })
</script>

<template>
  <div>
    <ContentRenderer :value="condition" />
    <div v-if="children.length" class="mt-4 space-y-3 text-sm">
      <div v-for="child in children" :key="child.path">
        <p class="font-semibold text-highlighted">
          {{ child.name }}
        </p>
        <ContentRenderer :value="child" />
      </div>
    </div>
  </div>
</template>
