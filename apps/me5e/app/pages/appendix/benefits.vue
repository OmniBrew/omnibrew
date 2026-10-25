<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('benefits_title'), description: t('meta.benefits') })

const { data: benefits } = await useAsyncData('benefits', () => queryCollection('edges').where('type', '=', 'benefits').all(), { default: () => [] })
const tiers = computed(() => benefitTiers(benefits.value))
</script>

<template>
  <UPage>
    <RecordHeader :title="t('benefits_title')" :headline="t('appendix_title')" />
    <UPageBody>
      <section v-for="tier in tiers" :key="tier.threshold">
        <h2 class="mb-3 font-display text-2xl font-bold text-highlighted">
          {{ t('benefits.threshold') }} {{ tier.threshold }}
        </h2>
        <ul class="grid gap-4 lg:grid-cols-3">
          <li v-for="b in tier.benefits" :key="b.stem">
            <MeBenefitCard :benefit="b" />
          </li>
        </ul>
      </section>
    </UPageBody>
  </UPage>
</template>
