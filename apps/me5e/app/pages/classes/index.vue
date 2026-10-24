<script setup lang="ts">
const { data: classes } = await useAsyncData('classes', () =>
  queryCollection('classes').select('path', 'name', 'snippet').order('name', 'ASC').all(),
)
</script>

<template>
  <main class="mx-auto max-w-4xl p-6">
    <h1 class="mb-6 text-2xl font-semibold">
      Classes
    </h1>
    <div class="grid gap-4 sm:grid-cols-2">
      <UCard v-for="c in classes" :key="c.path">
        <NuxtLink :to="c.path" class="text-lg font-medium text-primary hover:underline">
          {{ c.name }}
        </NuxtLink>
        <p class="mt-1 text-sm text-muted">
          {{ c.snippet }}
        </p>
      </UCard>
    </div>
  </main>
</template>
