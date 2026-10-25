<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { data: condition } = await useAsyncData(route.path, () => queryCollection('conditions').path(`/conditions/${route.params.id}`).first())
if (!condition.value) throw createError({ statusCode: 404, statusMessage: 'Condition not found', fatal: true })

useSeoMeta({ title: condition.value.name, description: t('meta.info', { name: condition.value.name }) })
</script>

<template>
  <UPage v-if="condition">
    <RecordHeader
      :title="condition.name ?? ''"
      :headline="t('conditions_title')"
      :links="[{ label: t('conditions_title'), icon: 'i-lucide-arrow-left', to: '/appendix/conditions', variant: 'ghost' }]"
    />
    <UPageBody>
      <ConditionInfo :condition="condition" />
    </UPageBody>
  </UPage>
</template>
