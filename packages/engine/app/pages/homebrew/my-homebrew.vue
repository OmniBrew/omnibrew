<script setup lang="ts">
/**
 * The player's homebrew (the live /homebrew/my-homebrew; plan/26 §1.1): My Creations (edit,
 * view, status, use) and My Collection (what the builder and sheet offer; remove from it).
 * Unlike live, your own creations need adding to the collection too, as live said; a
 * character keeps its copy when one leaves the collection (§1.4).
 */
import type { Homebrew } from '@omnibrew/engine/data'

const { t } = useI18n()
const session = useSession()
const library = useHomebrewLibrary()
const hb = useHomebrewRules()
const toast = useToast()

useSeoMeta({ title: t('homebrew.my_title'), robots: 'noindex' })

const tab = ref<'creations' | 'collection'>('creations')
const kindFilter = ref<string>('all')
watch(() => session.signedIn, (signedIn) => {
  if (!signedIn) return
  void hb.load()
  void library.load().then(() => library.authorNames([...library.others.values()].map(h => h.authorId)))
}, { immediate: true })

const kinds = computed(() => [{ value: 'all', label: t('all_title') }, ...(hb.game?.def.homebrew?.kinds ?? []).map(k => ({ value: k.collection, label: t(`homebrew.kinds.${k.collection}`) }))])
const icon = (kind: string) => hb.game?.def.homebrew?.kinds.find(k => k.collection === kind)?.icon ?? 'i-lucide-flask-conical'
const filter = (list: Homebrew[]) => list.filter(h => kindFilter.value === 'all' || h.kind === kindFilter.value).sort((a, b) => a.title.localeCompare(b.title))
const creations = computed(() => filter(library.mine))
const collection = computed(() => filter([...library.used].map(id => library.byId(id)).filter((h): h is Homebrew => Boolean(h))))
const missing = computed(() => [...library.used].filter(id => !library.byId(id)).length)

const busy = ref<string | null>(null)
async function toggleUse(h: Homebrew) {
  busy.value = h.id
  try {
    await library.setUse(h, !library.used.has(h.id))
  }
  catch {
    toast.add({ title: t('homebrew.action_failed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <UPage>
    <RecordHeader
      :title="t('homebrew.my_title')"
      :headline="t('homebrew.title')"
      :links="[{ label: t('homebrew.browse'), icon: 'i-lucide-search', to: '/homebrew' }, { label: t('homebrew.create'), icon: 'i-lucide-plus', to: '/homebrew/edit' }]"
    />
    <UPageBody>
      <AuthRequired>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <UTabs v-model="tab" :items="[{ label: t('homebrew.creations'), value: 'creations' }, { label: t('homebrew.collection'), value: 'collection' }]" :content="false" />
          <USelect v-model="kindFilter" :items="kinds" :aria-label="t('homebrew.kind')" class="w-44" />
        </div>
        <p class="mb-4 max-w-2xl text-sm text-muted">
          {{ t(tab === 'creations' ? 'homebrew.creations_help' : 'homebrew.collection_help') }}
        </p>
        <div v-if="library.status === 'loading' || library.status === 'idle'" class="flex justify-center py-12">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
        </div>
        <UAlert v-else-if="library.status === 'error'" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('homebrew.load_failed')" :actions="[{ label: t('homebrew.retry'), onClick: () => library.load(true) }]" />
        <template v-else>
          <p v-if="tab === 'collection' && missing" class="mb-3 text-sm text-warning">
            {{ t('homebrew.collection_missing', { n: missing }) }}
          </p>
          <p v-if="!(tab === 'creations' ? creations : collection).length" class="rounded-md border border-default p-6 text-center text-muted">
            {{ t(tab === 'creations' ? 'homebrew.no_creations' : 'homebrew.no_collection') }}
          </p>
          <ul v-else class="divide-y divide-default rounded-md border border-default">
            <li v-for="h in tab === 'creations' ? creations : collection" :key="h.id" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5" data-homebrew-row>
              <UIcon :name="icon(h.kind)" class="size-5 shrink-0 text-muted" />
              <div class="min-w-0 flex-1 basis-48">
                <NuxtLink :to="{ path: '/homebrew/view', query: { id: h.id } }" class="font-semibold text-highlighted hover:text-primary">
                  {{ h.title }}
                </NuxtLink>
                <p class="text-sm text-muted">
                  {{ t(`homebrew.kinds.${h.kind}`) }}
                  <template v-if="tab === 'collection'">
                    · {{ t('homebrew.by', { name: library.authorOf(h) || t('homebrew.anonymous') }) }}
                  </template>
                </p>
              </div>
              <UBadge :color="h.status === 'published' ? 'success' : h.status === 'development' ? 'warning' : 'neutral'" variant="subtle">
                {{ t(`homebrew.status.${h.status}`) }}
              </UBadge>
              <span class="flex items-center gap-1 font-mono text-sm" :title="t('homebrew.votes')"><UIcon name="i-lucide-thumbs-up" class="size-4 text-muted" />{{ h.voteCount }}</span>
              <span class="flex items-center gap-1 font-mono text-sm" :title="t('homebrew.adds')"><UIcon name="i-lucide-users" class="size-4 text-muted" />{{ h.usageCount }}</span>
              <div class="flex gap-1.5">
                <UButton v-if="tab === 'creations'" size="sm" variant="outline" icon="i-lucide-pencil" :label="t('homebrew.edit')" :to="{ path: '/homebrew/edit', query: { id: h.id } }" />
                <UButton
                  size="sm"
                  :variant="library.used.has(h.id) ? 'soft' : 'outline'"
                  :icon="library.used.has(h.id) ? 'i-lucide-check' : 'i-lucide-plus'"
                  :label="library.used.has(h.id) ? t('homebrew.in_collection') : t('homebrew.use')"
                  :aria-pressed="library.used.has(h.id)"
                  :loading="busy === h.id"
                  @click="toggleUse(h)"
                />
              </div>
            </li>
          </ul>
        </template>
      </AuthRequired>
    </UPageBody>
  </UPage>
</template>
