<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { data: npc } = await useAsyncData(route.path, () => queryCollection('bestiary').path(route.path).first())
if (!npc.value) throw createError({ statusCode: 404, statusMessage: 'Creature not found', fatal: true })

useSeoMeta({ title: npc.value.name, description: t('meta.info', { name: npc.value.name }) })
</script>

<template>
  <UPage v-if="npc">
    <RecordHeader
      :title="npc.name ?? ''"
      :headline="npc.unit && t(`npc.unit_types.${npc.unit}`)"
      :author="npc.author"
      :links="[{ label: t('bestiary_title', 2), icon: 'i-lucide-arrow-left', to: '/bestiary', variant: 'ghost' }]"
    />
    <UPageBody>
      <MeNpcStatBlock :npc="npc" />
    </UPageBody>
  </UPage>
</template>
