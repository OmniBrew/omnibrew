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
  <NuxtLink :to="post.path" class="group block overflow-hidden rounded-md border border-default bg-default transition-colors hover:border-accented hover:bg-muted">
    <div class="overflow-hidden border-b border-default bg-muted" :class="imageClass ?? 'h-44'">
      <img v-if="post.image" :src="post.image" alt="" loading="lazy" referrerpolicy="no-referrer" class="size-full object-cover transition-transform group-hover:scale-[1.03] motion-reduce:transition-none">
    </div>
    <div class="p-4">
      <time :datetime="String(post.date)" class="font-mono text-xs text-muted tabular-nums">
        {{ formatDay(post.date, locale, 'short') }}
      </time>
      <h3 class="mt-1 font-label text-base font-semibold text-highlighted">
        {{ post.title }}
      </h3>
      <p class="mt-1 text-sm text-muted">
        {{ post.description }}
      </p>
    </div>
  </NuxtLink>
</template>
