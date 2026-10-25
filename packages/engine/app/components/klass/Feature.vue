<script setup lang="ts">
/**
 * One section of a class page (Hit Points, a class feature, a subclass): a
 * heading, an optional anchor id for links, the content, and a rule below.
 * The `accent` rule takes the class's color from the `--klass-accent` CSS
 * variable a game may set around the page (primary by default).
 */
withDefaults(defineProps<{
  title?: string
  id?: string
  /** `lg` for a subclass, `md` for a class page section, `sm` for a feature inside a subclass. */
  size?: 'lg' | 'md' | 'sm'
  /** The rule below: `accent` (the class color), `muted`, or none. */
  rule?: 'accent' | 'muted' | false
}>(), { title: undefined, id: undefined, size: 'md', rule: 'accent' })

defineSlots<{
  title?: () => unknown
  default?: () => unknown
}>()

// Feature descriptions use h3 for their own subsections, so a class page section is an h2.
const headings = { lg: 'text-3xl font-semibold', md: 'text-2xl font-bold', sm: 'text-xl font-bold' }
</script>

<template>
  <section :id="id" class="scroll-mt-24">
    <slot name="title">
      <component :is="size === 'sm' ? 'h3' : 'h2'" class="mb-2 font-display text-highlighted" :class="headings[size]">
        {{ title }}
      </component>
    </slot>
    <slot />
    <hr
      v-if="rule"
      class="my-6"
      :class="rule === 'accent' ? 'border-t-2 border-[color:var(--klass-accent,var(--ui-primary))]' : 'border-default'"
    >
  </section>
</template>
