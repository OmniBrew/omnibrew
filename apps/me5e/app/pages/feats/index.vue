<script setup lang="ts">
const { t, tm } = useI18n()
useSeoMeta({ title: t('feat_title', 2), description: t('meta.feats') })

const intro = computed(() => (tm('feat_intro') as unknown[]).map((_, i) => t(`feat_intro[${i}]`)))
const { data: feats } = await useAsyncData('feats', () => queryCollection('feats').order('name', 'ASC').all(), { default: () => [] })
type Feat = (typeof feats.value)[number]

const source = (f: Feat) => (f.new ? 'new' : 'phb')
const sourceLabel = (value: string) => (value === 'new' ? t('new_title') : t('phb'))
const columns: RecordColumn<Feat>[] = [
  { key: 'source', label: '', sort: source, class: 'w-16' },
  { key: 'name', label: t('name_title'), sort: f => f.name },
  { key: 'prerequisite', label: t('prerequisite_title'), class: 'hidden lg:table-cell' },
  { key: 'note', label: t('notes_title'), class: 'hidden sm:table-cell' },
]
const filters: RecordFilter<Feat>[] = [
  { key: 'source', label: t('type_title'), value: source, options: ['new', 'phb'].map(value => ({ value, label: sourceLabel(value) })) },
]
</script>

<template>
  <UPage>
    <RecordHeader :title="t('feat_title', 2)" />
    <UPageBody>
      <p v-for="(para, i) in intro" :key="i">
        {{ para }}
      </p>
      <RecordList :items="feats" :columns="columns" :filters="filters" :row-key="f => f.path" default-sort="name">
        <template #cell-source="{ item }">
          <UBadge :label="sourceLabel(source(item))" :color="item.new ? 'info' : 'warning'" variant="subtle" size="sm" />
        </template>
        <template #cell-name="{ item }">
          <NuxtLink :to="item.path" class="font-semibold text-highlighted hover:text-primary" @click.stop>
            {{ item.name }}
          </NuxtLink>
        </template>
        <template #cell-prerequisite="{ item }">
          <em v-if="item.prerequisite" class="text-muted">{{ item.prerequisite }}</em>
        </template>
        <template #cell-note="{ item }">
          <span class="text-muted">{{ item.note }}</span>
        </template>
        <template #expanded="{ item }">
          <p v-if="item.prerequisite" class="mb-3 text-sm">
            <strong>{{ t('prerequisite_title') }}</strong>
            <em class="ps-1">{{ item.prerequisite }}</em>
          </p>
          <ContentRenderer :value="item" class="text-sm" />
          <div class="mt-4 text-right">
            <UButton :to="item.path" :label="t('buttons.view_details')" variant="link" trailing-icon="i-lucide-arrow-right" size="sm" />
          </div>
        </template>
      </RecordList>
    </UPageBody>
  </UPage>
</template>
