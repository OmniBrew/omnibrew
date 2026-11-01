<script setup lang="ts">
/** Shoulder mounts (the live weapon list's mount buttons): ranged weapons mounted (and equipped) within the mounts' weapons and slots. */
import { shoulderMounts, toggleShoulderMount } from '../../../../game/play'

const { t } = useI18n()
const { sheet, editable, apply } = useSheet()
const mounts = computed(() => shoulderMounts(sheet.value))
</script>

<template>
  <SheetPanel v-if="mounts" :title="t('sheet.me.shoulder_mounts', { n: mounts.mounted.length, max: mounts.max })">
    <ul class="flex flex-col gap-1 text-sm">
      <li v-for="w in mounts.weapons" :key="w.weapon.entry.uuid" class="flex items-center gap-2">
        <USwitch :model-value="w.mounted" :disabled="!editable || !w.mountable" size="sm" :aria-label="t('sheet.me.mount', { name: w.weapon.data.name })" @update:model-value="apply(s => toggleShoulderMount(s, w.weapon.entry.uuid))" />
        <span class="flex-1 truncate">{{ w.weapon.data.name }}</span>
        <span class="font-mono text-xs text-muted">{{ t('slot', { n: w.weapon.data.slots ?? 0 }, Number(w.weapon.data.slots ?? 0)) }}</span>
      </li>
      <li v-if="!mounts.weapons.length" class="text-muted">
        {{ t('sheet.me.no_mountable') }}
      </li>
    </ul>
  </SheetPanel>
</template>
