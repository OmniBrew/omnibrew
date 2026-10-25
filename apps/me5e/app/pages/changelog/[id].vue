<script setup lang="ts">
const route = useRoute()
const { t, locale } = useI18n()
const { data: post } = await useAsyncData(route.path, () => queryCollection('changelog').path(`/changelog/${route.params.id}`).first())
if (!post.value) throw createError({ statusCode: 404, statusMessage: 'Changelog entry not found', fatal: true })

useSeoMeta({ title: post.value.title, description: post.value.description, ogImage: post.value.image })
</script>

<template>
  <UPage v-if="post">
    <RecordHeader :title="post.title ?? ''" :headline="t('changelog_title')">
      <p class="mt-1 italic text-muted">
        {{ formatDay(post.date, locale) }}
      </p>
    </RecordHeader>
    <UPageBody>
      <ContentRenderer :value="post" />
      <UButton color="secondary" icon="i-lucide-arrow-left" :label="t('buttons.back_to_changelog')" to="/changelog" class="mt-8" />
    </UPageBody>
  </UPage>
</template>
