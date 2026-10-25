<script setup lang="ts">
const path = useContentPath().value
const { t } = useI18n()
const { data: weapon } = await useAsyncData(path, () => queryCollection('weapons').path(path).first())
if (!weapon.value) throw createError({ statusCode: 404, statusMessage: 'Weapon not found', fatal: true })

useSeoMeta({ title: weapon.value.name, description: t('meta.info', { name: weapon.value.name }) })
</script>

<template>
  <UPage v-if="weapon">
    <RecordHeader
      :title="weapon.name ?? ''"
      :headline="t('weapon_title', 1)"
      :links="[{ label: t('weapon_title', 2), icon: 'i-lucide-arrow-left', to: '/weapons', variant: 'ghost' }]"
    >
      <ItemSubtitle :text="weaponSubtitle(t, weapon)" :cost="weapon.cost" :text-class="rarityClass(weapon.rarity)" :author="weapon.author" class="mt-1" />
    </RecordHeader>
    <UPageBody>
      <MeWeaponInfo :weapon="weapon" />
    </UPageBody>
  </UPage>
</template>
