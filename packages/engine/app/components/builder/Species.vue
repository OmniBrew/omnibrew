<script setup lang="ts">
/**
 * The Species step (the live MeCbSpeciesSelect): species as cards (picture, ability
 * score increases, summary), one click to pick; then the picked species with its
 * variants or subspecies, what it gives (ability scores, size, speed, traits, open),
 * its lore folded away, and the choices its traits offer. Tasha's option turns the
 * species' ability increases into free picks.
 */
import { actions, speciesTraits, type Rec } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet, character, apply } = useSheet()

const all = computed(() => sheet.value.content.list('species'))
const top = computed(() => all.value.filter(s => s.type !== 'variant' && s.type !== 'subspecies').sort((a, b) => String(a.name).localeCompare(String(b.name))))
const current = computed(() => sheet.value.species)
const parentId = computed(() => current.value?.parentId ?? (current.value && all.value.find(s => s.id === current.value!.id)?.species) ?? current.value?.id ?? null)
const parent = computed(() => (parentId.value ? sheet.value.content.get('species', parentId.value) : null))
const record = computed(() => (current.value ? sheet.value.content.get('species', current.value.id) : null))
const childrenOf = (id: string | null) => all.value.filter(s => (s.type === 'variant' || s.type === 'subspecies') && s.species === id)
const children = computed(() => childrenOf(parentId.value))
const search = ref('')
const shown = computed(() => top.value.filter(s => !search.value || String(s.name).toLowerCase().includes(search.value.toLowerCase())))

// The cards show until a species is picked; "Change species" brings them back.
const choosing = ref(!character.value.species)

const setSpecies = (id: string | null) => apply(s => actions.edit(s.character, (c) => {
  c.species = id
}))
const setTashas = (v: boolean) => apply(s => actions.edit(s.character, (c) => {
  c.options.tashas = v
}))
function pick(s: Rec) {
  if (parentId.value !== s.id) setSpecies(s.id)
  choosing.value = false
}

const picture = (s: Rec | null | undefined) => String(s?.thumbnail ?? s?.bodyImg ?? s?.img ?? '')
const asi = (s: Rec) => s.abilityScoreIncrease || summarizeAsi(t, s.mechanics)

// A variant states what it changes; the rest comes from its species.
const has = (s: Rec | null | undefined, ...types: string[]) => Boolean(s && mechanicsOfType(s.mechanics, ...types).length)
const asiFrom = computed(() => (record.value && (record.value.abilityScoreIncrease || has(record.value, 'asi', 'asi-choice')) ? record.value : parent.value))
const speedFrom = computed(() => (record.value && (record.value.speedColor || has(record.value, 'speed', 'speed-note')) ? record.value : parent.value))
const size = computed(() => record.value?.size ?? parent.value?.size)
const traits = computed(() => speciesTraits(sheet.value))
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="choosing || !current">
      <div class="flex flex-wrap items-center gap-3">
        <UInput v-model="search" icon="i-lucide-search" :placeholder="t('builder.species.search')" class="min-w-48 flex-1" />
        <UButton v-if="current" :label="t('builder.keep', { name: current.name })" color="neutral" variant="outline" @click="choosing = false" />
      </div>
      <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="listbox" :aria-label="t('species_title', 1)">
        <li v-for="s in shown" :key="s.id">
          <button
            type="button"
            role="option"
            :aria-selected="parentId === s.id"
            class="flex h-full w-full gap-3 rounded-md border p-2 text-start transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            :class="parentId === s.id ? 'border-primary bg-primary/10' : 'border-default bg-default hover:border-primary hover:bg-elevated'"
            @click="pick(s)"
          >
            <img v-if="picture(s)" :src="picture(s)" alt="" loading="lazy" class="size-16 shrink-0 rounded-sm bg-elevated object-cover object-top">
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="flex flex-wrap items-center gap-2">
                <span class="font-label text-base font-semibold text-highlighted">{{ s.name }}</span>
                <UBadge v-if="parentId === s.id" :label="t('builder.selected')" size="sm" variant="soft" />
              </span>
              <span v-if="asi(s)" class="text-xs font-semibold text-default">{{ asi(s) }}</span>
              <span v-if="s.snippet" class="line-clamp-2 text-xs text-muted">{{ s.snippet }}</span>
              <span v-if="childrenOf(s.id).length" class="text-xs text-muted">{{ t('builder.species.options', childrenOf(s.id).length) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </template>

    <template v-else>
      <div class="flex flex-wrap items-center gap-3 rounded-md border border-default bg-default p-3">
        <img v-if="picture(parent)" :src="picture(parent)" alt="" class="size-16 shrink-0 rounded-sm bg-elevated object-cover object-top">
        <div class="min-w-0 flex-1">
          <p v-if="current.id !== parentId" class="eyebrow text-muted">
            {{ current.name }}
          </p>
          <h2 class="font-display text-xl font-bold text-highlighted">
            {{ parent?.name ?? current.name }}
          </h2>
        </div>
        <UButton :label="t('builder.species.change')" icon="i-lucide-repeat" color="neutral" variant="outline" @click="choosing = true" />
      </div>

      <div v-if="children.length" class="flex flex-col gap-1.5">
        <span class="eyebrow text-muted">{{ t('builder.species.variants') }}</span>
        <div class="flex flex-wrap gap-1.5">
          <UButton :label="t('builder.species.base')" size="sm" :variant="current.id === parentId ? 'soft' : 'outline'" :color="current.id === parentId ? 'primary' : 'neutral'" @click="setSpecies(parentId)" />
          <UButton v-for="v in children" :key="v.id" :label="v.name" size="sm" :variant="current.id === v.id ? 'soft' : 'outline'" :color="current.id === v.id ? 'primary' : 'neutral'" @click="setSpecies(v.id)" />
        </div>
      </div>

      <section class="flex flex-col gap-4 rounded-md border border-default bg-default p-3 text-sm sm:p-4">
        <SpeciesTrait v-if="asiFrom" :label="t('ability_score_increase_title')">
          <MechanicAsi :mechanics="asiFrom.mechanics" :text="asiFrom.abilityScoreIncrease" />
          <USwitch :model-value="character.options.tashas" :label="t('builder.species.tashas')" :description="t('builder.species.tashas_text')" class="mt-2" @update:model-value="v => setTashas(!!v)" />
        </SpeciesTrait>
        <SpeciesTrait v-if="size" :label="t('size_title')">
          {{ size }}
        </SpeciesTrait>
        <SpeciesTrait v-if="speedFrom" :label="t('speed_title')">
          <MechanicSpeeds :mechanics="speedFrom.mechanics" :prefix="speedFrom.speedColor" />
        </SpeciesTrait>
        <SpeciesTrait v-for="tr in traits" :key="tr.id" :label="tr.name">
          <SheetProse :id="tr.id" collection="traits" :link="false" />
        </SpeciesTrait>
      </section>

      <BuilderChoices :prefixes="['species/']" />

      <details class="rounded-md border border-default bg-default px-3 py-2 text-sm">
        <summary class="cursor-pointer font-semibold text-highlighted">
          {{ t('builder.species.more', { name: parent?.name ?? current.name }) }}
        </summary>
        <SheetProse :id="parentId ?? current.id" collection="species" class="pt-2" />
      </details>
    </template>
  </div>
</template>
