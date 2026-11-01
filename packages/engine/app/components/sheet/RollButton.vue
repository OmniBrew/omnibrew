<script setup lang="ts">
/**
 * A rollable value (design notes): a framed mono button that turns primary on hover,
 * 32 px on desktop and 40 px on phones (`size="lg"`: 44 px, for what's tapped
 * mid-session). Shift-click rolls with advantage, Alt-click with disadvantage.
 */
const props = defineProps<{ label: string, value: string | number, size?: 'md' | 'lg', highlight?: boolean }>()
const emit = defineEmits<{ roll: [mode: 'advantage' | 'disadvantage' | null] }>()

const click = (e: MouseEvent) => emit('roll', e.shiftKey ? 'advantage' : e.altKey ? 'disadvantage' : null)
</script>

<template>
  <button
    type="button"
    class="inline-flex min-w-11 shrink-0 items-center justify-center rounded-sm border bg-default px-2 font-mono text-sm font-semibold tabular-nums transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    :class="[props.size === 'lg' ? 'h-11' : 'h-8 max-sm:h-10', props.highlight ? 'border-primary text-primary' : 'border-accented text-highlighted']"
    :aria-label="props.label"
    :title="props.label"
    data-roll
    @click="click"
  >
    <slot>{{ props.value }}</slot>
  </button>
</template>
