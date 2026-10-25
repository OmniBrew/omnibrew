<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('weapon_props_title'), description: t('meta.weapon_props') })

const { data: properties } = await useAsyncData('weapon-properties', () => queryCollection('weaponProperties').order('name', 'ASC').all(), { default: () => [] })
</script>

<template>
  <UPage>
    <RecordHeader
      :title="t('weapon_props_title')"
      :headline="t('appendix_title')"
      :links="[{ label: t('weapon_title', 2), to: '/weapons' }]"
    />
    <UPageBody>
      <div class="divide-y divide-default">
        <section v-for="p in properties" :id="recordId(p)" :key="p.path" class="scroll-mt-24 py-4">
          <h2 class="font-display text-lg font-semibold text-highlighted">
            {{ p.name }}
            <ChangeBadge v-if="p.is_new" type="new" />
          </h2>
          <ContentRenderer :value="p" class="mt-2 text-sm" />
        </section>
      </div>
    </UPageBody>
  </UPage>
</template>
