<script setup lang="ts">
/**
 * A species: its background, traits, subspecies options and variants, in tabs.
 * A variant's or subspecies' URL (search results link to them, and to traits
 * as `/species/<record>#<trait>`) shows its species' page, then moves the
 * address there, keeping the anchor.
 */
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const slug = String(route.params.slug)

const { data: tree } = await useAsyncData('species:tree', () =>
  queryCollection('species').select('stem', 'path', 'name', 'type', 'species', 'subspecies', 'group').all(), { default: () => [] })
const rootId = pageSpeciesId(tree.value, slug)
if (!rootId) throw createError({ statusCode: 404, statusMessage: 'Species not found', fatal: true })

const family = speciesFamily(tree.value, rootId)
const groupIds = speciesGroupIds(tree.value, family)
const { data } = await useAsyncData(`species:${rootId}`, async () => {
  const [records, traits, groups] = await Promise.all([
    queryCollection('species').where('stem', 'IN', family.map(id => `species/${id}`)).all(),
    queryCollection('traits').orWhere(q => family.reduce((g, id) => g.where('species', 'LIKE', `%"${id}"%`), q)).all(),
    groupIds.length ? queryCollection('subspecies').where('stem', 'IN', groupIds.map(id => `subspecies/${id}`)).all() : Promise.resolve([]),
  ])
  return { records, traits, groups }
})
const page = computed(() => data.value ? speciesPage(rootId, data.value.records, data.value.traits, data.value.groups) : undefined)
if (!page.value) throw createError({ statusCode: 404, statusMessage: 'Species not found', fatal: true })

const species = computed(() => page.value!.species)
useSeoMeta({ title: species.value.name, description: species.value.snippet || t('meta.info', { name: species.value.name }) })
// A variant's or subspecies' address is a copy of its species' page.
const { game } = useAppConfig()
if (slug !== rootId) useHead({ link: [{ rel: 'canonical', href: `${game.siteUrl ?? ''}/species/${rootId}` }] })

const menu = computed(() => [speciesSections(tree.value, []).flatMap(s => s.species)
  .sort((a, b) => String(a.name).localeCompare(String(b.name)))
  .map(s => ({ label: s.name ?? '', to: s.path, active: recordId(s) === rootId }))])

const tabs = computed(() => [
  { label: t('background_title', 1), value: 'background', slot: 'background' as const },
  { label: t('traits_title'), value: 'traits', slot: 'traits' as const },
  ...(page.value?.group ? [{ label: page.value.group.record?.name ?? '', value: 'subspecies', slot: 'subspecies' as const }] : []),
  ...(page.value?.variants.length ? [{ label: t('variants_title'), value: 'variants', slot: 'variants' as const }] : []),
])
function anchorOf(hash: string) {
  try {
    return decodeURIComponent(hash.replace(/^#/, ''))
  }
  catch {
    return ''
  }
}
// The server never sees the anchor: a page rendered there opens on its background and
// switches once mounted; one rendered in the browser opens on the anchor's tab at once,
// so the router's own scroll to the anchor finds it.
const nuxtApp = useNuxtApp()
const tab = ref<string>((import.meta.client && !nuxtApp.isHydrating && page.value?.tabs[anchorOf(route.hash)]) || 'background')

/** Opens the tab holding the anchored record and scrolls to it. */
async function reveal(hash: string) {
  const id = anchorOf(hash)
  const target = page.value?.tabs[id]
  if (!target) return
  tab.value = target
  // The tab panel shows a tick or two after the model changes: scroll once Vue is done.
  await nextTick()
  setTimeout(() => document.querySelector(`[data-tab="${target}"] [id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'start' }))
}

onMounted(() => {
  if (slug !== rootId) router.replace({ path: `/species/${rootId}`, hash: route.hash || `#${slug}` })
  // After hydration, once the router has made its own (failed) attempt at the hidden anchor.
  else onNuxtReady(() => reveal(route.hash))
})
watch(() => route.hash, reveal)
</script>

<template>
  <UPage v-if="page">
    <template #right>
      <UPageAside :ui="{ root: 'lg:pe-0' }">
        <UDropdownMenu :items="menu" :content="{ align: 'end' }" :ui="{ content: 'max-h-96' }">
          <UButton color="secondary" :label="t('buttons.change_species')" trailing-icon="i-lucide-chevron-down" block />
        </UDropdownMenu>
        <img v-if="species.bodyImg" :src="species.bodyImg" :alt="species.name" class="mt-4 max-h-[80vh] w-full object-contain">
      </UPageAside>
    </template>

    <RecordHeader
      :title="species.name ?? ''"
      :headline="t('species_title', 1)"
      :author="species.author"
      :links="[{ label: t('species_title', 2), icon: 'i-lucide-arrow-left', to: '/species', variant: 'ghost' }]"
    >
      <MeAndromedaChip v-if="species.galaxy === 'andromeda'" class="mt-2" />
    </RecordHeader>
    <UPageBody>
      <UTabs v-model="tab" :items="tabs" :unmount-on-hide="false" variant="link" class="w-full" :ui="{ list: 'overflow-x-auto overflow-y-hidden', indicator: 'bottom-0', trigger: 'shrink-0', content: 'pt-4' }">
        <template #background>
          <div data-tab="background">
            <ContentRenderer :value="species" />
            <UButton
              :to="`https://masseffect.fandom.com/wiki/${encodeURIComponent((species.name ?? '').replaceAll(' ', '_'))}`"
              target="_blank"
              color="secondary"
              trailing-icon="i-lucide-chevron-right"
              :label="t('buttons.read_more')"
              class="mt-4"
            />
          </div>
        </template>
        <template #traits>
          <div data-tab="traits">
            <SpeciesTraits :species="species" :traits="page.traits" />
          </div>
        </template>
        <template #subspecies>
          <div v-if="page.group" data-tab="subspecies">
            <SpeciesOptions :group="page.group" />
          </div>
        </template>
        <template #variants>
          <div data-tab="variants" class="space-y-10">
            <SpeciesVariant v-for="v in page.variants" :key="v.species.stem" :variant="v" :base="species" />
          </div>
        </template>
      </UTabs>
    </UPageBody>
  </UPage>
</template>
