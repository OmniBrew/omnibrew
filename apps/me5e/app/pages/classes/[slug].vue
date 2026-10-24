<script setup lang="ts">
const route = useRoute()
const { data: klass } = await useAsyncData(route.path, () => queryCollection('classes').path(route.path).first())
if (!klass.value) throw createError({ statusCode: 404, statusMessage: 'Class not found', fatal: true })

const profs = computed(() => {
  const p = (klass.value?.profs ?? {}) as Record<string, { text?: string } | undefined>
  return ['armor', 'weapon', 'tool', 'saving-throw', 'skill']
    .filter(k => p[k]?.text)
    .map(k => [k.replace('-', ' '), p[k]!.text!])
})
</script>

<template>
  <main v-if="klass" class="mx-auto max-w-3xl p-6">
    <NuxtLink to="/classes" class="text-sm text-muted hover:underline">
      ← Classes
    </NuxtLink>
    <h1 class="mt-2 text-3xl font-semibold">
      {{ klass.name }}
    </h1>
    <p class="mt-1 text-muted">
      {{ klass.snippet }}
    </p>
    <div class="mt-4 flex gap-2">
      <UBadge :label="`Hit die d${klass.hitDie}`" />
      <UBadge :label="`Primary: ${(klass.primaryAbility ?? []).join(', ').toUpperCase()}`" variant="subtle" />
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
    <ContentRenderer :value="klass" class="mt-6" />
  </main>
</template>
