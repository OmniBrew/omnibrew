<script setup lang="ts">
/**
 * MDC block component framing an image (or anything else), optionally narrower than the page:
 *
 *   ::figure{max-width="300"}
 *   ![Angara](https://…/angara.jpg)
 *   ::
 */
const props = defineProps<{
  maxWidth?: number | string
}>()
</script>

<template>
  <figure class="my-4 overflow-hidden rounded-md border border-default" :style="props.maxWidth ? { maxWidth: `${props.maxWidth}px` } : undefined">
    <slot mdc-unwrap="p" />
  </figure>
</template>
