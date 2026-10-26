<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('weapon_title', 2), description: t('meta.weapons') })

const [{ data: weapons }, { data: properties }] = await Promise.all([
  useAsyncData('weapons', () => queryCollection('weapons').order('name', 'ASC').all(), { default: () => [] }),
  useAsyncData('weapon-properties:names', () => queryCollection('weaponProperties').select('stem', 'name').all(), { default: () => [] }),
])
type Weapon = (typeof weapons.value)[number]

const propertyName = new Map(properties.value.map(p => [recordId(p), p.name ?? '']))
// Heat has its own column, as on the live site.
const propertyIds = (w: Weapon) => itemPropertyIds(w.properties as ItemProperty[], ['heat'])

const columns: RecordColumn<Weapon>[] = [
  { key: 'name', label: t('name_title'), sort: w => w.name },
  { key: 'damage', label: t('damage_title'), sort: w => itemDamageAverage(w.damage as ItemDamage), class: 'font-mono' },
  { key: 'heat', label: t('heat_title'), sort: w => weaponHeat(w), class: 'hidden lg:table-cell', numeric: true },
  { key: 'range', label: t('range_title'), sort: w => w.range?.short, class: 'hidden lg:table-cell', numeric: true },
  { key: 'weight', label: t('weight_title'), sort: w => w.weight, class: 'hidden lg:table-cell', numeric: true },
  { key: 'cost', label: t('cost_title'), sort: w => itemCostValue(w.cost), class: 'hidden lg:table-cell', numeric: true },
]
const filters: RecordFilter<Weapon>[] = [
  { key: 'rarity', label: t('rarity_title'), value: w => w.rarity, options: uniqueOptions(weapons.value, w => w.rarity, v => t(`rarities.${v}`), RARITY_ORDER) },
  { key: 'type', label: t('type_title'), value: w => w.weaponType, options: uniqueOptions(weapons.value, w => w.weaponType, v => t(`weapon_types.${v}`, 1)) },
  { key: 'properties', label: t('weapon_props_title'), value: propertyIds, options: uniqueOptions(weapons.value, propertyIds, id => propertyName.get(id) || id) },
]
</script>

<template>
  <UPage>
    <RecordHeader
      :title="t('weapon_title', 2)"
      :headline="t('equipment_title', 2)"
      :links="[{ label: t('buttons.view_rules'), icon: 'i-lucide-book-open', to: '/manual/equipment#weapons' }]"
    />
    <UPageBody>
      <RecordList :items="weapons" :columns="columns" :filters="filters" :row-key="w => w.path" default-sort="name">
        <template #meta>
          <span class="hidden flex-wrap gap-1.5 md:flex">
            <MeRarityBadge v-for="r in RARITY_ORDER.filter(r => r !== 'varies')" :key="r" :rarity="r" />
          </span>
        </template>
        <template #cell-name="{ item }">
          <MeItemName :item="item" :subtitle="t(`weapon_types.${item.weaponType}`, 1)" />
        </template>
        <template #phone="{ item }">
          <MeItemName :item="item" :subtitle="`${t(`weapon_types.${item.weaponType}`, 1)} · ${itemDamage(t, item.damage as ItemDamage, item.additionalDamage as ItemDamage[])}`" />
        </template>
        <template #cell-damage="{ item }">
          {{ itemDamage(t, item.damage as ItemDamage, item.additionalDamage as ItemDamage[]) }}
        </template>
        <template #cell-heat="{ item }">
          {{ weaponHeat(item) ?? '-' }}
        </template>
        <template #cell-range="{ item }">
          <ItemRange :range="item.range" />
        </template>
        <template #cell-weight="{ item }">
          <ItemWeight :pounds="item.weight" />
        </template>
        <template #cell-cost="{ item }">
          {{ itemCost(item.cost, t('digit_separator')) }}
        </template>
        <template #expanded="{ item }">
          <MeWeaponInfo :weapon="item" summary />
        </template>
      </RecordList>
    </UPageBody>
  </UPage>
</template>
