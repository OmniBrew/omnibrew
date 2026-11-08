<script setup lang="ts">
/**
 * The signed-in user's profile (the live /profile; plan/26 §1.2): display name, picture,
 * units and color mode (saved to the account), and up to five Discord webhooks with the
 * characters each posts for. The picture uses Amplify Storage, loaded on this page only.
 */
import type { Profile } from '@omnibrew/engine/data'
import { MAX_WEBHOOKS, normalizeWebhooks, rollPayload, webhookErrors, createDiscordPoster, type DiscordWebhook } from '../utils/discord'
import { pictureFileError } from '../utils/profile-picture'

const session = useSession()
const { resizePicture, uploadPicture, pictureUrl, removePicture } = useProfilePicture()
const preferences = usePreferences()
const colorMode = useColorMode()
const toast = useToast()
const { t } = useI18n()

useSeoMeta({ title: t('auth.profile_title'), robots: 'noindex' })

const profile = ref<Profile | null>(null)
const loadFailed = ref(false)
const username = ref('')
const webhooks = ref<DiscordWebhook[]>([])
const characters = ref<Array<{ id: string, name: string }>>([])
const busy = ref(false)
const errors = ref<Record<number, string>>({})
const picture = ref<string | null>(null)
const pictureBusy = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const dirty = computed(() => Boolean(profile.value) && (
  username.value.trim() !== (profile.value!.username ?? '')
  || JSON.stringify(webhooks.value) !== JSON.stringify(normalizeWebhooks(profile.value!.webhooks))))

watch(() => session.signedIn, async (signedIn) => {
  const userData = signedIn ? await useUserData() : null
  if (!userData) return
  try {
    profile.value = await userData.profile.mine()
    reset()
    if (profile.value.profileImg) picture.value = await pictureUrl(profile.value.profileImg).catch(() => null)
    characters.value = (await userData.characters.list()).map(c => ({ id: c.id, name: c.character.name || t('characters.unnamed') }))
  }
  catch {
    loadFailed.value = !profile.value
  }
}, { immediate: true })

function reset() {
  username.value = profile.value?.username ?? ''
  webhooks.value = normalizeWebhooks(profile.value?.webhooks)
  errors.value = {}
}

async function save() {
  const userData = await useUserData()
  if (!userData) return
  errors.value = webhookErrors(webhooks.value)
  const name = username.value.trim()
  if (name && (name.length < 2 || name.length > 32)) {
    toast.add({ title: t('profile.name_length'), color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  if (Object.keys(errors.value).length) return
  busy.value = true
  try {
    profile.value = await userData.profile.update({ username: name || null, webhooks: webhooks.value.map(w => ({ ...w, name: w.name.trim(), url: w.url.trim() })) })
    reset()
    toast.add({ title: t('auth.profile_saved'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (e) {
    toast.add({ title: t('auth.errors.unknown', { message: (e as Error).message }), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    busy.value = false
  }
}

function addWebhook() {
  if (webhooks.value.length >= MAX_WEBHOOKS) return
  webhooks.value.push({ id: globalThis.crypto.randomUUID(), name: '', url: '', characters: [] })
}
const removeWebhook = (i: number) => webhooks.value.splice(i, 1)
const URL_PLACEHOLDER = 'https://discord.com/api/webhooks/…'
const webhookError = (i: number) => (errors.value[i] ? t(errors.value[i]!) : undefined)
const characterItems = computed(() => characters.value.map(c => ({ label: c.name, value: c.id })))
const characterName = (id: string) => characters.value.find(c => c.id === id)?.name ?? t('profile.webhooks.unknown_character')

const poster = createDiscordPoster({ fetch: (...args) => globalThis.fetch(...args) })
const testing = ref<string | null>(null)
async function test(w: DiscordWebhook, i: number) {
  const problem = webhookErrors([w])[0]
  const { [i]: _, ...others } = errors.value
  errors.value = problem ? { ...others, [i]: problem } : others
  if (problem) return
  testing.value = w.id
  const result = await poster.post(w.url.trim(), rollPayload(
    { at: new Date().toISOString(), label: t('profile.webhooks.test_label'), kind: 'custom', notation: '1d20', total: 20, dice: [{ sides: 20, value: 20 }] },
    { name: username.value.trim() || 'N7 World' },
    { kind: t('sheet.roll.kind.custom'), damageType: x => x, footer: t('profile.webhooks.footer') },
  ))
  testing.value = null
  toast.add(result === 'sent'
    ? { title: t('profile.webhooks.test_sent'), color: 'success', icon: 'i-lucide-check' }
    : { title: t(result === 'gone' ? 'profile.webhooks.gone' : 'profile.webhooks.test_failed'), color: 'error', icon: 'i-lucide-circle-alert' })
}

async function pickPicture(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  const problem = pictureFileError(file)
  if (problem) {
    toast.add({ title: t(problem), color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  const userData = await useUserData()
  if (!userData || !profile.value) return
  pictureBusy.value = true
  try {
    const old = profile.value.profileImg
    const path = await uploadPicture(await resizePicture(file))
    profile.value = await userData.profile.update({ profileImg: path })
    picture.value = await pictureUrl(path)
    if (old && old !== path) await removePicture(old).catch(() => {})
  }
  catch {
    toast.add({ title: t('profile.picture.failed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    pictureBusy.value = false
  }
}

async function deletePicture() {
  const userData = await useUserData()
  if (!userData || !profile.value?.profileImg) return
  pictureBusy.value = true
  try {
    const old = profile.value.profileImg
    profile.value = await userData.profile.update({ profileImg: null })
    picture.value = null
    await removePicture(old).catch(() => {})
  }
  catch {
    toast.add({ title: t('profile.picture.failed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    pictureBusy.value = false
  }
}

const unitItems = computed(() => [{ label: t('profile.units.metric'), value: 'metric' }, { label: t('profile.units.imperial'), value: 'imperial' }])
const colorItems = computed(() => [{ label: t('profile.color.dark'), value: 'dark' }, { label: t('profile.color.light'), value: 'light' }, { label: t('profile.color.system'), value: 'system' }])
</script>

<template>
  <UPage>
    <RecordHeader :title="t('auth.profile_title')" :headline="t('auth.account_overline')" />
    <UPageBody>
      <AuthRequired>
        <UAlert v-if="loadFailed" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('profile.load_failed')" />
        <div v-else-if="!profile" class="flex justify-center py-12">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
        </div>
        <form v-else class="flex max-w-2xl flex-col gap-8" @submit.prevent="save">
          <!-- Account -->
          <section class="flex flex-col gap-4 sm:flex-row sm:items-start" aria-labelledby="profile-account">
            <div class="flex flex-col items-center gap-2">
              <UAvatar :src="picture ?? undefined" icon="i-lucide-user-round" size="3xl" class="size-24 text-3xl" :alt="t('profile.picture.alt')" />
              <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" class="sr-only" :aria-label="t('profile.picture.upload')" @change="pickPicture">
              <div class="flex gap-1">
                <UButton size="xs" variant="outline" icon="i-lucide-upload" :label="t('profile.picture.upload')" :loading="pictureBusy" @click="fileInput?.click()" />
                <UButton v-if="profile.profileImg" size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('profile.picture.remove')" :disabled="pictureBusy" @click="deletePicture" />
              </div>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-4">
              <h2 id="profile-account" class="sr-only">
                {{ t('profile.account') }}
              </h2>
              <UFormField :label="t('auth.email')">
                <UInput :model-value="session.user?.email ?? ''" disabled class="w-full" />
              </UFormField>
              <UFormField :label="t('auth.profile_username')" :help="t('profile.name_help')" name="username">
                <UInput v-model="username" maxlength="32" class="w-full" />
              </UFormField>
            </div>
          </section>

          <!-- Preferences -->
          <section aria-labelledby="profile-preferences">
            <h2 id="profile-preferences" class="eyebrow mb-1 text-muted">
              {{ t('profile.preferences') }}
            </h2>
            <p class="mb-3 text-sm text-muted">
              {{ t('profile.preferences_help') }}
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField :label="t('profile.units.title')">
                <URadioGroup :model-value="preferences.units" :items="unitItems" orientation="horizontal" @update:model-value="v => preferences.setUnits(v as 'metric' | 'imperial')" />
              </UFormField>
              <UFormField :label="t('profile.color.title')">
                <URadioGroup v-model="colorMode.preference" :items="colorItems" orientation="horizontal" />
              </UFormField>
            </div>
          </section>

          <!-- Discord webhooks -->
          <section aria-labelledby="profile-webhooks">
            <h2 id="profile-webhooks" class="eyebrow mb-1 text-muted">
              {{ t('profile.webhooks.title') }}
            </h2>
            <p class="mb-3 text-sm text-muted">
              {{ t('profile.webhooks.help') }}
            </p>
            <div class="flex flex-col gap-3">
              <div v-for="(w, i) in webhooks" :key="w.id" class="rounded-md border border-default bg-muted p-3" data-webhook>
                <div class="grid gap-3 sm:grid-cols-[1fr_2fr]">
                  <UFormField :label="t('profile.webhooks.name')" :name="`webhook-${i}-name`">
                    <UInput v-model="w.name" :placeholder="t('profile.webhooks.name_placeholder', { n: i + 1 })" maxlength="60" class="w-full" />
                  </UFormField>
                  <UFormField :label="t('profile.webhooks.url')" :hint="t('profile.webhooks.url_hint')" :error="webhookError(i)" :name="`webhook-${i}-url`">
                    <UInput v-model="w.url" inputmode="url" :placeholder="URL_PLACEHOLDER" class="w-full" autocomplete="off" />
                  </UFormField>
                </div>
                <UFormField :label="t('profile.webhooks.characters')" :help="t('profile.webhooks.characters_help')" class="mt-3">
                  <USelectMenu v-model="w.characters" :items="characterItems" value-key="value" multiple :placeholder="t('profile.webhooks.no_characters')" class="w-full">
                    <template #default>
                      <span v-if="w.characters.length" class="truncate">{{ w.characters.map(characterName).join(', ') }}</span>
                      <span v-else class="text-muted">{{ t('profile.webhooks.no_characters') }}</span>
                    </template>
                  </USelectMenu>
                </UFormField>
                <div class="mt-3 flex flex-wrap gap-2">
                  <UButton size="sm" variant="outline" icon="i-lucide-send" :label="t('profile.webhooks.test')" :loading="testing === w.id" @click="test(w, i)" />
                  <UButton size="sm" color="error" variant="ghost" icon="i-lucide-trash-2" :label="t('profile.webhooks.delete')" @click="removeWebhook(i)" />
                </div>
              </div>
              <UButton
                variant="outline"
                icon="i-lucide-plus"
                class="self-start"
                :label="webhooks.length >= MAX_WEBHOOKS ? t('profile.webhooks.limit', { n: MAX_WEBHOOKS }) : t('profile.webhooks.add')"
                :disabled="webhooks.length >= MAX_WEBHOOKS"
                @click="addWebhook"
              />
            </div>
          </section>

          <div class="flex gap-2">
            <UButton type="submit" :label="t('auth.save')" :loading="busy" :disabled="!dirty" />
            <UButton color="neutral" variant="ghost" :label="t('profile.discard')" :disabled="!dirty || busy" @click="reset" />
          </div>
        </form>
      </AuthRequired>
    </UPageBody>
  </UPage>
</template>
