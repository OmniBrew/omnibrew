<script setup lang="ts">
// Not found and other errors, inside the site's layout.
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t } = useI18n()
const { game } = useAppConfig()
useHead({ title: `${props.error.statusCode} | ${t(game.brand.title)}` })
</script>

<template>
  <UApp>
    <NuxtLayout>
      <UPage>
        <UPageBody>
          <div class="py-16 text-center">
            <p class="font-display text-6xl font-bold text-secondary">
              {{ error.statusCode }}
            </p>
            <p class="mt-4 text-lg text-muted">
              {{ error.statusCode === 404 ? t('shell.not_found') : error.statusMessage }}
            </p>
            <UButton class="mt-8" :label="t('shell.home')" icon="i-lucide-house" @click="clearError({ redirect: '/' })" />
          </div>
        </UPageBody>
      </UPage>
    </NuxtLayout>
  </UApp>
</template>
