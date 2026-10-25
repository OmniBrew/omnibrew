<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('species_title', 2), description: t('meta.species') })

/** The live page's sections, in its order. */
const GROUPS = ['primary', 'lesser_known', 'villainous', 'expanded', 'andromeda']

const { data: species } = await useAsyncData('species:list', () =>
  queryCollection('species').select('stem', 'path', 'name', 'type', 'group', 'galaxy', 'img', 'snippet').all(), { default: () => [] })
const sections = computed(() => speciesSections(species.value, GROUPS))
</script>

<template>
  <UPage>
    <RecordHeader :title="t('species_title', 2)" />
    <UPageBody>
      <section v-for="s in sections" :key="s.group" class="border-b border-default pb-8 last:border-0">
        <h2 class="mb-4 font-display text-2xl font-bold text-highlighted">
          {{ t(`species_groups.${s.group}`) }}
        </h2>
        <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <li v-for="sp in s.species" :key="sp.stem">
            <SpeciesCard :species="sp" :to="sp.path ?? `/species/${recordId(sp)}`">
              <template v-if="sp.galaxy === 'andromeda'" #badges>
                <MeAndromedaChip />
              </template>
            </SpeciesCard>
          </li>
        </ul>
      </section>
    </UPageBody>
  </UPage>
</template>
