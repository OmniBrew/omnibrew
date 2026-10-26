<script setup lang="ts">
/**
 * The ME5e class color around a class page. Sets `--klass-accent`, which the
 * engine's class components use for their rules and the page's tabs, to the
 * class's palette in main.css (the sheet accents): 600 on a light page, 400 on a
 * dark one, so it clears 4.5:1 like the primary. Classes without a palette keep
 * the primary color.
 */
const props = defineProps<{ klass: string }>()
const { game } = useAppConfig()
const style = computed(() => (game.theme.accents.includes(props.klass)
  ? { '--me-class-light': `var(--color-${props.klass}-600)`, '--me-class-dark': `var(--color-${props.klass}-400)` }
  : {}))
</script>

<template>
  <div class="me-class-theme" :style="style">
    <slot />
  </div>
</template>

<style>
.me-class-theme {
  --klass-accent: var(--me-class-light, var(--ui-primary));
}
.dark .me-class-theme {
  --klass-accent: var(--me-class-dark, var(--ui-primary));
}
</style>
