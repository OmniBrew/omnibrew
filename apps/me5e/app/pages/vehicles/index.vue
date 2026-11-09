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
      :links="[{ label: t('buttons.view_rules'), icon: 'i-lucide-book-open', to: '/manual/vehicles' }]"
    />
    <UPageBody>
      <VehicleList :vehicles="vehicles" :groups="['transport', 'starship']">
        <template #default="{ vehicle }">
          <MeVehicleInfo :vehicle="vehicle" />
          <!-- Vehicles have no pages of their own: the bookmark sits in the open row. -->
          <div class="mt-3">
            <BookmarkButton type="vehicles" :record-id="recordId(vehicle)" size="sm" />
          </div>
        </template>
      </VehicleList>
    </UPageBody>
  </UPage>
</template>
