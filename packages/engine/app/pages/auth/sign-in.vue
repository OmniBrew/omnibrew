<script setup lang="ts">
/**
 * Sign in, create an account, confirm it, or reset a password: email accounts through
 * Amplify's API, Google through the Cognito hosted domain (plan/20). `?redirect=` is
 * where to go afterwards.
 */
type Mode = 'signIn' | 'signUp' | 'confirm' | 'forgot' | 'reset'

const session = useSession()
const route = useRoute()
const { t } = useI18n()

useSeoMeta({ title: t('auth.sign_in'), robots: 'noindex' })

const mode = ref<Mode>('signIn')
const email = ref('')
const password = ref('')
const code = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

const redirect = computed(() => safeRedirect(route.query.redirect) ?? '/')

// Already signed in (or just finished): go on.
watch(() => session.status, (status) => {
  if (status === 'signedIn') navigateTo(redirect.value, { replace: true })
}, { immediate: true })

function go(next: Mode) {
  mode.value = next
  error.value = null
  notice.value = next === 'confirm' || next === 'reset' ? t('auth.code_sent', { email: email.value }) : null
}

async function run(action: () => Promise<void>) {
  busy.value = true
  error.value = null
  try {
    await action()
  }
  catch (e) {
    const { key, params } = authErrorMessage(e)
    if ((e as { name?: string }).name === 'UserNotConfirmedException') go('confirm')
    else error.value = t(key, params ?? {})
  }
  finally {
    busy.value = false
  }
}

const submit = () => run(async () => {
  switch (mode.value) {
    case 'signIn': {
      const step = await session.signInWithPassword(email.value, password.value)
      if (step === 'confirmSignUp') {
        await session.resendCode(email.value)
        go('confirm')
      }
      else if (step === 'resetPassword') go('forgot')
      break
    }
    case 'signUp':
      if (await session.register(email.value, password.value) === 'confirmSignUp') go('confirm')
      else await session.signInWithPassword(email.value, password.value)
      break
    case 'confirm':
      await session.confirmRegistration(email.value, code.value)
      if (password.value) await session.signInWithPassword(email.value, password.value)
      else go('signIn')
      break
    case 'forgot':
      await session.startPasswordReset(email.value)
      go('reset')
      break
    case 'reset':
      await session.finishPasswordReset(email.value, code.value, password.value)
      await session.signInWithPassword(email.value, password.value)
      break
  }
})

const google = () => run(() => session.signInWithGoogle(redirect.value))
const resend = () => run(async () => {
  await session.resendCode(email.value)
  notice.value = t('auth.code_sent', { email: email.value })
})

const titles: Record<Mode, string> = { signIn: 'auth.sign_in', signUp: 'auth.sign_up', confirm: 'auth.confirm', forgot: 'auth.reset_password', reset: 'auth.reset_password' }
const submitLabels: Record<Mode, string> = { signIn: 'auth.sign_in', signUp: 'auth.sign_up', confirm: 'auth.confirm', forgot: 'auth.send_code', reset: 'auth.reset_password' }
const needsPassword = computed(() => mode.value === 'signIn' || mode.value === 'signUp' || mode.value === 'reset')
const needsCode = computed(() => mode.value === 'confirm' || mode.value === 'reset')
</script>

<template>
  <UPage>
    <UPageBody>
      <UPageCard :title="t(titles[mode])" class="mx-auto my-8 w-full max-w-md">
        <ClientOnly>
          <div v-if="!session.enabled" class="text-muted">
            {{ t('auth.required_text') }}
          </div>
          <div v-else class="flex flex-col gap-4">
            <template v-if="mode === 'signIn' || mode === 'signUp'">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-simple-icons-google"
                :label="t('auth.google')"
                :loading="busy"
                block
                @click="google"
              />
              <USeparator :label="t('auth.or')" />
            </template>

            <UAlert v-if="notice" color="info" variant="subtle" :title="notice" />
            <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />

            <form class="flex flex-col gap-4" @submit.prevent="submit">
              <UFormField :label="t('auth.email')" name="email" required>
                <UInput v-model="email" type="email" autocomplete="username" :disabled="mode === 'confirm' || mode === 'reset'" class="w-full" />
              </UFormField>
              <UFormField v-if="needsCode" :label="t('auth.code')" name="code" required>
                <UInput v-model="code" inputmode="numeric" autocomplete="one-time-code" class="w-full" />
              </UFormField>
              <UFormField
                v-if="needsPassword"
                :label="t(mode === 'reset' ? 'auth.new_password' : 'auth.password')"
                :hint="mode === 'signIn' ? undefined : t('auth.password_hint')"
                name="password"
                required
              >
                <UInput v-model="password" type="password" :autocomplete="mode === 'signIn' ? 'current-password' : 'new-password'" class="w-full" />
              </UFormField>
              <UButton type="submit" :label="t(submitLabels[mode])" :loading="busy" block />
            </form>

            <div class="flex flex-wrap justify-between gap-2 text-sm">
              <template v-if="mode === 'signIn'">
                <ULink as="button" class="text-primary" @click="go('signUp')">{{ t('auth.sign_up') }}</ULink>
                <ULink as="button" class="text-muted" @click="go('forgot')">{{ t('auth.forgot_password') }}</ULink>
              </template>
              <template v-else>
                <ULink as="button" class="text-primary" @click="go('signIn')">{{ t('auth.back_to_sign_in') }}</ULink>
                <ULink v-if="mode === 'confirm'" as="button" class="text-muted" @click="resend">{{ t('auth.resend_code') }}</ULink>
              </template>
            </div>
          </div>
        </ClientOnly>
      </UPageCard>
    </UPageBody>
  </UPage>
</template>
