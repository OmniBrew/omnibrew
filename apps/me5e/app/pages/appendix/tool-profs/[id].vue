<script setup lang="ts">
const route = useRoute()
const path = useContentPath().value
const { t } = useI18n()
const { data: tool } = await useAsyncData(path, () => queryCollection('toolProfs').path(`/tool-profs/${route.params.id}`).first())
if (!tool.value) throw createError({ statusCode: 404, statusMessage: 'Tool not found', fatal: true })

useSeoMeta({ title: tool.value.name, description: t('meta.info', { name: tool.value.name }) })
</script>

<template>
  <UPage v-if="tool">
    <RecordHeader
      :title="tool.name ?? ''"
      :headline="tool.type ? t(`tool_prof_types.${tool.type}`) : t('tool_profs_title')"
      :links="[{ label: t('tool_profs_title'), icon: 'i-lucide-arrow-left', to: '/appendix/tool-profs', variant: 'ghost' }]"
    />
    <UPageBody>
      <ContentRenderer :value="tool" />
    </UPageBody>
  </UPage>
</template>
