<script setup lang="ts">
/** A species on the species list: picture, name and snippet, linking to its page. Slot `badges` follows the name. */
defineProps<{
  species: { name?: string | null, img?: string | null, snippet?: string | null }
  to: string
}>()
</script>

<template>
  <UCard
    as="article"
    variant="outline"
    class="group relative flex h-full flex-col overflow-hidden transition-colors hover:border-primary"
    :ui="{ header: 'p-0 sm:p-0', body: 'flex-1 p-4 sm:p-4' }"
  >
    <template v-if="species.img" #header>
      <img :src="species.img" alt="" loading="lazy" class="h-48 w-full object-cover object-top">
    </template>
    <h3 class="flex flex-wrap items-center gap-2 font-display text-xl font-semibold text-highlighted">
      <NuxtLink :to="to" class="after:absolute after:inset-0 group-hover:text-primary">
        {{ species.name }}
      </NuxtLink>
      <slot name="badges" />
    </h3>
    <p v-if="species.snippet" class="mt-2 text-sm text-muted">
      {{ species.snippet }}
    </p>
  </UCard>
</template>
