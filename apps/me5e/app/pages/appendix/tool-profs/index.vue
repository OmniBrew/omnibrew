<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('tool_profs_title'), description: t('meta.tool_profs') })

const { data: tools } = await useAsyncData('tool-profs', () => queryCollection('toolProfs').order('name', 'ASC').all(), { default: () => [] })
type Tool = (typeof tools.value)[number]
const columns: RecordColumn<Tool>[] = [{ key: 'name', label: t('name_title'), sort: c => c.name }]
const filters: RecordFilter<Tool>[] = [
  { key: 'type', label: t('type_title'), value: c => c.type, options: uniqueOptions(tools.value, c => c.type, v => t(`tool_prof_types.${v}`)) },
]
</script>

<template>
  <UPage>
    <RecordHeader
      :title="t('tool_profs_title')"
      :headline="t('appendix_title')"
      :links="[{ label: t('rules_title'), to: '/manual/equipment#tools-kits' }]"
    />
    <UPageBody>
      <RecordList :items="tools" :columns="columns" :filters="filters" :row-key="c => c.path" default-sort="name">
        <template #cell-name="{ item }">
          <NuxtLink :to="`/appendix/tool-profs/${recordId(item)}`" class="font-semibold text-highlighted hover:text-primary" @click.stop>
            {{ item.name }}
          </NuxtLink>
          <p v-if="item.type" class="text-xs text-muted">
            {{ t(`tool_prof_types.${item.type}`) }}
          </p>
        </template>
        <template #expanded="{ item }">
          <ContentRenderer :value="item" />
        </template>
      </RecordList>
    </UPageBody>
  </UPage>
</template>
