<script setup lang="ts">
/**
 * A vehicle's stat block: size and type, CR and cost, hull points, AC, speed,
 * range and crew, its systems and cargo, weapons and description. The `stats`
 * slot adds the game's own stats after hull points (ME5e: shield points).
 */
defineProps<{
  vehicle: {
    name?: string
    type?: string
    subtype?: string
    size?: string
    ac?: number
    hp?: number
    speed?: number
    crew?: { min: number, max: number | string }
    cargo?: number | string
    cost?: number | string
    cr?: number | string
    range?: { distance: number, units: string }
    image?: string
    weapons?: { name: string, damage: string }[]
    systems?: { type: string, crew: number | string, systems?: string[] }[]
    body?: unknown
  }
}>()
defineSlots<{ stats?: () => unknown }>()
const { t } = useI18n()
// Fields a record leaves out come back as null.
const has = (value: unknown) => value !== undefined && value !== null
</script>

<template>
  <div class="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
    <div class="min-w-0 flex-1 space-y-4 text-sm">
      <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p class="font-display font-semibold uppercase tracking-wider text-primary">
          {{ vehicleSubtitle(t, vehicle) }}
        </p>
        <p class="flex gap-4">
          <span v-if="has(vehicle.cr)"><span class="text-muted">{{ t('cr_title') }}:</span> {{ vehicle.cr }}</span>
          <span v-if="has(vehicle.cost)"><span class="text-muted">{{ t('cost_title') }}:</span> {{ itemCost(vehicle.cost, t('digit_separator')) }}</span>
        </p>
      </div>
      <USeparator color="secondary" :ui="{ border: 'border-t-2' }" />
      <dl class="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <StatItem :label="t('vehicles.hull_points')">
          {{ vehicle.hp ?? '-' }}
        </StatItem>
        <slot name="stats" />
        <StatItem :label="t('ac_abbr')">
          {{ vehicle.ac ?? '-' }}
        </StatItem>
        <StatItem :label="t('speed_title')">
          {{ vehicle.speed ?? '-' }}
        </StatItem>
        <StatItem :label="t('range_title')">
          {{ vehicle.range ? `${vehicle.range.distance} ${vehicle.range.units}` : '-' }}
        </StatItem>
        <StatItem :label="t('vehicles.crew')">
          {{ vehicle.crew ? vehicleCrew(t, vehicle.crew) : '-' }}
        </StatItem>
      </dl>
      <USeparator color="secondary" :ui="{ border: 'border-t-2' }" />
      <section v-if="vehicle.systems?.length || has(vehicle.cargo)">
        <h4 class="font-display text-base font-semibold text-highlighted">
          {{ t('vehicles.systems') }}
        </h4>
        <ul class="mt-1 list-disc space-y-0.5 ps-5">
          <li v-for="(s, i) in vehicle.systems ?? []" :key="i">
            <strong>{{ vehicleSystem(t, s).label }}:</strong> {{ vehicleSystem(t, s).crew }}
          </li>
          <li v-if="has(vehicle.cargo)">
            <strong>{{ t('vehicles.cargo') }}:</strong> {{ vehicleCargo(t, vehicle.cargo!) }}
          </li>
        </ul>
      </section>
      <section v-if="vehicle.weapons?.length">
        <h4 class="font-display text-base font-semibold text-highlighted">
          {{ t('vehicles.weapons') }}
        </h4>
        <ul class="mt-1 list-disc space-y-0.5 ps-5">
          <li v-for="w in vehicle.weapons" :key="w.name">
            <strong>{{ w.name }}.</strong> <MDC :value="w.damage" tag="span" unwrap="p" />
          </li>
        </ul>
      </section>
      <section v-if="vehicle.body">
        <h4 class="font-display text-base font-semibold text-highlighted">
          {{ t('vehicles.description') }}
        </h4>
        <ContentRenderer :value="vehicle" class="prose-record" />
      </section>
    </div>
    <img
      v-if="vehicle.image"
      :src="vehicle.image"
      :alt="vehicle.name ?? ''"
      loading="lazy"
      class="mx-auto max-h-48 max-w-full shrink-0 object-contain md:mx-0 md:max-h-72 md:w-1/3"
    >
  </div>
</template>
