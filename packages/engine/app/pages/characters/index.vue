<script setup lang="ts">
/**
 * The character list (the live /characters, plan/24 §1.1): the signed-in player's
 * characters and this browser's, with create, open, edit, duplicate, share, export,
 * import and delete. Signed-in players' local characters upload on arrival, as live.
 */
import { newCharacter, type Character } from '@omnibrew/engine/character'
import type { Sheet } from '@omnibrew/engine/rules'

const { t } = useI18n()
const session = useSession()
const source = useCharacterSource()
const toast = useToast()
const { $characterGame } = useNuxtApp()
const { game } = useAppConfig()

useSeoMeta({ title: t('characters.title'), robots: 'noindex' })

const items = ref<CharacterRecord[]>([])
const loading = ref(true)
const failed = ref<string | null>(null)
const rules = shallowRef<LoadedRules | null>(null)
const busy = ref<string | null>(null)
const deleting = ref<CharacterRecord | null>(null)

useRules().then(r => (rules.value = r)).catch(() => {})

const legacyImport = useLegacyLocalImport()

async function load() {
  loading.value = true
  failed.value = null
  try {
    // The old site's characters in this browser come across once (plan/28 §2).
    const moved = await legacyImport.run().catch(() => null)
    if (moved?.characters) toast.add({ title: t('migration.local_characters', { n: moved.characters }, moved.characters), color: 'success', icon: 'i-lucide-history' })
    if (moved?.failed.length) {
      const old = moved.failed
      toast.add({ title: t('migration.local_failed', { n: old.length }, old.length), color: 'warning', duration: 0, actions: [{ label: t('migration.download'), onClick: () => downloadJson('old-characters.json', old.map(f => f.raw)) }] })
    }
    let list = await source.list()
    if (session.signedIn && list.some(c => c.local)) {
      const { uploaded, kept } = await source.upload(list.filter(c => !c.local).length)
      if (uploaded) toast.add({ title: t('characters.uploaded', { n: uploaded }, uploaded), color: 'success', icon: 'i-lucide-cloud-upload' })
      if (kept) toast.add({ title: t('characters.upload_limit', { n: kept }, kept), color: 'warning', icon: 'i-lucide-hard-drive' })
      if (uploaded) list = await source.list()
    }
    items.value = list
  }
  catch (e) {
    failed.value = (e as Error).message
  }
  finally {
    loading.value = false
  }
}

watch(() => session.status, (status) => {
  if (status !== 'loading') void load()
}, { immediate: true })

const sheets = computed(() => {
  const out = new Map<string, Sheet>()
  if (!rules.value) return out
  for (const c of items.value) {
    try {
      out.set(c.id, rules.value.rules.sheet(c.character))
    }
    catch {
      // A character the rules can't read still lists by name.
    }
  }
  return out
})

/** "Batarian · Infiltrator 3 / Adept 1". */
function identity(c: CharacterRecord) {
  const sheet = sheets.value.get(c.id)
  const species = sheet?.species?.name ?? c.character.species
  const classes = c.character.classes.map(k => `${sheet?.classes.find(x => x.id === k.id)?.data.name ?? k.id} ${k.levels}`).join(' / ')
  return [species, classes].filter(Boolean).join(' · ') || t('characters.not_started')
}

const icon = (c: CharacterRecord) => {
  const first = c.character.classes[0]?.id
  return first && game.sheet.classIcon ? game.sheet.classIcon.replace('{id}', first) : ''
}

async function create(character?: Character) {
  busy.value = 'new'
  try {
    const record = await source.create(character ?? newCharacter($characterGame))
    await navigateTo({ path: '/characters/builder', query: { id: record.id } })
  }
  catch (e) {
    toast.add({ title: t('characters.save_failed', { message: (e as Error).message }), color: 'error' })
  }
  finally {
    busy.value = null
  }
}

async function duplicate(c: CharacterRecord) {
  busy.value = c.id
  try {
    const copy = await source.create({ ...structuredClone(toRaw(c.character)), name: t('characters.copy_name', { name: c.character.name || t('characters.unnamed') }) })
    items.value = [copy, ...items.value]
  }
  catch (e) {
    toast.add({ title: t('characters.save_failed', { message: (e as Error).message }), color: 'error' })
  }
  finally {
    busy.value = null
  }
}

async function remove() {
  const c = deleting.value
  if (!c) return
  busy.value = c.id
  try {
    await source.remove(c)
    items.value = items.value.filter(x => x.id !== c.id)
    deleting.value = null
  }
  catch (e) {
    toast.add({ title: t('characters.delete_failed', { message: (e as Error).message }), color: 'error' })
  }
  finally {
    busy.value = null
  }
}

async function share(c: CharacterRecord) {
  const url = new URL(`/characters/sheet?id=${encodeURIComponent(c.id)}`, location.origin).toString()
  try {
    await navigator.clipboard.writeText(url)
    toast.add({ title: t('characters.link_copied'), icon: 'i-lucide-link', color: 'success' })
  }
  catch {
    toast.add({ title: url, color: 'neutral' })
  }
}

const exportOne = (c: CharacterRecord) => downloadJson(exportName([c.character]), exportFile($characterGame.id, [toRaw(c.character)]))
const exportAll = () => downloadJson(exportName(items.value.map(c => c.character)), exportFile($characterGame.id, items.value.map(c => toRaw(c.character))))

const menu = (c: CharacterRecord) => [
  [
    { label: t('characters.duplicate'), icon: 'i-lucide-copy', onSelect: () => duplicate(c) },
    ...(c.local ? [] : [{ label: t('characters.share'), icon: 'i-lucide-link', onSelect: () => share(c) }]),
    { label: t('characters.export'), icon: 'i-lucide-download', onSelect: () => exportOne(c) },
  ],
  [{ label: t('characters.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => (deleting.value = c) }],
]

const importing = ref(false)
function imported(records: CharacterRecord[]) {
  items.value = [...records, ...items.value]
}
</script>

<template>
  <UPage>
    <UPageHeader :title="t('characters.title')">
      <template #links>
        <UButton :label="t('characters.new')" icon="i-lucide-plus" :loading="busy === 'new'" @click="create()" />
        <UButton :label="t('characters.import')" icon="i-lucide-upload" variant="outline" @click="importing = true" />
        <UButton v-if="items.length" :label="t('characters.export_all')" icon="i-lucide-download" variant="ghost" color="neutral" @click="exportAll" />
      </template>
    </UPageHeader>

    <UPageBody>
      <UAlert
        v-if="session.status === 'signedOut' && session.enabled"
        icon="i-lucide-hard-drive"
        color="info"
        variant="subtle"
        :title="t('characters.local_title')"
        :description="t('characters.local_text')"
        :actions="[{ label: t('auth.sign_in'), to: { path: '/auth/sign-in', query: { redirect: '/characters' } }, variant: 'outline' }]"
        class="mb-6"
      />

      <div v-if="loading" class="flex justify-center py-16" aria-busy="true">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
      </div>
      <UAlert v-else-if="failed" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('characters.load_failed')" :description="failed" :actions="[{ label: t('characters.retry'), onClick: load }]" />
      <UEmpty v-else-if="!items.length" icon="i-lucide-user-round-plus" :title="t('characters.empty_title')" :description="t('characters.empty_text')" :actions="[{ label: t('characters.new'), icon: 'i-lucide-plus', onClick: () => create() }]" />

      <ul v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="c in items" :key="c.id" class="flex items-center gap-3 rounded-md border border-default bg-muted p-3" data-character>
          <NuxtLink :to="{ path: '/characters/sheet', query: { id: c.id } }" class="flex min-w-0 flex-1 items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <img v-if="c.character.image" :src="c.character.image" alt="" class="size-13 shrink-0 rounded-sm bg-default object-cover">
            <img v-else-if="icon(c)" :src="icon(c)" alt="" class="size-13 shrink-0">
            <span v-else class="flex size-13 shrink-0 items-center justify-center rounded-sm bg-default"><UIcon name="i-lucide-user-round" class="size-6 text-dimmed" /></span>
            <span class="min-w-0">
              <span class="block truncate font-label text-base font-semibold text-highlighted">{{ c.character.name || t('characters.unnamed') }}</span>
              <span class="block truncate text-sm text-muted">{{ identity(c) }}</span>
              <UBadge v-if="c.local" :label="t('characters.on_this_device')" color="neutral" variant="soft" size="sm" icon="i-lucide-hard-drive" class="mt-1" />
            </span>
          </NuxtLink>
          <UButton :to="{ path: '/characters/builder', query: { id: c.id } }" icon="i-lucide-pencil" color="neutral" variant="ghost" :aria-label="t('characters.edit_name', { name: c.character.name || t('characters.unnamed') })" />
          <UDropdownMenu :items="menu(c)" :content="{ align: 'end' }">
            <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" :loading="busy === c.id" :aria-label="t('characters.more', { name: c.character.name || t('characters.unnamed') })" />
          </UDropdownMenu>
        </li>
      </ul>
    </UPageBody>

    <UModal :open="!!deleting" :title="t('characters.delete_title', { name: deleting?.character.name || t('characters.unnamed') })" :description="t('characters.delete_text')" @update:open="v => !v && (deleting = null)">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton :label="t('characters.cancel')" color="neutral" variant="ghost" @click="deleting = null" />
          <UButton :label="t('characters.delete')" color="error" :loading="busy === deleting?.id" @click="remove" />
        </div>
      </template>
    </UModal>

    <CharacterImport v-model:open="importing" @imported="imported" />
  </UPage>
</template>
