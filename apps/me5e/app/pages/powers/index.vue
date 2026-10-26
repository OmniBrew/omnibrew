<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('power_title', 2), description: t('meta.powers') })

const [{ data: powers }, { data: classes }] = await Promise.all([
  useAsyncData('powers', () => queryCollection('powers').order('level', 'ASC').order('name', 'ASC').all(), { default: () => [] }),
  useAsyncData('classes:names', () => queryCollection('classes').select('stem', 'name').order('name', 'ASC').all(), { default: () => [] }),
])
type Power = (typeof powers.value)[number]

const casting = (p: Power) => (p.casting?.[0] ?? {}) as Casting
const className = new Map(classes.value.map(c => [recordId(c), c.name ?? '']))

const columns: RecordColumn<Power>[] = [
  { key: 'level', label: t('type_level_title'), sort: p => p.level },
  { key: 'name', label: t('name_title'), sort: p => p.name },
  { key: 'duration', label: t('duration_title'), class: 'hidden md:table-cell' },
  { key: 'range', label: t('range_area_title'), class: 'hidden md:table-cell' },
  { key: 'attack', label: t('attack_type_title'), class: 'hidden lg:table-cell' },
  { key: 'effect', label: t('damage_effect_title'), class: 'hidden lg:table-cell' },
]
const filters: RecordFilter<Power>[] = [
  { key: 'type', label: t('type_title'), value: p => p.powerType, options: uniqueOptions(powers.value, p => p.powerType, v => t(`power_types.${v}`)) },
  { key: 'classes', label: t('class_title', 1), value: p => p.classes, options: classes.value.map(c => ({ value: recordId(c), label: c.name ?? '' })) },
]
</script>

<template>
  <UPage>
    <RecordHeader :title="t('power_title', 2)" :headline="t('manual.title')" :links="[{ label: t('buttons.view_rules'), icon: 'i-lucide-book-open', to: '/manual/powercasting' }]" />
    <UPageBody>
      <RecordList :items="powers" :columns="columns" :filters="filters" :row-key="p => p.path" default-sort="name">
        <template #cell-level="{ item }">
          <span class="flex items-center gap-2.5 whitespace-nowrap">
            <img :src="`/images/powers/${item.powerType}.svg`" :alt="t(`power_types.${item.powerType}`)" class="size-6.5">
            <span :class="item.level ? 'font-mono' : 'text-muted'">{{ powerLevel(t, item.level ?? 0) }}</span>
          </span>
        </template>
        <template #phone="{ item }">
          <span class="flex items-center gap-3">
            <img :src="`/images/powers/${item.powerType}.svg`" :alt="t(`power_types.${item.powerType}`)" class="size-6.5 shrink-0">
            <span class="min-w-0">
              <NuxtLink :to="item.path" class="block text-[0.9375rem]/5 font-semibold text-highlighted" @click.stop>{{ item.name }}</NuxtLink>
              <span class="mt-0.5 block text-[0.78125rem]/[1.125rem] text-muted">
                {{ powerLevel(t, item.level ?? 0) }} {{ t(`power_types.${item.powerType}`) }} · <PowerDuration :casting="casting(item)" /> · <PowerRange :casting="casting(item)" /> · {{ attackText(t, casting(item), true) }}
              </span>
            </span>
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
          <p class="mt-4 text-right text-xs text-muted">
            {{ (item.classes ?? []).map(k => className.get(k) ?? k).join(', ') }}
          </p>
        </template>
      </RecordList>
    </UPageBody>
  </UPage>
</template>
