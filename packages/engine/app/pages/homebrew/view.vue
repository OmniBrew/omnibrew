<script setup lang="ts">
/**
 * One homebrew record (the live /homebrew/view?id=; plan/26 §1.1): kind, author, counts and
 * status, Use, Vote, Share, Bookmark, Edit for its owner; the record in words, and the
 * sample-character preview. Others' private homebrew can't be read (B70).
 */
import type { Homebrew } from '@omnibrew/engine/data'

const { t } = useI18n()
const route = useRoute()
const session = useSession()
const library = useHomebrewLibrary()
const hb = useHomebrewRules()
const toast = useToast()

const id = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''))
const item = ref<Homebrew | null>(null)
const state = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')

useSeoMeta({ title: () => item.value?.title ?? t('homebrew.title'), robots: 'noindex' })

watch([() => session.signedIn, id], async ([signedIn, value]) => {
  if (!signedIn) return
  if (!value) {
    state.value = 'missing'
    return
  }
  state.value = 'loading'
  try {
    await Promise.all([hb.load(), library.load()])
    const own = library.mine.find(h => h.id === value)
    const data = await useUserData()
    item.value = own ?? (await data?.homebrew.getPublic(value)) ?? null
    state.value = item.value ? 'ready' : 'missing'
    if (item.value) void library.authorNames([item.value.authorId])
  }
  catch {
    state.value = 'error'
  }
}, { immediate: true })

const kindDef = computed(() => hb.game?.def.homebrew?.kinds.find(k => k.collection === item.value?.kind) ?? null)
const own = computed(() => Boolean(item.value && library.mine.some(h => h.id === item.value!.id)))
const busy = ref(false)
async function run(fn: () => Promise<void>) {
  busy.value = true
  try {
    await fn()
  }
  catch {
    toast.add({ title: t('homebrew.action_failed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    busy.value = false
  }
}
const toggleUse = () => run(async () => {
  const tally = await library.setUse(item.value!, !library.used.has(item.value!.id))
  item.value = { ...item.value!, usageCount: tally.usageCount }
})
const toggleVote = () => run(async () => {
  const tally = await library.setVote(item.value!.id, !library.voted.has(item.value!.id))
  item.value = { ...item.value!, voteCount: tally.voteCount }
})
async function share() {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/homebrew/view?id=${item.value!.id}`)
    toast.add({ title: t('homebrew.link_copied'), color: 'success', icon: 'i-lucide-check' })
  }
  catch {
    toast.add({ title: t('homebrew.action_failed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <UPage>
    <AuthRequired>
      <div v-if="state === 'loading'" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
      </div>
      <UEmpty v-else-if="state === 'missing'" class="py-16" icon="i-lucide-flask-conical-off" :title="t('homebrew.missing_title')" :description="t('homebrew.missing_text')" :actions="[{ label: t('homebrew.title'), to: '/homebrew', variant: 'outline' }]" />
      <UAlert v-else-if="state === 'error'" class="mt-8" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('homebrew.load_failed')" />
      <template v-else-if="item">
        <RecordHeader
          :title="item.title"
          :headline="`${t('homebrew.badge')} · ${t(`homebrew.kinds.${item.kind}`)}`"
          :author="library.authorOf(item) || t('homebrew.anonymous')"
          :links="[{ label: t('homebrew.title'), icon: 'i-lucide-arrow-left', to: { path: '/homebrew', query: { kind: item.kind } }, variant: 'ghost' }]"
        >
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <UBadge :color="item.status === 'published' ? 'success' : item.status === 'development' ? 'warning' : 'neutral'" variant="subtle">
              {{ t(`homebrew.status.${item.status}`) }}
            </UBadge>
            <span class="flex items-center gap-1 font-mono text-sm"><UIcon name="i-lucide-thumbs-up" class="size-4 text-muted" />{{ item.voteCount }} <span class="font-sans text-muted">{{ t('homebrew.votes') }}</span></span>
            <span class="flex items-center gap-1 font-mono text-sm"><UIcon name="i-lucide-users" class="size-4 text-muted" />{{ item.usageCount }} <span class="font-sans text-muted">{{ t('homebrew.adds') }}</span></span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton :variant="library.used.has(item.id) ? 'soft' : 'solid'" :icon="library.used.has(item.id) ? 'i-lucide-check' : 'i-lucide-plus'" :label="library.used.has(item.id) ? t('homebrew.in_collection') : t('homebrew.use')" :aria-pressed="library.used.has(item.id)" :loading="busy" @click="toggleUse" />
            <UButton v-if="item.status === 'published' && !own" color="neutral" :variant="library.voted.has(item.id) ? 'soft' : 'outline'" icon="i-lucide-thumbs-up" :label="library.voted.has(item.id) ? t('homebrew.voted') : t('homebrew.vote_short')" :aria-pressed="library.voted.has(item.id)" :disabled="busy" @click="toggleVote" />
            <UButton v-if="own" variant="outline" icon="i-lucide-pencil" :label="t('homebrew.edit')" :to="{ path: '/homebrew/edit', query: { id: item.id } }" />
            <UButton color="neutral" variant="ghost" icon="i-lucide-link" :label="t('homebrew.share')" @click="share" />
            <BookmarkButton type="homebrew" :record-id="item.id" :data="{ title: item.title, to: `/homebrew/view?id=${item.id}` }" />
          </div>
        </RecordHeader>
        <UPageBody>
          <div v-if="kindDef" class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <HomebrewSummary :kind="kindDef" :record="item.data" />
            <section class="rounded-md border border-default bg-muted p-4" :aria-label="t('homebrew.tabs.preview')">
              <h2 class="mb-3 font-label font-semibold text-highlighted">
                {{ t('homebrew.tabs.preview') }}
              </h2>
              <HomebrewPreview :collection="kindDef.collection" :record="item.data" />
            </section>
          </div>
          <p v-else class="text-muted">
            {{ t('homebrew.unknown_kind', { kind: item.kind }) }}
          </p>
        </UPageBody>
      </template>
    </AuthRequired>
  </UPage>
</template>
