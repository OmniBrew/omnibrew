<script setup lang="ts">
const { data: powers } = await useAsyncData('powers', () =>
  queryCollection('powers').select('path', 'name', 'level', 'powerType', 'classes').order('level', 'ASC').order('name', 'ASC').all(),
)
const levelLabel = (level: number) => (level === 0 ? 'Cantrip' : `Level ${level}`)
</script>

<template>
  <main class="mx-auto max-w-4xl p-6">
    <h1 class="mb-6 text-2xl font-semibold">
      Powers
    </h1>
    <table class="w-full text-sm">
      <thead class="text-left text-muted">
        <tr>
          <th class="py-2">
            Name
          </th>
          <th>Level</th>
          <th>Type</th>
          <th>Classes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in powers" :key="p.path" class="border-t border-default">
          <td class="py-2">
            <NuxtLink :to="p.path" class="text-primary hover:underline">
              {{ p.name }}
            </NuxtLink>
          </td>
          <td>{{ levelLabel(p.level) }}</td>
          <td>
            <UBadge :label="p.powerType" variant="subtle" />
          </td>
          <td class="text-muted">
            {{ p.classes.join(', ') }}
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>
