<script setup lang="ts">
/** A leveled power's damage at each slot level it lists (`damageBySlot`); nothing when it doesn't scale. */
const props = defineProps<{ power: { level?: number, casting?: unknown[] } }>()
const { t, te } = useI18n()
const table = computed(() => damageBySlot(props.power))
const typeName = (type: string) => (te(`damage_types.${type}`) ? t(`damage_types.${type}`) : te(`sheet.damage_types.${type}`) ? t(`sheet.damage_types.${type}`) : type)
</script>

<template>
  <div v-if="table" data-power-damage>
    <p class="mb-2 eyebrow text-muted">
      {{ t('power_damage_by_slot') }}
    </p>
    <div class="overflow-x-auto rounded-md border border-default">
      <table class="w-full text-sm">
        <thead class="border-b border-accented bg-muted">
          <tr>
            <th scope="col" class="px-3 py-2 text-left eyebrow text-muted">
              {{ t('power_slot_title') }}
            </th>
            <th v-for="l in table.levels" :key="l" scope="col" class="px-3 py-2 text-center eyebrow text-muted">
              {{ powerLevel(t, l) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in table.rows" :key="row.type" class="border-b border-default last:border-0">
            <th scope="row" class="px-3 py-2 text-left font-normal text-muted capitalize">
              {{ typeName(row.type) }}
            </th>
            <td v-for="(roll, i) in row.rolls" :key="i" class="px-3 py-2 text-center font-mono text-highlighted tabular-nums">
              {{ roll }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
