<script setup lang="ts">
/**
 * The reader's bookmarks (the live /bookmarks; plan/26 §1.1), grouped by type in the
 * game's `bookmarks` order. Names and pages come from the prerendered record index, not
 * the rules bundle. Signed out, the list is this browser's; signing in uploads it.
 * Client-only (routeRules), prerendered as an empty shell.
 */
import type { RecordDoc } from '../types/site'
import { groupBookmarks } from '../utils/bookmarks'

const { t } = useI18n()
const session = useSession()
const bookmarks = useBookmarks()
const toast = useToast()
const route = useRoute()
const { game } = useAppConfig() as unknown as { game: { bookmarks?: string[] } }

useSeoMeta({ title: t('bookmarks_title'), description: t('meta.bookmarks'), robots: 'noindex' })

const index = ref<Map<string, RecordDoc> | null>(null)
const indexFailed = ref(false)
onMounted(async () => {
  // The old site's bookmarks in this browser come across once (plan/28 §2).
  await useLegacyLocalImport().run().catch(() => null)
  bookmarks.load()
  try {
    const docs = await $fetch<RecordDoc[]>('/record-index.json')
    index.value = new Map(docs.map(d => [d.id, d]))
  }
  catch {
    indexFailed.value = true
  }
})

function storedDoc(b: { type: string, recordId: string, data?: unknown }): RecordDoc | undefined {
  const d = b.data as { title?: unknown, to?: unknown } | null | undefined
  if (!d || typeof d.title !== 'string') return undefined
  return { id: `${b.type}/${b.recordId}`, title: d.title, group: b.type, collection: b.type, to: typeof d.to === 'string' && d.to.startsWith('/') ? d.to : undefined }
}

const groups = computed(() => groupBookmarks(bookmarks.items, game.bookmarks ?? []).map(g => ({
  ...g,
  items: g.items
    // Records without a page in the index (homebrew) carry their title and page on the bookmark.
    .map(b => ({ bookmark: b, doc: index.value?.get(`${b.type}/${b.recordId}`) ?? storedDoc(b) }))
    .sort((a, b) => (a.doc?.title ?? a.bookmark.recordId).localeCompare(b.doc?.title ?? b.bookmark.recordId)),
})))

async function remove(type: string, recordId: string) {
  try {
    await bookmarks.toggle(type, recordId)
  }
  catch {
    toast.add({ title: t('bookmarks.save_failed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

const signInLink = computed(() => ({ path: '/auth/sign-in', query: { redirect: route.fullPath } }))
</script>

<template>
  <UPage>
    <RecordHeader :title="t('bookmarks_title')" :headline="t('bookmarks.headline')" />
    <UPageBody>
      <UAlert
        v-if="session.enabled && session.status === 'signedOut'"
        color="info"
        variant="subtle"
        icon="i-lucide-hard-drive"
        :title="t('bookmarks.local_title')"
        :description="t('bookmarks.local_text')"
        :actions="[{ label: t('auth.sign_in'), to: signInLink, variant: 'outline' }]"
        class="mb-6"
      />
      <div v-if="bookmarks.status === 'loading' || bookmarks.status === 'idle'" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
      </div>
      <UAlert v-else-if="bookmarks.status === 'error'" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('bookmarks.load_failed')" :actions="[{ label: t('bookmarks.retry'), onClick: () => bookmarks.load() }]" />
      <div v-else-if="!bookmarks.items.length" class="rounded-md border border-default p-8 text-center">
        <UIcon name="i-lucide-bookmark" class="size-8 text-dimmed" />
        <p class="mt-3 font-semibold text-highlighted">
          {{ t('bookmarks.empty_title') }}
        </p>
        <p class="mt-1 text-sm text-muted">
          {{ t('bookmarks.empty_text') }}
        </p>
      </div>
      <div v-else class="space-y-8">
        <p v-if="indexFailed" class="text-sm text-muted">
          {{ t('bookmarks.index_failed') }}
        </p>
        <section v-for="group in groups" :key="group.type" :aria-labelledby="`bookmarks-${group.type}`">
          <h2 :id="`bookmarks-${group.type}`" class="eyebrow mb-2 text-muted">
            {{ t(`bookmarks.groups.${group.type}`) }} <span class="font-mono">({{ group.items.length }})</span>
          </h2>
          <ul class="divide-y divide-default rounded-md border border-default">
            <li v-for="{ bookmark, doc } in group.items" :key="`${bookmark.type}/${bookmark.recordId}`" class="flex min-h-11 items-center gap-3 px-3 py-1.5" data-bookmark-row>
              <div class="min-w-0 flex-1">
                <NuxtLink v-if="doc?.to" :to="doc.to" class="font-semibold text-highlighted hover:text-primary">
                  {{ doc.title }}
                </NuxtLink>
                <span v-else-if="doc" class="font-semibold text-highlighted">{{ doc.title }}</span>
                <template v-else>
                  <span class="font-mono text-sm text-default">{{ bookmark.recordId }}</span>
                  <span v-if="index" class="ml-2 text-sm text-muted">{{ t('bookmarks.missing') }}</span>
                </template>
              </div>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                :aria-label="t('bookmarks.remove', { name: doc?.title ?? bookmark.recordId })"
                :loading="bookmarks.pending.has(`${bookmark.type}/${bookmark.recordId}`)"
                @click="remove(bookmark.type, bookmark.recordId)"
              />
            </li>
          </ul>
        </section>
      </div>
    </UPageBody>
  </UPage>
</template>
