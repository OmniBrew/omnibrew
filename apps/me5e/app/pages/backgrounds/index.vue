<script setup lang="ts">
const { t, tm } = useI18n()
useSeoMeta({ title: t('background_title', 2), description: t('meta.backgrounds') })

const intro = computed(() => (tm('background_intro') as unknown[]).map((_, i) => t(`background_intro[${i}]`)))
const { data: backgrounds } = await useAsyncData('backgrounds', () => queryCollection('backgrounds').order('name', 'ASC').all(), { default: () => [] })
type Background = (typeof backgrounds.value)[number]
const columns: RecordColumn<Background>[] = [{ key: 'name', label: t('name_title'), sort: b => b.name }]
</script>

<template>
  <UPage>
    <RecordHeader :title="t('background_title', 2)" />
    <UPageBody>
      <p v-for="(para, i) in intro" :key="i">
        {{ para }}
      </p>
      <RecordList :items="backgrounds" :columns="columns" :row-key="b => b.path" default-sort="name">
        <template #cell-name="{ item }">
          <NuxtLink :to="item.path" class="font-semibold text-highlighted hover:text-primary" @click.stop>
            {{ item.name }}
          </NuxtLink>
        </template>
        <template #expanded="{ item }">
          <ContentRenderer :value="item" class="text-sm" />
          <div class="mt-4 text-right">
            <UButton :to="item.path" :label="t('buttons.view_details')" variant="link" trailing-icon="i-lucide-arrow-right" size="sm" />
          </div>
        </template>
      </RecordList>
    </UPageBody>
  </UPage>
</template>
