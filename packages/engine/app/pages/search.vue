<script setup lang="ts">
/** Full search results with group filters (the live site's /search). The query is kept in `?q=`. */
import type { SearchGroup } from '../types/site'

const { game } = useAppConfig()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { ready, load, search } = useSiteSearch()
const NuxtLink = resolveComponent('NuxtLink')

useSeoMeta({ title: t('search'), description: t('shell.search_description') })

const term = ref('')
const active = ref<string[]>([])
const shown = ref(25)
const groups = game.search as SearchGroup[]
const groupInfo = new Map(groups.map(g => [g.id, g]))

// The prerendered page has no query; read it once the page is live.
onMounted(() => {
  term.value = String(route.query.q ?? '')
  load()
})
watch(term, (q) => {
  shown.value = 25
  router.replace({ query: q ? { q } : {} })
})

const hits = computed(() => (ready.value ? search(term.value, active.value) : []))

function toggle(id: string) {
  active.value = active.value.includes(id) ? active.value.filter(g => g !== id) : [...active.value, id]
}
</script>

<template>
  <UPage>
    <UPageHeader :title="t('search')" />
    <UPageBody>
      <UInput
        v-model="term"
        icon="i-lucide-search"
        size="xl"
        :placeholder="t('shell.search_placeholder')"
        autofocus
        class="w-full"
      />
      <div class="mt-4 flex flex-wrap gap-2">
        <UButton
          v-for="g in groups"
          :key="g.id"
          :icon="g.icon"
          :label="t(g.label, 2)"
          :variant="active.includes(g.id) ? 'solid' : 'outline'"
          size="sm"
          @click="toggle(g.id)"
        />
      </div>

      <div v-if="!term.trim()" class="mt-10 text-center text-muted">
        {{ t('buttons.enter_search') }}
      </div>
      <div v-else-if="!ready" class="mt-10 flex justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
      </div>
      <div v-else-if="!hits.length" class="mt-10 text-center text-muted">
        {{ t('buttons.no_results') }}
      </div>
      <div v-else class="mt-6 space-y-3">
        <p class="text-sm text-muted">
          {{ t('shell.result_count', { n: hits.length }, hits.length) }}
        </p>
        <component
          :is="h.doc.to ? NuxtLink : 'div'"
          v-for="h in hits.slice(0, shown)"
          :key="h.doc.id"
          :to="h.doc.to"
          class="block rounded-md border border-default p-4 transition hover:bg-elevated"
        >
          <p class="flex flex-wrap items-center gap-1 text-xs font-medium uppercase tracking-wide text-primary">
            <UIcon :name="groupInfo.get(h.doc.group)?.icon ?? 'i-lucide-file'" class="size-3.5" />
            {{ t(groupInfo.get(h.doc.group)?.label ?? '', 1) }}
            <template v-if="h.doc.parent">
              <UIcon name="i-lucide-chevron-right" class="size-3" /> {{ h.doc.parent }}
            </template>
          </p>
          <p class="mt-1 font-label text-base font-semibold text-highlighted">
            {{ h.doc.title }}
          </p>
          <p class="mt-1 text-sm text-muted">
            {{ snippet(h.doc.text, h.terms) }}
          </p>
        </component>
        <UButton v-if="hits.length > shown" variant="ghost" :label="t('buttons.read_more')" block @click="shown += 25" />
      </div>
    </UPageBody>
  </UPage>
</template>
