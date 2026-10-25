<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('random_height_weight_title'), description: t('meta.random_height_weight') })

const { data: species } = await useAsyncData('species:dimensions', () =>
  queryCollection('species').where('type', 'IS NULL').select('stem', 'name', 'randomDimensions').order('name', 'ASC').all(), { default: () => [] })
</script>

<template>
  <UPage>
    <RecordHeader :title="t('random_height_weight_title')" :headline="t('appendix_title')" />
    <UPageBody>
      <p>
        <strong>{{ t('random_hw_titles.calc_height_title') }}</strong> {{ t('random_hw_titles.calc_height') }}
      </p>
      <p>
        <strong>{{ t('random_hw_titles.calc_weight_title') }}</strong> {{ t('random_hw_titles.calc_weight') }}
      </p>
      <SpeciesDimensionsRoller :species="species" />
      <SpeciesDimensionsTable :species="species" />
    </UPageBody>
  </UPage>
</template>
