<script setup lang="ts">
/**
 * Rolls a random height and weight (and length) for a species, in the
 * reader's unit system, showing how each total was reached. Switching units
 * rolls again with that system's dice.
 */
import type { DimensionKind, RandomDimensions, RolledDimensions } from '../../utils/dimensions'

const props = defineProps<{
  species: Array<{ stem: string, name?: string | null, randomDimensions?: RandomDimensions | null }>
}>()

const { t } = useI18n()
const preferences = usePreferences()
const system = computed(() => preferences.units)

const items = computed(() => props.species.filter(s => s.randomDimensions).map(s => ({ label: s.name ?? '', value: s.stem })))
const selected = ref(items.value[0]?.value)
const rolled = ref<RolledDimensions>()
const KINDS: DimensionKind[] = ['height', 'weight', 'length']
const titles: Record<DimensionKind, string> = { height: 'random_hw_titles.height', weight: 'random_hw_titles.weight', length: 'random_hw_titles.length' }

function roll() {
  const dims = props.species.find(s => s.stem === selected.value)?.randomDimensions
  rolled.value = dims ? rollDimensions(dims, system.value) : undefined
}
watch(selected, () => { rolled.value = undefined })
watch(system, () => { if (rolled.value) roll() })

const results = computed(() => KINDS.flatMap((kind) => {
  const r = rolled.value?.[kind]
  return r ? [{ kind, total: formatRolledDimension(t, kind, r, system.value), how: dimensionRollBreakdown(t, kind, r, system.value) }] : []
}))
</script>

<template>
  <UCard variant="subtle">
    <div class="flex flex-wrap items-end gap-3">
      <UFormField :label="t('species_title', 1)" class="min-w-48 flex-1 sm:flex-none">
        <USelect v-model="selected" :items="items" class="w-full sm:w-56" />
      </UFormField>
      <UButton icon="i-lucide-dices" :label="t('random_hw_titles.roll')" :disabled="!selected" @click="roll" />
    </div>
    <dl v-if="results.length" class="mt-4 grid gap-4 sm:grid-cols-3" aria-live="polite">
      <div v-for="r in results" :key="r.kind">
        <dt class="eyebrow text-muted">
          {{ t(titles[r.kind]) }}
        </dt>
        <dd class="mt-0.5">
          <span class="font-display text-2xl font-bold text-highlighted">{{ r.total }}</span>
          <span class="block text-xs text-muted">{{ r.how }}</span>
        </dd>
      </div>
    </dl>
  </UCard>
</template>
