<script setup lang="ts">
/**
 * A record page's heading: the kind of record above the title, an optional
 * icon, the homebrew author, and links on the right (e.g. the rules page).
 */
import type { ButtonProps } from '@nuxt/ui'

defineProps<{
  title: string
  /** What the record is ("Power", "Assault Rifle"). */
  headline?: string
  /** Image shown before the title. */
  image?: string
  author?: string
  links?: ButtonProps[]
}>()
</script>

<template>
  <header class="flex flex-wrap items-start gap-4 border-b border-default pb-5">
    <img v-if="image" :src="image" alt="" class="size-12 shrink-0 sm:size-16">
    <div class="min-w-0 flex-1">
      <p v-if="headline" class="font-display text-sm font-semibold uppercase tracking-widest text-primary">
        {{ headline }}
      </p>
      <h1 class="font-display text-3xl font-bold text-highlighted sm:text-4xl">
        {{ title }}
      </h1>
      <p v-if="author" class="mt-1 text-sm italic text-muted">
        by {{ author }}
      </p>
      <slot />
    </div>
    <div v-if="links?.length" class="flex flex-wrap gap-2">
      <UButton v-for="(link, i) in links" :key="i" variant="outline" v-bind="link" />
    </div>
  </header>
</template>
