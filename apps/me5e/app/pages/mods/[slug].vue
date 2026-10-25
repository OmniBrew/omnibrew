<script setup lang="ts">
const path = useContentPath().value
const { t } = useI18n()
const { data: mod } = await useAsyncData(path, () => queryCollection('mods').path(path).first())
if (!mod.value) throw createError({ statusCode: 404, statusMessage: 'Mod not found', fatal: true })

useSeoMeta({ title: mod.value.name, description: t('meta.info', { name: mod.value.name }) })
</script>

<template>
  <UPage v-if="mod">
    <RecordHeader
      :title="mod.name ?? ''"
      :headline="t('mod_title', 1)"
      :links="[{ label: t('mod_title', 2), icon: 'i-lucide-arrow-left', to: '/mods', variant: 'ghost' }]"
    >
      <ItemSubtitle :text="modSubtitle(t, mod)" :cost="mod.cost" :text-class="rarityClass(mod.rarity)" :author="mod.author" class="mt-1" />
    </RecordHeader>
    <UPageBody>
      <MeModInfo :mod="mod" />
    </UPageBody>
  </UPage>
</template>
