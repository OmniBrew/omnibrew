<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: t('vehicle_title', 2), description: t('meta.vehicles') })

const { data: vehicles } = await useAsyncData('vehicles', () => queryCollection('vehicles').order('name', 'ASC').all(), { default: () => [] })
</script>

<template>
  <UPage>
    <RecordHeader
      :title="t('vehicle_title', 2)"
      :headline="t('equipment_title', 2)"
      :links="[{ label: t('buttons.view_rules'), to: '/manual/vehicles' }]"
    />
    <UPageBody>
      <VehicleList :vehicles="vehicles" :groups="['transport', 'starship']">
        <template #default="{ vehicle }">
          <MeVehicleInfo :vehicle="vehicle" />
        </template>
      </VehicleList>
    </UPageBody>
  </UPage>
</template>
