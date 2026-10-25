<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('mod_page_title'), description: t('meta.mods') })

const { data: mods } = await useAsyncData('mods', () => queryCollection('mods').order('name', 'ASC').all(), { default: () => [] })
type Mod = (typeof mods.value)[number]

const columns: RecordColumn<Mod>[] = [
  { key: 'name', label: t('name_title'), sort: m => m.name },
  { key: 'cost', label: t('cost_title'), sort: m => itemCostValue(m.cost), class: 'hidden sm:table-cell' },
  { key: 'placement', label: t('mod_placement_title'), sort: m => (m.placement ? t(`mod_placements.${m.placement}`) : undefined) },
  { key: 'availability', label: t('for_title') },
  { key: 'notes', label: t('notes_title'), class: 'hidden md:table-cell' },
]
const filters: RecordFilter<Mod>[] = [
  { key: 'type', label: t('type_title'), value: m => m.modType, options: uniqueOptions(mods.value, m => m.modType, v => t(`mod_types.${v}`)) },
  { key: 'rarity', label: t('rarity_title'), value: m => m.rarity, options: uniqueOptions(mods.value, m => m.rarity, v => t(`rarities.${v}`), RARITY_ORDER) },
  { key: 'placement', label: t('mod_placement_title'), value: m => m.placement, options: uniqueOptions(mods.value, m => m.placement, v => t(`mod_placements.${v}`)) },
  { key: 'availability', label: t('mod_availability_title'), value: m => m.availability ?? [], options: uniqueOptions(mods.value, m => m.availability ?? [], v => modAvailabilityName(t, v)) },
  { key: 'tags', label: t('tags_title'), value: m => m.tags ?? [], options: uniqueOptions(mods.value, m => m.tags ?? [], v => t(`tags.${v}`)) },
]
</script>

<template>
  <UPage>
    <RecordHeader
      :title="t('mod_page_title')"
      :headline="t('equipment_title', 2)"
      :links="[{ label: t('buttons.view_rules'), to: '/manual/equipment#mods' }]"
    />
    <UPageBody>
      <RecordList :items="mods" :columns="columns" :filters="filters" :row-key="m => m.path" default-sort="name">
        <template #cell-name="{ item }">
          <MeItemName :item="item" :subtitle="t(`mod_types.${item.modType}`)" />
        </template>
        <template #cell-cost="{ item }">
          {{ itemCost(item.cost, t('digit_separator')) }}
        </template>
        <template #cell-placement="{ item }">
          {{ item.placement ? t(`mod_placements.${item.placement}`) : '-' }}
        </template>
        <template #cell-availability="{ item }">
          {{ modAvailability(t, item) }}
        </template>
        <template #cell-notes="{ item }">
          <span class="text-muted">{{ itemTags(t, item.tags) }}</span>
        </template>
        <template #expanded="{ item }">
          <MeModInfo :mod="item" summary />
        </template>
      </RecordList>
    </UPageBody>
  </UPage>
</template>
