<script setup lang="ts">
// Page titles read "<page> | <site>"; pages set their own with useSeoMeta.
const { game } = useAppConfig()
const { t, locale } = useI18n()
const site = t(game.brand.title)

useHead({
  htmlAttrs: { lang: locale },
  titleTemplate: title => (title && title !== site ? `${title} | ${site}` : site),
  link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
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
