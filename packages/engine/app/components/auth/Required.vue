<script setup lang="ts">
/**
 * Shows its slot to signed-in users and a sign-in prompt to everyone else. Prerendered
 * pages render the loading state; the session is read after the page mounts.
 */
const session = useSession()
const route = useRoute()
const { t } = useI18n()
</script>

<template>
  <slot v-if="session.signedIn" />
  <div v-else-if="session.status === 'loading'" class="flex justify-center py-16" aria-busy="true">
    <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
  </div>
  <UPageCard
    v-else
    :title="t('auth.required_title')"
    :description="t('auth.required_text')"
    icon="i-lucide-lock"
    class="mx-auto my-12 max-w-lg"
  >
    <UButton :to="{ path: '/auth/sign-in', query: { redirect: route.fullPath } }" :label="t('auth.sign_in')" icon="i-lucide-log-in" class="self-start" />
  </UPageCard>
</template>
