<script setup lang="ts">
const route = useRoute()
const slug = route.params.slug as string
const { data } = await useAsyncData(route.path, async () => {
  const [prose, mechanics] = await Promise.all([
    queryCollection('classes').path(route.path).first(),
    queryCollection('classData').where('stem', '=', slug).first(),
  ])
  return { prose, mechanics }
})
if (!data.value?.prose) throw createError({ statusCode: 404, statusMessage: 'Class not found', fatal: true })

const profs = computed(() => {
  const p = (data.value?.prose?.profs ?? {}) as Record<string, { text?: string }>
  return ['armor', 'weapon', 'tool', 'saving-throw', 'skill']
    .filter(k => p[k]?.text)
    .map(k => [k.replace('-', ' '), p[k]!.text!])
})
</script>

<template>
  <main v-if="data?.prose" class="mx-auto max-w-3xl p-6">
    <NuxtLink to="/classes" class="text-sm text-muted hover:underline">
      ← Classes
    </NuxtLink>
    <h1 class="mt-2 text-3xl font-semibold">
      {{ data.prose.name }}
    </h1>
    <p class="mt-1 text-muted">
      {{ data.prose.snippet }}
    </p>
    <div v-if="data.mechanics" class="mt-4 flex gap-2">
      <UBadge :label="`Hit die d${data.mechanics.hitDie}`" />
      <UBadge :label="`Primary: ${data.mechanics.primaryAbility.join(', ').toUpperCase()}`" variant="subtle" />
    </div>
    <dl class="mt-6 space-y-2 text-sm">
      <div v-for="[label, value] in profs" :key="label" class="grid grid-cols-4 gap-2">
        <dt class="capitalize text-muted">
          {{ label }}
        </dt>
        <dd class="col-span-3">
          {{ value }}
        </dd>
      </div>
    </dl>
    <ContentRenderer :value="data.prose" class="mt-6" />
  </main>
</template>
