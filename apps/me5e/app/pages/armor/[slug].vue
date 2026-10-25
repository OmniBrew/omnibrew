<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { data: armor } = await useAsyncData(route.path, () => queryCollection('armor').path(route.path).first())
if (!armor.value) throw createError({ statusCode: 404, statusMessage: 'Armor not found', fatal: true })

useSeoMeta({ title: armor.value.name, description: t('meta.info', { name: armor.value.name }) })
</script>

<template>
  <UPage v-if="armor">
    <RecordHeader
      :title="armor.name ?? ''"
      :headline="t('armor_title', 1)"
      :links="[{ label: t('armor_title', 2), icon: 'i-lucide-arrow-left', to: '/armor', variant: 'ghost' }]"
    >
      <ItemSubtitle :text="armorSubtitle(t, armor)" :cost="armor.cost" :text-class="rarityClass(armor.rarity)" :author="armor.author" class="mt-1" />
    </RecordHeader>
    <UPageBody>
      <MeArmorInfo :armor="armor" />
    </UPageBody>
  </UPage>
</template>
