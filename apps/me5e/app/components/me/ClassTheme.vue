<script setup lang="ts">
/**
 * The ME5e class colors (n7.world's class themes) around a class page. Sets
 * `--klass-accent`, which the engine's class components use for their rules
 * and the page's tabs, to the class's color for the light or dark theme.
 * Classes without a theme keep the primary color.
 */
// Material colors from the live site: `light` shows on a light page (its darker
// shade), `dark` on a dark page (a lighter shade; the same when omitted).
const THEMES: Record<string, { light: string, dark?: string }> = {
  adept: { light: '#5e35b1', dark: '#9575cd' }, // deep-purple darken-1 / lighten-2
  engineer: { light: '#ffb300' }, // amber darken-1
  explorer: { light: '#283593', dark: '#536dfe' }, // indigo darken-3 / accent-2
  infiltrator: { light: '#bf360c', dark: '#ff5722' }, // deep-orange darken-4 / base
  musician: { light: '#00897b', dark: '#64ffda' }, // teal darken-1 / accent-2
  sentinel: { light: '#795548', dark: '#a1887f' }, // brown / lighten-2
  soldier: { light: '#b71c1c', dark: '#ff5252' }, // red darken-4 / accent-2
  tracker: { light: '#1b5e20', dark: '#00e676' }, // green darken-4 / accent-3
  vanguard: { light: '#880e4f', dark: '#f06292' }, // pink darken-4 / lighten-2
  experiment: { light: '#455a64', dark: '#78909c' }, // blue-grey darken-2 / lighten-1
}

const props = defineProps<{ klass: string }>()
const style = computed(() => {
  const theme = THEMES[props.klass]
  return theme ? { '--me-class-light': theme.light, '--me-class-dark': theme.dark ?? theme.light } : {}
})
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
