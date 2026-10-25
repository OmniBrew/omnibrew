<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { data: feat } = await useAsyncData(route.path, () => queryCollection('feats').path(route.path).first())
if (!feat.value) throw createError({ statusCode: 404, statusMessage: 'Feat not found', fatal: true })

useSeoMeta({ title: feat.value.name, description: t('meta.info', { name: feat.value.name }) })
</script>

<template>
  <UPage v-if="feat">
    <RecordHeader
      :title="feat.name ?? ''"
      :headline="t('feat_title', 1)"
      :links="[{ label: t('feat_title', 2), icon: 'i-lucide-arrow-left', to: '/feats', variant: 'ghost' }]"
    >
      <UBadge :label="feat.new ? t('new_title') : t('phb')" :color="feat.new ? 'info' : 'warning'" variant="subtle" size="sm" class="mt-2" />
    </RecordHeader>
    <UPageBody>
      <p v-if="feat.prerequisite">
        <strong>{{ t('prerequisite_title') }}</strong>
        <em class="ps-1">{{ feat.prerequisite }}</em>
      </p>
      <ContentRenderer :value="feat" />
    </UPageBody>
  </UPage>
</template>
