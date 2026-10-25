<script setup lang="ts">
// Page titles read "<page> | <site>"; pages set their own with useSeoMeta.
const { game } = useAppConfig()
const { t, locale } = useI18n()
const route = useRoute()
const { public: { indexable } } = useRuntimeConfig()
const site = t(game.brand.title)
// Search engines credit the production site, also for a preview copy.
const canonical = computed(() => (game.siteUrl ? `${game.siteUrl}${route.path === '/' ? '' : route.path}` : undefined))

useHead({
  htmlAttrs: { lang: locale },
  titleTemplate: title => (title && title !== site ? `${title} | ${site}` : site),
  link: [
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    { rel: 'canonical', href: canonical },
  ],
  meta: indexable ? [] : [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="var(--ui-primary)" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
