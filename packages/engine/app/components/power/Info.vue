<script setup lang="ts">
/**
 * A power's stats and description. Slots: `stats` adds stat items (passed the
 * first casting entry), the default slot follows the description (ME5e puts
 * advancement options there).
 */
import type { Casting } from '../../utils/powers'

defineProps<{
  power: { level?: number, tags?: string[], casting?: unknown[], body?: unknown }
}>()

defineSlots<{
  stats?: (props: { casting: Casting }) => unknown
  default?: () => unknown
}>()
</script>

<template>
  <div>
    <PowerStats :power="power">
      <template #default="{ casting }">
        <slot name="stats" :casting="casting" />
      </template>
    </PowerStats>
    <USeparator color="secondary" class="my-4" :ui="{ border: 'border-t-2' }" />
    <ContentRenderer v-if="power.body" :value="power" class="prose-record" />
    <slot />
  </div>
</template>
