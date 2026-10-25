<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('changelog_title'), description: t('meta.changelog') })

const { data: entries } = await useAsyncData('changelog', () =>
  queryCollection('changelog').select('path', 'stem', 'title', 'description', 'date', 'image').all(), { default: () => [] })
const posts = computed(() => newestFirst(entries.value.filter(e => !isJoke(recordId(e))), e => e.stem))
</script>

<template>
  <UPage>
    <RecordHeader :title="t('changelog_title')" />
    <UPageBody>
      <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <MeNewsCard v-for="p in posts" :key="p.path" :post="p" />
      </div>
    </UPageBody>
  </UPage>
</template>
