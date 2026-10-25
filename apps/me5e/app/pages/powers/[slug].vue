<script setup lang="ts">
const route = useRoute()
const { data: power } = await useAsyncData(route.path, () => queryCollection('powers').path(route.path).first())
if (!power.value) throw createError({ statusCode: 404, statusMessage: 'Power not found', fatal: true })

const { distance } = useUnits()
interface Casting {
  castingTime?: { length?: number, unit?: string }
  duration?: { length?: number, unit?: string }
  range?: { short?: number, aoe?: { type?: string, size?: number } | false }
  concentration?: boolean
}
const base = computed(() => (power.value?.casting?.[0] ?? {}) as Casting)
const stats = computed(() => {
  const c = base.value
  const range = c.range?.short ? distance(c.range.short) : 'Self'
  const aoe = c.range?.aoe ? ` (${distance(c.range.aoe.size ?? 0, { adj: true })} ${c.range.aoe.type})` : ''
  return [
    ['Casting time', `${c.castingTime?.length ?? ''} ${c.castingTime?.unit?.replace('_', ' ') ?? ''}`],
    ['Range', range + aoe],
    ['Duration', c.duration?.unit === 'instant' ? 'Instantaneous' : `${c.concentration ? 'Concentration, ' : ''}${c.duration?.length} ${c.duration?.unit}`],
  ]
})
</script>

<template>
  <main v-if="power" class="mx-auto max-w-3xl p-6">
    <NuxtLink to="/powers" class="text-sm text-muted hover:underline">
      ← Powers
    </NuxtLink>
    <h1 class="mt-2 text-3xl font-semibold">
      {{ power.name }}
    </h1>
    <div class="mt-2 flex flex-wrap gap-2">
      <UBadge :label="power.level === 0 ? 'Cantrip' : `Level ${power.level}`" />
      <UBadge :label="power.powerType" variant="subtle" />
      <UBadge v-for="c in power.classes" :key="c" :label="c" color="neutral" variant="outline" />
    </div>
    <dl class="mt-6 grid grid-cols-3 gap-4 text-sm">
      <div v-for="[label, value] in stats" :key="label">
        <dt class="text-muted">
          {{ label }}
        </dt>
        <dd>{{ value }}</dd>
      </div>
    </dl>
    <ContentRenderer :value="power" class="mt-6" />
    <section v-if="power.advancements?.length" class="mt-8">
      <h2 class="mb-3 text-xl font-semibold">
        Advancements
      </h2>
      <UCard v-for="a in power.advancements" :key="a.id" class="mb-3">
        <h3 class="font-medium">
          {{ a.name }}
        </h3>
        <!-- Text fields hold MDC too (:distance{...}); render them like the body. -->
        <MDC :value="a.text" unwrap="p" tag="p" class="mt-1 text-sm" />
      </UCard>
    </section>
  </main>
</template>
