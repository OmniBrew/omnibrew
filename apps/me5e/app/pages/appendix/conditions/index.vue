<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('conditions_title'), description: t('meta.conditions') })

const { data: conditions } = await useAsyncData('conditions', () => queryCollection('conditions').order('name', 'ASC').all(), { default: () => [] })
type Condition = (typeof conditions.value)[number]
const columns: RecordColumn<Condition>[] = [{ key: 'name', label: t('name_title'), sort: c => c.name }]
</script>

<template>
  <UPage>
    <RecordHeader :title="t('conditions_title')" :headline="t('appendix_title')" />
    <UPageBody>
      <p>{{ t('conditions_intro') }}</p>
      <RecordList :items="conditions" :columns="columns" :row-key="c => c.path" default-sort="name">
        <template #cell-name="{ item }">
          <NuxtLink :id="recordId(item)" :to="`/appendix/conditions/${recordId(item)}`" class="font-semibold text-highlighted hover:text-primary" @click.stop>
            {{ item.name }}
          </NuxtLink>
        </template>
        <template #expanded="{ item }">
          <ConditionInfo :condition="item" />
        </template>
      </RecordList>
    </UPageBody>
  </UPage>
</template>
