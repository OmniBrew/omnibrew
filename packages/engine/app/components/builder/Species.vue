<script setup lang="ts">
/**
 * The Species step (the live MeCbSpeciesSelect): pick a species, then one of its
 * variants or subspecies if it has them; Tasha's option turns the species' ability
 * increases into free picks. Then the species' traits and the choices they offer.
 */
import { actions, speciesTraits, type Rec } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet, character, apply } = useSheet()

const all = computed(() => sheet.value.content.list('species'))
const top = computed(() => all.value.filter(s => s.type !== 'variant' && s.type !== 'subspecies').sort((a, b) => String(a.name).localeCompare(String(b.name))))
const current = computed(() => sheet.value.species)
const parentId = computed(() => current.value?.parentId ?? (current.value && all.value.find(s => s.id === current.value!.id)?.species) ?? current.value?.id ?? null)
const children = computed(() => all.value.filter(s => (s.type === 'variant' || s.type === 'subspecies') && s.species === parentId.value))
const search = ref('')
const shown = computed(() => top.value.filter(s => !search.value || String(s.name).toLowerCase().includes(search.value.toLowerCase())))

const setSpecies = (id: string | null) => apply(s => actions.edit(s.character, (c) => {
  c.species = id
}))
const setTashas = (v: boolean) => apply(s => actions.edit(s.character, (c) => {
  c.options.tashas = v
}))
const traits = computed(() => speciesTraits(sheet.value))
const pick = (s: Rec) => setSpecies(s.id)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('builder.species.search')" class="min-w-48 flex-1" />
      <USwitch :model-value="character.options.tashas" :label="t('builder.species.tashas')" :description="t('builder.species.tashas_text')" @update:model-value="v => setTashas(!!v)" />
    </div>
    <ul class="grid max-h-80 gap-1.5 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4" role="listbox" :aria-label="t('species_title', 1)">
      <li v-for="s in shown" :key="s.id">
        <button
          type="button"
          role="option"
          :aria-selected="parentId === s.id"
          class="flex h-10 w-full items-center rounded-sm border px-3 text-start text-sm transition-colors"
          :class="parentId === s.id ? 'border-primary bg-primary/10 font-semibold text-highlighted' : 'border-default bg-default hover:bg-elevated'"
          @click="pick(s)"
        >
          {{ s.name }}
        </button>
      </li>
    </ul>

    <div v-if="children.length" class="flex flex-col gap-1.5">
      <span class="eyebrow text-muted">{{ t('builder.species.variants') }}</span>
      <div class="flex flex-wrap gap-1.5">
        <UButton :label="t('builder.species.base')" size="sm" :variant="current?.id === parentId ? 'soft' : 'outline'" :color="current?.id === parentId ? 'primary' : 'neutral'" @click="setSpecies(parentId)" />
        <UButton v-for="v in children" :key="v.id" :label="v.name" size="sm" :variant="current?.id === v.id ? 'soft' : 'outline'" :color="current?.id === v.id ? 'primary' : 'neutral'" @click="setSpecies(v.id)" />
      </div>
    </div>

    <template v-if="current">
      <h2 class="section-tick font-label text-base font-semibold text-highlighted">
        {{ current.name }}
      </h2>
      <SheetProse :id="current.id" collection="species" class="text-sm" />
      <details v-for="tr in traits" :key="tr.id" class="rounded-sm border border-default bg-default px-3 py-2 text-sm">
        <summary class="cursor-pointer font-semibold text-highlighted">
          {{ tr.name }}
        </summary>
        <SheetProse :id="tr.id" collection="traits" class="pt-1" />
      </details>
      <BuilderChoices :prefixes="['species/']" />
    </template>
  </div>
</template>
