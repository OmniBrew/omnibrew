<script setup lang="ts">
/**
 * A power's stats, description and damage by slot level. Slots: `stats` adds stat items
 * (passed the first casting entry), `aside` sits beside the description (ME5e: the
 * primer and detonator notes), the default slot follows (ME5e: advancement options).
 */
import type { Casting } from '../../utils/powers'

const props = defineProps<{
  power: { level?: number, tags?: string[], casting?: unknown[], body?: unknown }
}>()

const slots = defineSlots<{
  stats?: (props: { casting: Casting }) => unknown
  aside?: (props: { casting: Casting }) => unknown
  default?: () => unknown
}>()
const casting = computed(() => (props.power.casting?.[0] ?? {}) as Casting)
</script>

<template>
  <div>
    <PowerStats :power="power">
      <template #default="{ casting: first }">
        <slot name="stats" :casting="first" />
      </template>
    </PowerStats>
    <div class="mt-6 flex flex-wrap items-start gap-x-12 gap-y-6">
      <div class="min-w-0 max-w-[45rem] flex-[999_1_32rem]">
        <ContentRenderer v-if="power.body" :value="power" class="prose-record" />
        <PowerDamageTable :power="power" class="mt-6" />
      </div>
      <aside v-if="slots.aside" class="w-full flex-[1_1_15rem] empty:hidden sm:max-w-xs">
        <slot name="aside" :casting="casting" />
      </aside>
    </div>
    <slot />
  </div>
</template>
