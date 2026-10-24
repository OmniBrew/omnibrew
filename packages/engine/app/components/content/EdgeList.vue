<script setup lang="ts">
/**
 * MDC block component listing every edge of one type, with its description:
 *
 *   ::edge-list{type="commands"}
 *   ::
 */
const props = defineProps<{
  type: string
}>()

const { data: edges } = await useAsyncData(`edge-list:${props.type}`, () =>
  queryCollection('edges').where('type', '=', props.type).order('name', 'ASC').all(),
)
</script>

<template>
  <div class="my-4 space-y-3">
    <div v-for="edge in edges" :key="edge.path">
      <p class="font-semibold">
        {{ edge.name }}
      </p>
      <ContentRenderer :value="edge" />
    </div>
  </div>
</template>
