<script setup lang="ts">
/** A changelog entry as a card: image with the date over it, title and description. */
defineProps<{
  post: { path?: string, title?: string, description?: string, date?: string | Date | null, image?: string }
  /** Tailwind height class for the image. */
  imageClass?: string
}>()
const { locale } = useI18n()
</script>

<template>
  <NuxtLink :to="post.path" class="group block overflow-hidden rounded-md border border-default bg-elevated/40 transition hover:border-primary">
    <div class="relative overflow-hidden bg-muted" :class="imageClass ?? 'h-44'">
      <img v-if="post.image" :src="post.image" alt="" loading="lazy" class="size-full object-cover transition group-hover:scale-105">
      <time :datetime="String(post.date)" class="absolute left-0 top-0 bg-primary px-3 py-1 font-display text-sm font-semibold text-inverted">
        {{ formatDay(post.date, locale, 'short') }}
      </time>
    </div>
    <div class="p-4">
      <h3 class="font-display text-xl font-bold text-highlighted">
        {{ post.title }}
      </h3>
      <p class="mt-1 text-sm text-muted">
        {{ post.description }}
      </p>
    </div>
  </NuxtLink>
</template>
