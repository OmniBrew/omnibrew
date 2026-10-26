<script setup lang="ts">
// A guide for Galaxy Masters (content/navigation/guide.yml).
const route = useRoute()
const { t } = useI18n()
const id = String(route.params.id)

const { data: chapters } = await useChapters('guide')
const chapter = chapters.value.find(c => c.id === id)
useSeoMeta({ title: chapter ? t(chapter.title ?? id) : t('guide.title'), description: t('meta.guide') })
</script>

<template>
  <ChapterPage :id="id" navigation="guide" collection="guide" :headline="t('guide.title')" />
</template>
