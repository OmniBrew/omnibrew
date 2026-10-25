<script setup lang="ts">
// A Player's Manual chapter (content/navigation/manual.yml). The introduction opens with the manual's title page.
const route = useRoute()
const { t } = useI18n()
const id = String(route.params.id)

const { data: chapters } = await useChapters('manual')
const chapter = chapters.value.find(c => c.id === id)
useSeoMeta({ title: chapter ? t(chapter.title ?? id) : t('manual.title'), description: t('meta.manual') })

const { data: version } = await useAsyncData('version', async () =>
  latestVersion(await queryCollection('changelog').select('stem', 'title', 'date').all()), { default: () => '' })
</script>

<template>
  <ChapterPage :id="id" navigation="manual" collection="manual">
    <template v-if="id === 'intro'" #header>
      <div class="mx-auto max-w-xl py-8 text-center">
        <img src="/images/me5e_logo_1200w.png" alt="Mass Effect 5e" class="mx-auto w-full max-w-md">
        <h1 class="mt-8 font-display text-4xl font-bold text-highlighted">
          {{ t('manual.title') }}
        </h1>
        <p class="mt-1 text-lg text-muted">
          {{ version }}
        </p>
        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <UButton color="secondary" :label="t('changelog_title')" to="/changelog" />
          <UButton color="secondary" :label="t('buttons.join_community')" to="/about" />
          <UButton color="secondary" :label="t('license_title')" to="/license" />
        </div>
      </div>
    </template>
  </ChapterPage>
</template>
