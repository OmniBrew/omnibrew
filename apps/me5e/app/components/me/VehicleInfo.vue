<script setup lang="ts">
/** An ME5e vehicle: the engine's stat block plus shield points. */
import type { VehiclesCollectionItem } from '@nuxt/content'

defineProps<{ vehicle: VehiclesCollectionItem }>()
const { t } = useI18n()
</script>

<template>
  <VehicleInfo :vehicle="vehicle">
    <template #stats>
      <StatItem :label="t('vehicles.shield_points')">
        {{ vehicle.sp ?? '-' }}
      </StatItem>
    </template>
  </VehicleInfo>
</template>
