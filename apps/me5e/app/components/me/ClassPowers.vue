<script setup lang="ts">
/**
 * A class's Powers tab: its powers as on the powers list (type and level,
 * casting summary, and the power's info when a row opens).
 */
import type { PowersCollectionItem } from '@nuxt/content'

const props = defineProps<{ powers: PowersCollectionItem[] }>()
const { t } = useI18n()

const casting = (p: PowersCollectionItem) => (p.casting?.[0] ?? {}) as Casting
const columns: RecordColumn<PowersCollectionItem>[] = [
  { key: 'level', label: t('type_level_title'), sort: p => p.level },
  { key: 'name', label: t('name_title'), sort: p => p.name },
  { key: 'duration', label: t('duration_title'), class: 'hidden md:table-cell' },
  { key: 'range', label: t('range_area_title'), class: 'hidden md:table-cell' },
  { key: 'attack', label: t('attack_type_title'), class: 'hidden lg:table-cell' },
  { key: 'effect', label: t('damage_effect_title'), class: 'hidden lg:table-cell' },
]
const filters = computed<RecordFilter<PowersCollectionItem>[]>(() => [
  { key: 'type', label: t('type_title'), value: p => p.powerType, options: uniqueOptions(props.powers, p => p.powerType, v => t(`power_types.${v}`)) },
])
</script>

<template>
  <RecordList :items="powers" :columns="columns" :filters="filters" :row-key="p => p.path" default-sort="level">
    <template #cell-level="{ item }">
      <span class="flex items-center gap-2 whitespace-nowrap">
        <img :src="`/images/powers/${item.powerType}.svg`" :alt="t(`power_types.${item.powerType}`)" class="size-6">
        {{ powerLevel(t, item.level ?? 0) }}
      </span>
    </template>
    <template #cell-name="{ item }">
      <NuxtLink :to="item.path" class="font-semibold text-highlighted hover:text-primary" @click.stop>
        {{ item.name }}
      </NuxtLink>
    </template>
    <template #cell-duration="{ item }">
      <PowerDuration :casting="casting(item)" />
    </template>
    <template #cell-range="{ item }">
      <PowerRange :casting="casting(item)" />
    </template>
    <template #cell-attack="{ item }">
      {{ attackText(t, casting(item), true) }}
    </template>
    <template #cell-effect="{ item }">
      {{ effectText(t, item.tags, true) }}
    </template>
    <template #expanded="{ item }">
      <MePowerInfo :power="item" />
    </template>
  </RecordList>
</template>
