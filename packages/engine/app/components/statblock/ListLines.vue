<script setup lang="ts">
/**
 * The power or item lines under a stat block feature ("3/Day: decoy,
 * overload (as a 2nd-level power)"), each name linking to its record's page.
 */
import type { StatListLine } from '../../utils/statblock'

const props = defineProps<{
  lines: StatListLine[]
  /** The collection the ids belong to (`powers`, `gear`). */
  collection: string
}>()

const { t } = useI18n()
const { game } = useAppConfig()
const page = (id: string) => recordPath(game.routes, props.collection, { id })
</script>

<template>
  <ul class="mt-1 space-y-0.5 ps-4">
    <li v-for="line in lines" :key="line.label">
      <span class="font-medium">{{ line.label }}</span>{{ ' ' }}
      <span v-for="(link, i) in line.links" :key="link.id"><NuxtLink :to="page(link.id)" class="italic text-primary hover:underline">{{ link.text }}</NuxtLink>{{ link.note ? ` ${link.note}` : '' }}{{ i < line.links.length - 1 ? ', ' : '' }}</span>
      <span v-if="!line.links.length" class="text-muted">{{ t('none') }}</span>
    </li>
  </ul>
</template>
