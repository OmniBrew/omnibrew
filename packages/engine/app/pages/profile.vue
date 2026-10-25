<script setup lang="ts">
/** The signed-in user's profile (the live /profile). Phase 3b: the display name; 3c adds the rest. */
import type { Profile } from '@omnibrew/engine/data'

const session = useSession()
const { t } = useI18n()

useSeoMeta({ title: t('auth.profile_title'), robots: 'noindex' })

const profile = ref<Profile | null>(null)
const username = ref('')
const busy = ref(false)
const message = ref<{ color: 'success' | 'error', text: string } | null>(null)

watch(() => session.signedIn, async (signedIn) => {
  const userData = signedIn ? await useUserData() : null
  if (!userData) return
  profile.value = await userData.profile.mine()
  username.value = profile.value.username ?? ''
}, { immediate: true })

async function save() {
  const userData = await useUserData()
  if (!userData) return
  busy.value = true
  message.value = null
  try {
    profile.value = await userData.profile.update({ username: username.value.trim() || null })
    message.value = { color: 'success', text: t('auth.profile_saved') }
  }
  catch (e) {
    message.value = { color: 'error', text: t('auth.errors.unknown', { message: (e as Error).message }) }
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UPage>
    <UPageHeader :title="t('auth.profile_title')" />
    <UPageBody>
      <AuthRequired>
        <form class="flex max-w-md flex-col gap-4" @submit.prevent="save">
          <p class="text-muted">
            {{ t('auth.signed_in_as', { email: session.user?.email ?? '' }) }}
          </p>
          <UFormField :label="t('auth.profile_username')" name="username">
            <UInput v-model="username" :disabled="!profile" class="w-full" />
          </UFormField>
          <UAlert v-if="message" :color="message.color" variant="subtle" :title="message.text" />
          <UButton type="submit" :label="t('auth.save')" :loading="busy" :disabled="!profile" class="self-start" />
        </form>
      </AuthRequired>
    </UPageBody>
  </UPage>
</template>
