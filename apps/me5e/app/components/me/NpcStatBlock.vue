<script setup lang="ts">
/**
 * An ME5e stat block: the engine's stat block with shields, the ME weapon
 * rules (notable properties, recoil as finesse) and the adept's power slots
 * for powercasting creatures.
 */
defineProps<{
  npc: StatBlockData & { body?: unknown, shields?: { capacity: number, regen?: number } }
}>()

const { t } = useI18n()
const { data: slots } = useAsyncData(
  'bestiary:power-slots',
  () => queryCollection('classes').path(`/classes/${NPC_POWERCASTING_CLASS}`).select('progression').first().then(c => npcPowerSlots(c?.progression)),
  { default: () => [] },
)
</script>

<template>
  <StatblockSheet :stats="npc" :rules="npcWeaponRules" :slots="slots">
    <template #defenses>
      <StatblockLine v-if="npc.shields" :label="t('shields_title')">
        {{ npcShieldsText(t, npc.shields) }}
      </StatblockLine>
    </template>
  </StatblockSheet>
</template>
