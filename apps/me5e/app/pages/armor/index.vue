<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('armor_title', 2), description: t('meta.armor') })

const { data: armor } = await useAsyncData('armor', () => queryCollection('armor').order('name', 'ASC').all(), { default: () => [] })
type Armor = (typeof armor.value)[number]

const PLACEMENTS = ['head', 'chest', 'arms', 'legs', 'body_armor']
const columns: RecordColumn<Armor>[] = [
  { key: 'name', label: t('name_title'), sort: a => a.name },
  { key: 'cost', label: t('cost_title'), sort: a => itemCostValue(a.cost), class: 'hidden sm:table-cell' },
  { key: 'placement', label: t('armor_placement_title'), sort: a => PLACEMENTS.indexOf(armorPlacement(a)) },
  { key: 'type', label: t('type_title'), sort: a => ['light', 'medium', 'heavy'].indexOf(a.armorType ?? '') },
  { key: 'notes', label: t('notes_title'), class: 'hidden md:table-cell' },
]
const filters: RecordFilter<Armor>[] = [
  { key: 'rarity', label: t('rarity_title'), value: a => a.rarity, options: uniqueOptions(armor.value, a => a.rarity, v => t(`rarities.${v}`), RARITY_ORDER) },
  { key: 'type', label: t('type_title'), value: a => a.armorType, options: uniqueOptions(armor.value, a => a.armorType, v => t(`armor_types.${v}`)) },
  { key: 'placement', label: t('armor_placement_title'), value: armorPlacement, options: uniqueOptions(armor.value, armorPlacement, v => t(`armor_placements.${v}_title`), PLACEMENTS) },
  { key: 'tags', label: t('tags_title'), value: a => a.tags ?? [], options: uniqueOptions(armor.value, a => a.tags ?? [], v => t(`tags.${v}`)) },
]
</script>

<template>
  <UPage>
    <RecordHeader
      :title="t('armor_title', 2)"
      :headline="t('equipment_title', 2)"
      :links="[{ label: t('buttons.view_rules'), icon: 'i-lucide-book-open', to: '/manual/equipment#armor' }]"
    />
    <UPageBody>
      <RecordList :items="armor" :columns="columns" :filters="filters" :row-key="a => a.path" default-sort="name">
        <template #cell-name="{ item }">
          <MeItemName :item="item" />
        </template>
        <template #cell-cost="{ item }">
          {{ itemCost(item.cost, t('digit_separator')) }}
        </template>
        <template #cell-placement="{ item }">
          {{ t(`armor_placements.${armorPlacement(item)}_title`) }}
        </template>
        <template #cell-type="{ item }">
          {{ t(`armor_types.${item.armorType}`) }}
        </template>
        <template #cell-notes="{ item }">
          <span class="text-muted">{{ itemTags(t, item.tags) }}</span>
        </template>
        <template #expanded="{ item }">
          <MeArmorInfo :armor="item" summary />
        </template>
      </RecordList>
    </UPageBody>
  </UPage>
</template>
