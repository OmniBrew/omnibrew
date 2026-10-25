<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('bestiary_title', 2), description: t('meta.bestiary') })

const [{ data: npcs }, { data: challenge }] = await Promise.all([
  useAsyncData('bestiary', () => queryCollection('bestiary').order('name', 'ASC').all(), { default: () => [] }),
  useAsyncData('bestiary:crs', () => queryCollection('npcStats').select('stem', 'cr').all(), { default: () => [] }),
])
type Npc = (typeof npcs.value)[number]

// Challenge ratings are npc-stats ids ("00500" is CR 1/2), which sort in CR order.
const crLabel = new Map(challenge.value.map(c => [recordId(c), c.cr ?? '']))
const crOrder = [...crLabel.keys()].sort()
const faction = (n: Npc) => (n.unit ? t(`npc.unit_types.${n.unit}`) : '')

const columns: RecordColumn<Npc>[] = [
  { key: 'name', label: t('name_title'), sort: n => n.name },
  { key: 'unit', label: t('npc.faction_title'), sort: faction },
  { key: 'cr', label: t('npc.cr_title'), sort: n => n.cr },
]
const filters: RecordFilter<Npc>[] = [
  { key: 'unit', label: t('npc.faction_title'), value: n => n.unit, options: uniqueOptions(npcs.value, n => n.unit, v => t(`npc.unit_types.${v}`)) },
  { key: 'cr', label: t('npc.cr_title'), value: n => n.cr, options: uniqueOptions(npcs.value, n => n.cr, v => crLabel.get(v) ?? v, crOrder) },
]
</script>

<template>
  <UPage>
    <RecordHeader :title="t('bestiary_title', 2)" :links="[{ label: t('buttons.view_rules'), to: '/manual/bestiary' }]" />
    <UPageBody>
      <RecordList :items="npcs" :columns="columns" :filters="filters" :row-key="n => n.path" default-sort="name">
        <template #cell-name="{ item }">
          <NuxtLink :to="item.path" class="font-semibold text-highlighted hover:text-primary" @click.stop>
            {{ item.name }}
          </NuxtLink>
        </template>
        <template #cell-unit="{ item }">
          {{ faction(item) }}
        </template>
        <template #cell-cr="{ item }">
          {{ crLabel.get(item.cr ?? '') ?? item.cr }}
        </template>
        <template #expanded="{ item }">
          <MeNpcStatBlock :npc="item" />
          <div class="mt-4 flex justify-end">
            <UButton :to="item.path" variant="link" :label="t('buttons.view_details')" trailing-icon="i-lucide-arrow-right" />
          </div>
        </template>
      </RecordList>
    </UPageBody>
  </UPage>
</template>
