<script setup lang="ts">
/**
 * The random height and weight table: each species' base height and weight
 * and their modifier dice, in the reader's unit system. A species with a
 * `length` (a long body) gets a second row for it.
 */
import type { RandomDimensions } from '../../utils/dimensions'

defineProps<{
  species: Array<{ stem: string, name?: string | null, randomDimensions?: RandomDimensions | null }>
}>()

const { t } = useI18n()
const preferences = usePreferences()
const system = computed(() => preferences.units)
const headers = computed(() => [
  t('species_title', 1),
  t('random_hw_titles.base_height'),
  t('random_hw_titles.height_mod'),
  t('random_hw_titles.base_weight'),
  t('random_hw_titles.weight_mod'),
])
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-default text-left">
          <th v-for="h in headers" :key="h" scope="col" class="px-2 py-2 eyebrow text-muted">
            {{ h }}
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="sp in species" :key="sp.stem">
          <tr v-if="sp.randomDimensions" class="border-b border-default/60">
            <th scope="row" class="px-2 py-2 text-left font-semibold text-highlighted">
              {{ sp.name }}
            </th>
            <td class="px-2 py-2 whitespace-nowrap">
              {{ sp.randomDimensions.height ? dimensionBase(t, sp.randomDimensions.height, 'height', system) : '-' }}
            </td>
            <td class="px-2 py-2 whitespace-nowrap">
              {{ sp.randomDimensions.height ? dimensionMod(t, sp.randomDimensions.height, system) : '-' }}
            </td>
            <td class="px-2 py-2 whitespace-nowrap">
              {{ sp.randomDimensions.weight ? dimensionBase(t, sp.randomDimensions.weight, 'weight', system) : '-' }}
            </td>
            <td class="px-2 py-2 whitespace-nowrap">
              {{ sp.randomDimensions.weight ? dimensionMod(t, sp.randomDimensions.weight, system) : '-' }}
            </td>
          </tr>
          <tr v-if="sp.randomDimensions?.length" class="border-b border-default/60">
            <th scope="row" class="px-2 py-2 pl-6 text-left font-normal italic text-muted">
              {{ t('random_hw_titles.length') }}
            </th>
            <td class="px-2 py-2 whitespace-nowrap">
              {{ dimensionBase(t, sp.randomDimensions.length, 'length', system) }}
            </td>
            <td class="px-2 py-2 whitespace-nowrap">
              {{ dimensionMod(t, sp.randomDimensions.length, system) }}
            </td>
            <td />
            <td />
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
