<script setup lang="ts">
const path = useContentPath().value
const { t } = useI18n()
const { data: power } = await useAsyncData(path, () => queryCollection('powers').path(path).first())
if (!power.value) throw createError({ statusCode: 404, statusMessage: 'Power not found', fatal: true })

useSeoMeta({ title: power.value.name, description: t('meta.info', { name: power.value.name }) })
</script>

<template>
  <UPage v-if="power">
    <RecordHeader
      :title="power.name ?? ''"
      :headline="`${t(`power_types.${power.powerType}`)} ${t('power_title', 1)} · ${powerLevel(t, power.level ?? 0)}`"
      :headline-class="powerTypeClass(power.powerType)"
      :image="`/images/powers/${power.powerType}.svg`"
      image-size="md"
      :author="power.author"
      :links="[{ label: t('power_title', 2), icon: 'i-lucide-arrow-left', to: '/powers', variant: 'ghost' }]"
    />
    <UPageBody>
      <MePowerInfo :power="power" />
    </UPageBody>
  </UPage>
</template>
