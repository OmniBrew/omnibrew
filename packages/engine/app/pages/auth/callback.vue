<script setup lang="ts">
/** Where Google (through the Cognito hosted domain) sends the user back; Amplify finishes the sign-in. */
const session = useSession()
const route = useRoute()
const { t } = useI18n()
const failed = ref(false)

useSeoMeta({ title: t('auth.sign_in'), robots: 'noindex' })

let stop: (() => void) | undefined
onMounted(async () => {
  const { utils } = await loadAmplify()
  stop = utils.Hub.listen('auth', ({ payload }) => {
    if (payload.event === 'signInWithRedirect_failure') failed.value = true
  })
})
onBeforeUnmount(() => stop?.())

watch(() => session.status, async (status) => {
  if (status === 'signedIn') await navigateTo(safeRedirect(session.takeRedirect()) ?? '/', { replace: true })
  // Without a code there is nothing to finish (an error from Google, or a stray visit).
  else if (status === 'signedOut' && !route.query.code) failed.value = true
}, { immediate: true })
</script>

<template>
  <UPage>
    <UPageBody>
      <div class="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center">
        <template v-if="failed">
          <UAlert color="error" icon="i-lucide-circle-alert" :title="t('auth.callback_failed')" />
          <UButton to="/auth/sign-in" :label="t('auth.back_to_sign_in')" />
        </template>
        <template v-else>
          <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
          <p class="text-muted">
            {{ t('auth.signing_in') }}
          </p>
        </template>
      </div>
    </UPageBody>
  </UPage>
</template>
