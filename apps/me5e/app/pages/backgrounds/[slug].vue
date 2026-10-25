<script setup lang="ts">
const path = useContentPath().value
const { t } = useI18n()
const { data: background } = await useAsyncData(path, () => queryCollection('backgrounds').path(path).first())
if (!background.value) throw createError({ statusCode: 404, statusMessage: 'Background not found', fatal: true })

useSeoMeta({ title: background.value.name, description: t('meta.info', { name: background.value.name }) })
</script>

<template>
  <UPage v-if="background">
    <RecordHeader
      :title="background.name ?? ''"
      :headline="t('background_title', 1)"
      :links="[{ label: t('background_title', 2), icon: 'i-lucide-arrow-left', to: '/backgrounds', variant: 'ghost' }]"
    />
    <UPageBody>
      <ContentRenderer :value="background" />
    </UPageBody>
  </UPage>
</template>
