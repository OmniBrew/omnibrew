<script setup lang="ts">
/**
 * Community homebrew (the live /homebrew; plan/26 §1.1): pick a kind (`?kind=`, linkable),
 * then everyone's published homebrew of that kind, and in-development homebrew on request;
 * search, sort by votes, adds, newest or name; Use (adds it to your collection: the builder
 * and sheet offer it) and Vote. Signed in, as live (the public queries need a session).
 */
import type { Homebrew } from '@omnibrew/engine/data'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSession()
const library = useHomebrewLibrary()
const hb = useHomebrewRules()
const toast = useToast()

useSeoMeta({ title: t('homebrew.title'), description: t('meta.homebrew'), robots: 'noindex' })

const kinds = computed(() => hb.game?.def.homebrew?.kinds ?? [])
const kind = computed(() => (typeof route.query.kind === 'string' ? route.query.kind : null))
const kindDef = computed(() => kinds.value.find(k => k.collection === kind.value) ?? null)
const setKind = (k: string | null) => router.replace({ query: k ? { kind: k } : {} })

const items = ref<Homebrew[]>([])
const loading = ref(false)
const failed = ref(false)
const showDevelopment = ref(false)
const search = ref('')
const sort = ref<'votes' | 'adds' | 'newest' | 'name'>('votes')
const sorts = computed(() => (['votes', 'adds', 'newest', 'name'] as const).map(v => ({ value: v, label: t(`homebrew.sort.${v}`) })))

async function loadAll(k: string) {
  const data = await useUserData()
  if (!data) return []
  const out: Homebrew[] = []
  for (const status of showDevelopment.value ? ['published', 'development'] as const : ['published'] as const) {
    let nextToken: string | null = null
    do {
      const page: { items: Homebrew[], nextToken: string | null } = await data.homebrew.listPublic(k, { status, limit: 100, nextToken })
      out.push(...page.items)
      nextToken = page.nextToken
    } while (nextToken)
  }
  return out
}

watch([() => session.signedIn, kind, showDevelopment], async ([signedIn, k]) => {
  if (!signedIn) return
  void hb.load()
  void library.load()
  if (!k) return
  loading.value = true
  failed.value = false
  try {
    items.value = await loadAll(k)
    void library.authorNames(items.value.map(h => h.authorId))
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}, { immediate: true })

const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = items.value.filter(h => !q || h.title.toLowerCase().includes(q) || (library.authorOf(h) ?? '').toLowerCase().includes(q))
  const by = {
    votes: (a: Homebrew, b: Homebrew) => b.voteCount - a.voteCount || b.usageCount - a.usageCount,
    adds: (a: Homebrew, b: Homebrew) => b.usageCount - a.usageCount || b.voteCount - a.voteCount,
    newest: (a: Homebrew, b: Homebrew) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')),
    name: (a: Homebrew, b: Homebrew) => a.title.localeCompare(b.title),
  }[sort.value]
  return [...list].sort(by)
})

const busy = ref<string | null>(null)
async function toggleUse(h: Homebrew) {
  busy.value = h.id
  try {
    const tally = await library.setUse(h, !library.used.has(h.id))
    h.usageCount = tally.usageCount
  }
  catch {
    toast.add({ title: t('homebrew.action_failed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    busy.value = null
  }
}
async function toggleVote(h: Homebrew) {
  busy.value = h.id
  try {
    const tally = await library.setVote(h.id, !library.voted.has(h.id))
    h.voteCount = tally.voteCount
  }
  catch {
    toast.add({ title: t('homebrew.action_failed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    busy.value = null
  }
}
const own = (h: Homebrew) => library.mine.some(m => m.id === h.id)
</script>

<template>
  <UPage>
    <RecordHeader
      :title="t('homebrew.title')"
      :headline="t('homebrew.headline')"
      :links="[{ label: t('homebrew.my_title'), icon: 'i-lucide-folder-open', to: '/homebrew/my-homebrew' }, { label: t('homebrew.create'), icon: 'i-lucide-plus', to: '/homebrew/edit' }]"
    />
    <UPageBody>
      <AuthRequired>
        <p class="mb-4 max-w-2xl text-muted">
          {{ t('homebrew.intro') }}
        </p>
        <div class="mb-4 flex flex-wrap gap-2" role="group" :aria-label="t('homebrew.kind')">
          <UButton
            v-for="k in kinds"
            :key="k.collection"
            :icon="k.icon"
            :label="t(`homebrew.kinds.${k.collection}`)"
            :variant="kind === k.collection ? 'soft' : 'outline'"
            :aria-pressed="kind === k.collection"
            @click="setKind(k.collection)"
          />
        </div>

        <p v-if="!kindDef" class="text-muted">
          {{ t('homebrew.pick_kind') }}
        </p>
        <template v-else>
          <div class="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center">
            <UInput v-model="search" icon="i-lucide-search" :placeholder="t('homebrew.search')" :aria-label="t('homebrew.search')" class="w-full" />
            <USelect v-model="sort" :items="sorts" :aria-label="t('homebrew.sort.title')" class="w-full" />
            <USwitch v-model="showDevelopment" :label="t('homebrew.show_development')" />
          </div>
          <div v-if="loading" class="flex justify-center py-12">
            <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
          </div>
          <UAlert v-else-if="failed" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('homebrew.load_failed')" />
          <p v-else-if="!shown.length" class="rounded-md border border-default p-6 text-center text-muted">
            {{ t('homebrew.none_found') }}
          </p>
          <ul v-else class="divide-y divide-default rounded-md border border-default">
            <li v-for="h in shown" :key="h.id" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5" data-homebrew-row>
              <div class="min-w-0 flex-1 basis-56">
                <NuxtLink :to="{ path: '/homebrew/view', query: { id: h.id } }" class="font-semibold text-highlighted hover:text-primary">
                  {{ h.title }}
                </NuxtLink>
                <p class="text-sm text-muted">
                  {{ t('homebrew.by', { name: library.authorOf(h) || t('homebrew.anonymous') }) }}
                  <UBadge v-if="h.status === 'development'" color="warning" variant="subtle" size="sm" class="ms-1">
                    {{ t('homebrew.status.development') }}
                  </UBadge>
                </p>
              </div>
              <span class="flex items-center gap-1 font-mono text-sm text-default" :title="t('homebrew.votes')"><UIcon name="i-lucide-thumbs-up" class="size-4 text-muted" /><span class="sr-only">{{ t('homebrew.votes') }}</span>{{ h.voteCount }}</span>
              <span class="flex items-center gap-1 font-mono text-sm text-default" :title="t('homebrew.adds')"><UIcon name="i-lucide-users" class="size-4 text-muted" /><span class="sr-only">{{ t('homebrew.adds') }}</span>{{ h.usageCount }}</span>
              <div class="flex gap-1.5">
                <UButton
                  size="sm"
                  :variant="library.used.has(h.id) ? 'soft' : 'outline'"
                  :icon="library.used.has(h.id) ? 'i-lucide-check' : 'i-lucide-plus'"
                  :label="library.used.has(h.id) ? t('homebrew.in_collection') : t('homebrew.use')"
                  :aria-pressed="library.used.has(h.id)"
                  :loading="busy === h.id"
                  @click="toggleUse(h)"
                />
                <UButton
                  v-if="h.status === 'published' && !own(h)"
                  size="sm"
                  color="neutral"
                  :variant="library.voted.has(h.id) ? 'soft' : 'ghost'"
                  icon="i-lucide-thumbs-up"
                  :aria-label="library.voted.has(h.id) ? t('homebrew.unvote', { name: h.title }) : t('homebrew.vote', { name: h.title })"
                  :aria-pressed="library.voted.has(h.id)"
                  :disabled="busy === h.id"
                  @click="toggleVote(h)"
                />
              </div>
            </li>
          </ul>
        </template>
      </AuthRequired>
    </UPageBody>
  </UPage>
</template>
