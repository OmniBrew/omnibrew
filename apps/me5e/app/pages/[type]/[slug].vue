<script setup lang="ts">
// Plain preview of any record without a page of its own yet: /manual/armor, /changelog/1-3-2, /class-features/blink.
const route = useRoute()
// Collections are named in camelCase (class-features → classFeatures); see content.config.ts.
const collection = String(route.params.type).replace(/-([a-z\d])/g, (_, c: string) => c.toUpperCase()) as 'manual'
const { data: record } = await useAsyncData(route.path, () => queryCollection(collection).path(route.path).first())
if (!record.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
const heading = computed(() => (record.value as { name?: string } | null)?.name ?? record.value?.title)
</script>

<template>
  <main v-if="record" class="mx-auto max-w-3xl p-6">
    <p class="text-sm text-muted">
      {{ route.params.type }}
    </p>
    <h1 class="mt-1 text-3xl font-semibold">
      {{ heading }}
    </h1>
    <ContentRenderer :value="record" class="mt-6" />
  </main>
</template>
