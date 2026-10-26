<script setup lang="ts">
/**
 * A record page's heading: the kind of record as an eyebrow above the title, an
 * optional icon, the homebrew author, links on the right (a back link, the rules
 * page), and the section rule underneath.
 */
import type { ButtonProps } from '@nuxt/ui'

withDefaults(defineProps<{
  title: string
  /** What the record is ("Power", "Assault Rifle"). */
  headline?: string
  /** Text color class for the headline (a power type's or class's color); primary by default. */
  headlineClass?: string
  /** Image shown before the title. */
  image?: string
  /** `lg` (64 px) for a class's icon, `md` (56 px) for a power's. */
  imageSize?: 'md' | 'lg'
  author?: string
  links?: ButtonProps[]
  /** The section rule under the heading; off where the first section's rule does the job. */
  rule?: boolean
}>(), { headline: undefined, headlineClass: 'text-primary', image: undefined, imageSize: 'lg', author: undefined, links: undefined, rule: true })
</script>

<template>
  <header class="pt-7">
    <div class="flex flex-wrap items-start gap-4 pb-5">
      <img v-if="image" :src="image" alt="" class="shrink-0" :class="imageSize === 'lg' ? 'size-12 sm:size-16' : 'size-12 sm:size-14'">
      <div class="min-w-0 flex-1">
        <p v-if="headline" class="eyebrow" :class="headlineClass">
          {{ headline }}
        </p>
        <h1 class="mt-1 text-[1.75rem]/[2.125rem] font-bold tracking-[-0.01em] text-highlighted sm:text-[2.125rem]/10">
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
    </div>
    <div v-if="rule" class="section-rule" />
  </header>
</template>
