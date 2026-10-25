<script setup lang="ts">
/**
 * The options of a `model-choice` mechanic that picks from an edge family
 * (`model` is an edge `type`, e.g. a trait's choice of lineage), in a collapsible
 * list with what each option grants. A choice of other records (powers,
 * feats) or of an unknown family renders nothing: the text describes those.
 */
interface Limit { attr: string, value: string | Array<string | number> }

const props = defineProps<{
  /** The `model-choice` mechanic: `model`, optional `limits` and `label`. */
  mechanic: Record<string, unknown>
}>()

const { t } = useI18n()
const model = computed(() => String(props.mechanic.model ?? ''))
const { data: edges } = await useAsyncData(`model-choice:${model.value}`, () =>
  queryRecords('edges').where('type', '=', model.value).order('name', 'ASC').all(), { default: () => [] })

/** `limits` keep the options whose field (`id`: the record id) is one of the values. */
const options = computed(() => {
  const limits = (Array.isArray(props.mechanic.limits) ? props.mechanic.limits : []) as Limit[]
  return edges.value.filter(edge => limits.every((limit) => {
    const value = limit.attr === 'id' ? recordId(edge) : edge[limit.attr]
    return [limit.value].flat().map(String).includes(String(value))
  }))
})
const open = ref(false)
</script>

<template>
  <UCollapsible v-if="options.length" v-model:open="open" class="mt-2">
    <UButton
      color="neutral"
      variant="subtle"
      size="sm"
      trailing-icon="i-lucide-chevron-down"
      :ui="{ trailingIcon: open ? 'rotate-180 transition-transform' : 'transition-transform' }"
      :label="typeof mechanic.label === 'string' && mechanic.label ? mechanic.label : t('mechanics.options', options.length)"
    />
    <template #content>
      <ul class="mt-3 grid gap-3 sm:grid-cols-2">
        <li v-for="edge in options" :key="edge.stem" class="rounded-md border border-default p-3">
          <p class="font-semibold text-highlighted">
            {{ edge.name }}
          </p>
          <MechanicSummary :mechanics="edge.mechanics" class="mt-1" />
        </li>
      </ul>
    </template>
  </UCollapsible>
</template>
