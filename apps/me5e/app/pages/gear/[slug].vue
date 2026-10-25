<script setup lang="ts">
const path = useContentPath().value
const { t } = useI18n()
const { data: gear } = await useAsyncData(path, () => queryCollection('gear').path(path).first())
if (!gear.value) throw createError({ statusCode: 404, statusMessage: 'Gear not found', fatal: true })

useSeoMeta({ title: gear.value.name, description: t('meta.info', { name: gear.value.name }) })
</script>

<template>
  <UPage v-if="gear">
    <RecordHeader
      :title="gear.name ?? ''"
      :headline="t('gear_title', 1)"
      :links="[{ label: t('gear_title', 2), icon: 'i-lucide-arrow-left', to: '/gear', variant: 'ghost' }]"
    >
      <ItemSubtitle :text="gearSubtitle(t, gear)" :cost="gear.cost" :text-class="rarityClass(gear.rarity)" :author="gear.author" class="mt-1" />
    </RecordHeader>
    <UPageBody>
      <MeGearInfo :gear="gear" />
    </UPageBody>
  </UPage>
</template>
