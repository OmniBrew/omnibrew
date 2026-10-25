<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('skills_title'), description: t('meta.skills') })

const { data: skills } = await useAsyncData('skills', () => queryCollection('skills').order('name', 'ASC').all(), { default: () => [] })
</script>

<template>
  <UPage>
    <RecordHeader :title="t('skills_title')" :headline="t('appendix_title')" />
    <UPageBody>
      <div class="divide-y divide-default">
        <section v-for="s in skills" :id="recordId(s)" :key="s.path" class="scroll-mt-24 py-4">
          <h2 class="font-display text-lg font-semibold text-highlighted">
            {{ s.name }}
            <ChangeBadge v-if="s.is_new" type="new" />
          </h2>
          <p class="text-sm text-muted">
            {{ t(`abilities.${s.link}.title`) }}
          </p>
          <ContentRenderer :value="s" class="mt-2 text-sm" />
        </section>
      </div>
    </UPageBody>
  </UPage>
</template>
