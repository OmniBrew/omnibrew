<script setup lang="ts">
/** Sign-in button, or the signed-in user's menu. Hidden when the site has no backend. */
import type { DropdownMenuItem } from '@nuxt/ui'

const session = useSession()
const route = useRoute()
const { t } = useI18n()

const signInLink = computed(() => ({ path: '/auth/sign-in', query: route.path.startsWith('/auth/') ? {} : { redirect: route.fullPath } }))
const items = computed<DropdownMenuItem[][]>(() => [
  [{ label: t('auth.signed_in_as', { email: session.user?.email ?? '' }), type: 'label' }],
  [{ label: t('auth.sign_out'), icon: 'i-lucide-log-out', onSelect: () => session.logOut() }],
])
</script>

<template>
  <ClientOnly>
    <template v-if="session.enabled">
      <UDropdownMenu v-if="session.signedIn" :items="items">
        <UButton color="neutral" variant="ghost" icon="i-lucide-circle-user-round" :aria-label="t('auth.account')" />
      </UDropdownMenu>
      <UButton
        v-else-if="session.status === 'signedOut'"
        color="neutral"
        variant="ghost"
        icon="i-lucide-log-in"
        :to="signInLink"
        :aria-label="t('auth.sign_in')"
      >
        <span class="hidden sm:inline">{{ t('auth.sign_in') }}</span>
      </UButton>
    </template>
  </ClientOnly>
</template>
