<script setup lang="ts">
/**
 * The homebrew editor (the live /homebrew/edit?id=; plan/26 §1.3). Without an id: pick a
 * kind, a title and optionally an official record to start from. With one: the kind's form
 * (effects as forms, no YAML) beside the sample-character preview, saved 1.5 s after the
 * last change. Private drafts save as they are; sharing (in development, then published)
 * needs a record `validateRecord` accepts, and publishing asks to accept the Acceptable
 * Use policy. Published homebrew stays published and can't change (others use it): it can
 * be copied into a new draft.
 */
import type { Homebrew, HomebrewStatus } from '@omnibrew/engine/data'
import { newHomebrewRecord } from '../../utils/homebrew'

type Rec = Record<string, unknown>
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSession()
const library = useHomebrewLibrary()
const hb = useHomebrewRules()
const toast = useToast()
const validation = useHomebrewValidation()

useSeoMeta({ title: () => t('homebrew.editor_title'), robots: 'noindex' })

const id = computed(() => (typeof route.query.id === 'string' ? route.query.id : null))
const item = ref<Homebrew | null>(null)
const draft = ref<Rec>({})
const state = ref<'loading' | 'ready' | 'missing' | 'error' | 'new'>('loading')
const saveState = ref<'saved' | 'dirty' | 'saving' | 'failed'>('saved')
const issues = ref<Record<string, string[]>>({})
const errorCount = computed(() => Object.values(issues.value).reduce((n, m) => n + m.length, 0))

watch([() => session.signedIn, id], async ([signedIn, value]) => {
  if (!signedIn) return
  state.value = 'loading'
  try {
    await Promise.all([hb.load(), library.load()])
    if (!value) {
      state.value = 'new'
      return
    }
    item.value = library.mine.find(h => h.id === value) ?? null
    if (!item.value) {
      state.value = 'missing'
      return
    }
    draft.value = structuredClone(item.value.data)
    saveState.value = 'saved'
    state.value = 'ready'
  }
  catch {
    state.value = 'error'
  }
}, { immediate: true })

const kindDef = computed(() => hb.game?.def.homebrew?.kinds.find(k => k.collection === item.value?.kind) ?? null)
const readonly = computed(() => item.value?.status === 'published')

// --- validation, as the player types ---
let checkTimer: ReturnType<typeof setTimeout> | undefined
watch(draft, (value) => {
  clearTimeout(checkTimer)
  checkTimer = setTimeout(async () => {
    if (!item.value) return
    issues.value = validation.byPath(await validation.check(item.value.kind, value, item.value.id))
  }, 300)
}, { deep: true, immediate: true })

// --- saving ---
let saveTimer: ReturnType<typeof setTimeout> | undefined
function update(record: Rec) {
  if (readonly.value) return
  draft.value = record
  saveState.value = 'dirty'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void save(), 1500)
}
const title = computed(() => String(draft.value.name ?? '').trim() || t('homebrew.untitled'))
async function save(status: HomebrewStatus = item.value!.status) {
  if (!item.value) return
  clearTimeout(saveTimer)
  saveState.value = 'saving'
  try {
    item.value = await library.save({ id: item.value.id, kind: item.value.kind, title: title.value, data: draft.value, status }, validation.check)
    saveState.value = 'saved'
    return true
  }
  catch (e) {
    saveState.value = 'failed'
    if ((e as Error).name === 'HomebrewValidationError') toast.add({ title: t('homebrew.fix_errors'), color: 'error', icon: 'i-lucide-circle-alert' })
    return false
  }
}
onBeforeRouteLeave(async () => {
  if (saveState.value === 'dirty') await save()
})

// --- new ---
const newKind = ref<string | null>(typeof route.query.kind === 'string' ? route.query.kind : null)
const newTitle = ref('')
const basedOn = ref<string | null>(null)
const creating = ref(false)
const basedOnItems = computed(() => (newKind.value && hb.loaded ? hb.loaded.rules.content.list(newKind.value).filter(r => !r.homebrew).map(r => ({ value: String(r.id), label: String(r.name ?? r.id) })).sort((a, b) => a.label.localeCompare(b.label)) : []))
async function create(copyOf?: Homebrew) {
  const kind = hb.game?.def.homebrew?.kinds.find(k => k.collection === (copyOf?.kind ?? newKind.value))
  if (!kind) return
  const name = copyOf ? t('homebrew.copy_of', { name: copyOf.title }) : newTitle.value.trim()
  if (!name) return
  creating.value = true
  try {
    const base = copyOf ? copyOf.data : basedOn.value ? hb.loaded?.rules.content.get(kind.collection, basedOn.value) ?? null : null
    const record = newHomebrewRecord(kind, name, base)
    if (basedOn.value && !copyOf) {
      const prose = await useProse(kind.collection)
      if (prose[basedOn.value]) record.body = prose[basedOn.value]
    }
    const saved = await library.save({ kind: kind.collection, title: name, data: record, status: 'private' })
    await router.replace({ query: { id: saved.id } })
  }
  catch {
    toast.add({ title: t('homebrew.action_failed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    creating.value = false
  }
}

// --- status ---
const publishing = ref(false)
const accepted = ref(false)
async function setStatus(status: HomebrewStatus) {
  if (errorCount.value) {
    toast.add({ title: t('homebrew.fix_errors'), color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  if (await save(status)) {
    publishing.value = false
    toast.add({ title: t(`homebrew.status_set.${status}`), color: 'success', icon: 'i-lucide-check' })
  }
}

// --- delete ---
const deleting = ref(false)
async function remove() {
  try {
    await library.remove(item.value!.id)
    await router.replace('/homebrew/my-homebrew')
  }
  catch {
    toast.add({ title: t('homebrew.action_failed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
const kindItems = computed(() => (hb.game?.def.homebrew?.kinds ?? []).map(k => ({ value: k.collection, label: t(`homebrew.kinds.${k.collection}`), icon: k.icon })))
</script>

<template>
  <UPage>
    <AuthRequired>
      <div v-if="state === 'loading'" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
      </div>
      <UEmpty v-else-if="state === 'missing'" class="py-16" icon="i-lucide-lock" :title="t('homebrew.not_yours_title')" :description="t('homebrew.not_yours_text')" :actions="[{ label: t('homebrew.my_title'), to: '/homebrew/my-homebrew', variant: 'outline' }]" />
      <UAlert v-else-if="state === 'error'" class="mt-8" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('homebrew.load_failed')" />

      <!-- New homebrew -->
      <template v-else-if="state === 'new'">
        <RecordHeader :title="t('homebrew.create')" :headline="t('homebrew.title')" :links="[{ label: t('homebrew.my_title'), icon: 'i-lucide-arrow-left', to: '/homebrew/my-homebrew', variant: 'ghost' }]" />
        <UPageBody>
          <form class="flex max-w-2xl flex-col gap-4" @submit.prevent="create()">
            <UFormField :label="t('homebrew.kind')" required>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <UButton v-for="k in kindItems" :key="k.value" :icon="k.icon" :label="k.label" :variant="newKind === k.value ? 'soft' : 'outline'" :aria-pressed="newKind === k.value" class="justify-start" @click="newKind = k.value; basedOn = null" />
              </div>
            </UFormField>
            <UFormField :label="t('homebrew.fields.name')" required>
              <UInput v-model="newTitle" maxlength="80" class="w-full" />
            </UFormField>
            <UFormField v-if="newKind" :label="t('homebrew.based_on')" :help="t('homebrew.based_on_help')">
              <USelectMenu :model-value="basedOn ?? undefined" :items="basedOnItems" value-key="value" :placeholder="t('homebrew.start_blank')" class="w-full" @update:model-value="v => (basedOn = (v as string) ?? null)" />
            </UFormField>
            <UButton type="submit" :label="t('homebrew.create')" icon="i-lucide-plus" :loading="creating" :disabled="!newKind || !newTitle.trim()" class="self-start" />
          </form>
        </UPageBody>
      </template>

      <!-- Editing -->
      <template v-else-if="item && kindDef">
        <RecordHeader :title="title" :headline="`${t('homebrew.badge')} · ${t(`homebrew.kinds.${item.kind}`)}`" :links="[{ label: t('homebrew.view'), icon: 'i-lucide-eye', to: { path: '/homebrew/view', query: { id: item.id } }, variant: 'ghost' }]">
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <UBadge :color="item.status === 'published' ? 'success' : item.status === 'development' ? 'warning' : 'neutral'" variant="subtle">
              {{ t(`homebrew.status.${item.status}`) }}
            </UBadge>
            <span class="text-sm text-muted" aria-live="polite" data-save-state>{{ t(`homebrew.save_state.${saveState}`) }}</span>
            <UButton v-if="saveState === 'failed'" size="xs" variant="outline" :label="t('homebrew.retry')" @click="save()" />
            <span v-if="errorCount" class="text-sm text-error">{{ t('homebrew.errors', { n: errorCount }) }}</span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton v-if="item.status === 'private'" variant="outline" icon="i-lucide-flask-conical" :label="t('homebrew.to_development')" :disabled="errorCount > 0" @click="setStatus('development')" />
            <UButton v-if="item.status !== 'published'" icon="i-lucide-globe" :label="t('homebrew.publish')" :disabled="errorCount > 0" @click="publishing = true" />
            <UButton v-if="item.status === 'published'" variant="outline" icon="i-lucide-copy" :label="t('homebrew.make_copy')" @click="create(item)" />
            <UButton color="error" variant="ghost" icon="i-lucide-trash-2" :label="t('homebrew.delete')" @click="deleting = true" />
          </div>
          <p class="mt-2 max-w-2xl text-sm text-muted">
            {{ t(`homebrew.status_help.${item.status}`) }}
          </p>
        </RecordHeader>
        <UPageBody>
          <HomebrewForm :kind="kindDef" :record="draft" :errors="issues" :readonly="readonly" @update="update" />
        </UPageBody>

        <UModal v-model:open="publishing" :title="t('homebrew.publish_title')">
          <template #body>
            <div class="flex flex-col gap-3 text-sm">
              <p>{{ t('homebrew.publish_text') }}</p>
              <UAlert v-if="!library.myName" color="warning" variant="subtle" icon="i-lucide-user-round" :title="t('homebrew.no_name')" :actions="[{ label: t('auth.profile_title'), to: '/profile', variant: 'outline' }]" />
              <UCheckbox v-model="accepted">
                <template #label>
                  {{ t('homebrew.accept') }} <ULink to="/legal/acceptable-use" target="_blank" class="text-primary underline">{{ t('legal.acceptable_use') }}</ULink>
                </template>
              </UCheckbox>
            </div>
          </template>
          <template #footer>
            <div class="flex w-full justify-end gap-2">
              <UButton color="neutral" variant="ghost" :label="t('buttons.close')" @click="publishing = false" />
              <UButton icon="i-lucide-globe" :label="t('homebrew.publish')" :disabled="!accepted" @click="setStatus('published')" />
            </div>
          </template>
        </UModal>

        <UModal v-model:open="deleting" :title="t('homebrew.delete_title', { name: title })">
          <template #body>
            <p class="text-sm">
              {{ t(item.usageCount > 0 ? 'homebrew.delete_used' : 'homebrew.delete_text', { n: item.usageCount }) }}
            </p>
          </template>
          <template #footer>
            <div class="flex w-full justify-end gap-2">
              <UButton color="neutral" variant="ghost" :label="t('buttons.close')" @click="deleting = false" />
              <UButton color="error" icon="i-lucide-trash-2" :label="t('homebrew.delete')" @click="remove" />
            </div>
          </template>
        </UModal>
      </template>
    </AuthRequired>
  </UPage>
</template>
