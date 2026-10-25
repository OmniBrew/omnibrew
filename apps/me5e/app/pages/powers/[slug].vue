<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { data: power } = await useAsyncData(route.path, () => queryCollection('powers').path(route.path).first())
if (!power.value) throw createError({ statusCode: 404, statusMessage: 'Power not found', fatal: true })

useSeoMeta({ title: power.value.name, description: t('meta.info', { name: power.value.name }) })
</script>

<template>
  <UPage v-if="power">
    <RecordHeader
      :title="power.name ?? ''"
      :headline="`${t(`power_types.${power.powerType}`)} ${t('power_title', 1)}`"
      :image="`/images/powers/${power.powerType}.svg`"
      :author="power.author"
      :links="[{ label: t('power_title', 2), icon: 'i-lucide-arrow-left', to: '/powers', variant: 'ghost' }]"
    />
    <UPageBody>
      <MePowerInfo :power="power" />
    </UPageBody>
  </UPage>
</template>
