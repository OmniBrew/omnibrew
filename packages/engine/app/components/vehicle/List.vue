<script setup lang="ts" generic="V extends { stem?: string, name?: string, type?: string }">
/**
 * Vehicles grouped by type, each a collapsible row with the record id as its
 * element id, so `/vehicles#normandy` (a search result) opens and scrolls to
 * it. `groups` orders the types; each heading is the `vehicle_groups.<type>`
 * message. The default slot renders a vehicle (defaults to `<VehicleInfo>`).
 */
const props = defineProps<{
  vehicles: V[]
  groups: string[]
}>()
defineSlots<{ default?: (props: { vehicle: V }) => unknown }>()

const { t } = useI18n()
const route = useRoute()
const open = ref<Record<string, boolean>>({})

const grouped = computed(() => props.groups
  .map(type => ({ type, vehicles: props.vehicles.filter(v => v.type === type) }))
  .filter(g => g.vehicles.length))

function openFromHash() {
  const id = decodeURIComponent(route.hash.slice(1))
  if (!id || !props.vehicles.some(v => recordId(v) === id)) return
  open.value = { ...open.value, [id]: true }
  nextTick(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }))
}
onMounted(openFromHash)
watch(() => route.hash, openFromHash)
</script>

<template>
  <div class="space-y-8">
    <section v-for="g in grouped" :key="g.type">
      <h2 class="mb-3 font-display text-xl font-semibold text-highlighted">
        {{ t(`vehicle_groups.${g.type}`) }}
      </h2>
      <div class="divide-y divide-default rounded-md border border-default">
        <UCollapsible
          v-for="v in g.vehicles"
          :id="recordId(v)"
          :key="recordId(v)"
          v-model:open="open[recordId(v)]"
          class="scroll-mt-24"
        >
          <button
            type="button"
            class="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-semibold text-highlighted hover:bg-elevated/60"
          >
            {{ v.name }}
            <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180" />
          </button>
          <template #content>
            <div class="border-t border-default bg-muted/40 px-4 py-4">
              <slot :vehicle="v">
                <VehicleInfo :vehicle="v" />
              </slot>
            </div>
          </template>
        </UCollapsible>
      </div>
    </section>
  </div>
</template>
