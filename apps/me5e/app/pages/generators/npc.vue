<script setup lang="ts">
/**
 * The NPC generator (the live /generators/npc): a disposable NPC for a challenge rating,
 * class and species, from the rules bundle (generators/npc.ts). `?bookmark=<id>` shows a
 * bookmarked NPC from this reader's bookmarks (signed in or out); NPCs bookmarked on the
 * live site are in its generator's shape and are converted first (fromLiveNpc).
 * Client-only (routeRules), prerendered as an empty shell.
 */
import { DAMAGE_FOCUSES, generateNpc, type DamageFocus, type GeneratedNpc } from '../../../generators/npc'
import { npcClassOptions, npcData, npcSpeciesOptions, type NpcData } from '../../../generators/npc-data'
import { fromLiveNpc } from '../../../generators/npc-live'
import { npcSheetRefs, type NpcSheetRefs } from '../../../generators/npc-sheet'
import { cryptoRandom } from '../../../generators/random'

const { t } = useI18n()
useSeoMeta({ title: t('npc_generator_title'), description: t('meta.npc_generator') })

const route = useRoute()
const router = useRouter()
const bookmarks = useBookmarks()

const status = ref<'loading' | 'ready' | 'error'>('loading')
const loaded = shallowRef<{ data: NpcData, refs: NpcSheetRefs }>()
async function load() {
  status.value = 'loading'
  try {
    const { records } = await useRules()
    loaded.value = { data: npcData(records), refs: npcSheetRefs(records) }
    status.value = 'ready'
  }
  catch {
    status.value = 'error'
  }
}
onMounted(() => {
  void load()
  bookmarks.load()
})

const RANDOM = 'random'
const random = () => ({ label: t('npc.generator.random'), value: RANDOM })
const cr = ref(RANDOM)
const klass = ref(RANDOM)
const species = ref(RANDOM)
const focus = ref(RANDOM)
const scale = ref(0)
const grenades = ref(true)
const traits = ref(true)
const showDetails = ref(false)
// Grenades as the damage priority needs grenades.
watch(focus, (f) => {
  if (f === 'grenades') grenades.value = true
})

const crItems = computed(() => [random(), ...(loaded.value?.data.stats ?? []).map(s => ({ label: s.cr, value: s.id }))])
const classItems = computed(() => [random(), ...(loaded.value ? npcClassOptions(loaded.value.data) : []).map(c => ({ label: c.name, value: c.id }))])
const speciesItems = computed(() => [random(), ...(loaded.value ? npcSpeciesOptions(loaded.value.data) : []).map(s => ({ label: s.name, value: s.id }))])
const focusItems = computed(() => [random(), ...DAMAGE_FOCUSES.map(f => ({ label: t(`npc.generator.focuses.${f}`), value: f }))])
const chosen = (v: string) => (v === RANDOM ? undefined : v)

const generated = shallowRef<GeneratedNpc>()
function generate() {
  if (!loaded.value) return
  generated.value = generateNpc(loaded.value.data, {
    cr: chosen(cr.value),
    klass: chosen(klass.value),
    species: chosen(species.value),
    offensiveScale: scale.value,
    grenades: grenades.value,
    traits: traits.value,
    damageFocus: chosen(focus.value) as DamageFocus | undefined,
  }, cryptoRandom()).npc
  if (bookmarkId.value) void router.replace({ query: {} })
}

// A bookmarked NPC (`?bookmark=`), from the bookmarks store.
const bookmarkId = computed(() => (typeof route.query.bookmark === 'string' ? route.query.bookmark : ''))
const bookmark = computed(() => bookmarks.items.find(b => b.type === 'genpc' && b.recordId === bookmarkId.value))
const bookmarked = computed<GeneratedNpc | undefined>(() => {
  const data = bookmark.value?.data as { npc?: Record<string, unknown>, format?: string } | undefined
  if (!data?.npc) return undefined
  const npc = cloneData(toRaw(data.npc))
  return data.format === 'live' ? fromLiveNpc(npc) : npc as unknown as GeneratedNpc
})
const bookmarksLoading = computed(() => bookmarks.status === 'idle' || bookmarks.status === 'loading')
// The bookmarked NPC stays on the page when its bookmark is removed, so it can be added back.
const viewed = shallowRef<{ id: string, npc: GeneratedNpc, data: unknown }>()
watch(bookmarked, (npc) => {
  if (npc) viewed.value = { id: bookmarkId.value, npc, data: cloneData(toRaw(bookmark.value!.data)) }
}, { immediate: true })
const viewedNpc = computed(() => (viewed.value?.id === bookmarkId.value ? viewed.value : undefined))

const shown = computed(() => (bookmarkId.value ? bookmarked.value ?? viewedNpc.value?.npc : generated.value))
// What the bookmark keeps: a bookmarked NPC keeps its own data; a new one is saved in the engine's shape.
const bookmarkData = computed(() => {
  const npc = shown.value
  if (!npc) return undefined
  if (bookmarkId.value && viewedNpc.value) return viewedNpc.value.data
  return { title: npc.name, to: `/generators/npc?bookmark=${encodeURIComponent(npc.id)}`, npc: cloneData(toRaw(npc)), format: 'engine' }
})
const shownId = computed(() => (bookmarkId.value ? bookmarkId.value : shown.value?.id ?? ''))
</script>

<template>
  <UPage>
    <RecordHeader :title="t('npc_generator_title')" :headline="t('generators_title')" />
    <UPageBody>
      <div class="space-y-3">
        <p>{{ t('npc.generator.intro') }}</p>
        <UCollapsible v-model:open="showDetails">
          <UButton variant="link" color="primary" class="px-0" :trailing-icon="showDetails ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" :label="showDetails ? t('npc.generator.hide_details') : t('npc.generator.show_details')" />
          <template #content>
            <ul class="mt-2 list-disc space-y-1 ps-5 text-sm">
              <li>{{ t('npc.generator.option_scale') }}</li>
              <li>{{ t('npc.generator.option_focus') }}</li>
              <li>{{ t('npc.generator.option_grenades') }}</li>
              <li>{{ t('npc.generator.option_traits') }}</li>
            </ul>
            <UAlert color="info" variant="subtle" icon="i-lucide-info" :description="t('npc.generator.traits_note')" class="mt-3" />
          </template>
        </UCollapsible>
      </div>

      <UAlert
        v-if="status === 'error'"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="t('npc.generator.load_failed')"
        :actions="[{ label: t('npc.generator.retry'), onClick: () => load() }]"
        class="mt-6"
      />

      <UCard variant="subtle" class="mt-6">
        <h2 class="eyebrow mb-3 text-muted">
          {{ t('npc.generator.options_title') }}
        </h2>
        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField :label="t('npc.cr_title')">
            <USelect v-model="cr" :items="crItems" :disabled="status !== 'ready'" class="w-full" />
          </UFormField>
          <UFormField :label="t('class_title', 1)">
            <USelect v-model="klass" :items="classItems" :disabled="status !== 'ready'" class="w-full" />
          </UFormField>
          <UFormField :label="t('species_title', 1)">
            <USelect v-model="species" :items="speciesItems" :disabled="status !== 'ready'" class="w-full" />
          </UFormField>
        </div>
        <UFormField :label="t('npc.generator.scale')" class="mt-5">
          <USlider v-model="scale" :min="-2" :max="2" :step="1" :aria-label="t('npc.generator.scale')" class="mt-2" />
          <div class="mt-1.5 flex justify-between text-sm text-muted">
            <span>{{ t('npc.generator.more_defensive') }}</span>
            <span>{{ t('npc.generator.more_offensive') }}</span>
          </div>
        </UFormField>
        <div class="mt-5 grid items-end gap-4 sm:grid-cols-3">
          <UFormField :label="t('npc.generator.focus')">
            <USelect v-model="focus" :items="focusItems" :disabled="status !== 'ready'" class="w-full" />
          </UFormField>
          <USwitch v-model="grenades" :label="t('npc.generator.grenades')" :disabled="focus === 'grenades'" class="sm:pb-2" />
          <USwitch v-model="traits" :label="t('npc.generator.traits')" class="sm:pb-2" />
        </div>
        <UButton
          block
          size="lg"
          icon="i-lucide-dices"
          :label="t('npc.generator.generate')"
          :loading="status === 'loading'"
          :disabled="status !== 'ready'"
          class="mt-6"
          data-generate
          @click="generate"
        />
      </UCard>

      <section class="mt-8" aria-live="polite">
        <div v-if="bookmarkId && (bookmarksLoading || status === 'loading')" class="flex justify-center py-12">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
        </div>
        <UEmpty
          v-else-if="bookmarkId && !shown"
          icon="i-lucide-bookmark-x"
          :title="t('npc.generator.bookmark_missing_title')"
          :description="t('npc.generator.bookmark_missing_text')"
          :actions="[{ label: t('bookmarks_title'), to: '/bookmarks', variant: 'outline' }]"
        />
        <template v-else-if="shown && loaded">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p class="eyebrow text-primary">
              {{ bookmarkId ? t('npc.generator.bookmarked') : t('npc.generator.generated') }}
            </p>
            <BookmarkButton :key="shownId" type="genpc" :record-id="shownId" :data="bookmarkData" />
          </div>
          <MeGeneratorsNpcSheet :npc="shown" :refs="loaded.refs" />
        </template>
        <p v-else-if="status === 'ready'" class="rounded-md border border-dashed border-default p-8 text-center text-muted">
          {{ t('npc.generator.empty') }}
        </p>
      </section>
    </UPageBody>
  </UPage>
</template>
