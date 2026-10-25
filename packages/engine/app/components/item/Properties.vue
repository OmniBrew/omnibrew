<script setup lang="ts">
/**
 * An item's properties with their values ("Light | Versatile (1d10)"), each
 * linked to its rules (the property collection's page in the game's routes).
 * `hide` leaves out properties the game shows as their own stat (ME heat).
 */
import type { ItemProperty } from '../../utils/items'

const props = withDefaults(defineProps<{
  properties?: ItemProperty[] | null
  /** Content collection of the property records. */
  collection?: string
  hide?: string[]
}>(), { properties: () => [], collection: 'weapon-properties', hide: () => [] })

const { t } = useI18n()
const { game } = useAppConfig()
const { distance } = useUnits()

// One query for every list on the page (instances share the key).
const { data: names } = useAsyncData(`item-properties:${props.collection}`, async () => {
  const name = props.collection.replace(/-([a-z\d])/g, (_, c: string) => c.toUpperCase())
  const records = await queryCollection(name as 'weaponProperties').select('stem', 'name').all()
  return Object.fromEntries(records.map(r => [recordId(r), r.name ?? '']))
}, { default: () => ({}) as Record<string, string> })

const shown = computed(() => (props.properties ?? [])
  .filter(p => !props.hide.includes(p.id))
  .map(p => ({
    id: p.id,
    text: itemPropertyText(t, names.value[p.id] || p.id, p.value, distance),
    to: recordPath(game.routes, props.collection, { id: p.id }),
  })))
</script>

<template>
  <p v-if="shown.length" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
    <template v-for="(p, i) in shown" :key="p.id">
      <span v-if="i" class="text-muted" aria-hidden="true">|</span>
      <NuxtLink v-if="p.to" :to="p.to" class="text-primary hover:underline" @click.stop>
        {{ p.text }}
      </NuxtLink>
      <span v-else>{{ p.text }}</span>
    </template>
  </p>
</template>
