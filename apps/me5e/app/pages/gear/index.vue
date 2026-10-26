<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('gear_title', 2), description: t('meta.gear') })

const { data: gear } = await useAsyncData('gear', () => queryCollection('gear').order('name', 'ASC').all(), { default: () => [] })
type Gear = (typeof gear.value)[number]

const columns: RecordColumn<Gear>[] = [
  { key: 'name', label: t('name_title'), sort: g => g.name },
  { key: 'cost', label: t('cost_title'), sort: g => itemCostValue(g.cost) },
  { key: 'weight', label: t('weight_title'), sort: g => g.weight, class: 'hidden sm:table-cell' },
]
const filters: RecordFilter<Gear>[] = [
  { key: 'rarity', label: t('rarity_title'), value: g => g.rarity, options: uniqueOptions(gear.value, g => g.rarity, v => t(`rarities.${v}`), RARITY_ORDER) },
  { key: 'type', label: t('type_title'), value: g => g.gearType, options: uniqueOptions(gear.value, g => g.gearType, v => t(`gear_types.${v}`)) },
]
</script>

<template>
  <UPage>
    <RecordHeader
      :title="t('gear_title', 2)"
      :headline="t('equipment_title', 2)"
      :links="[{ label: t('buttons.view_rules'), icon: 'i-lucide-book-open', to: '/manual/equipment' }]"
    />
    <UPageBody>
      <RecordList :items="gear" :columns="columns" :filters="filters" :row-key="g => g.path" default-sort="name">
        <template #cell-name="{ item }">
          <MeItemName :item="item" :subtitle="gearTypeText(t, item)" />
        </template>
        <template #cell-cost="{ item }">
          {{ itemCost(item.cost, t('digit_separator')) }}
        </template>
        <template #cell-weight="{ item }">
          <ItemWeight :pounds="item.weight" />
        </template>
        <template #expanded="{ item }">
          <MeGearInfo :gear="item" summary />
        </template>
      </RecordList>
    </UPageBody>
  </UPage>
</template>
