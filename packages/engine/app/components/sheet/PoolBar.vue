<script setup lang="ts">
/**
 * One vitals pool (design notes "Pool rows"): an 8 px color key and label, a 6 px
 * continuous bar on a `bg-accented` track (diamond pips for a pool counted in ticks),
 * and the value in mono. `row` lays it out on one line.
 */
const props = defineProps<{ label: string, color: string, current: number, max: number, ticks?: boolean, row?: boolean }>()
const pct = computed(() => (props.max > 0 ? Math.min(100, Math.max(0, (props.current / props.max) * 100)) : 0))
</script>

<template>
  <div class="min-w-0" :class="props.row ? 'flex flex-wrap items-center gap-x-3 gap-y-1' : 'flex flex-col gap-1.5'">
    <div class="flex items-center gap-2 text-sm" :class="props.row ? 'w-28 shrink-0' : 'justify-between'">
      <span class="flex min-w-0 items-center gap-2">
        <span class="size-2 shrink-0 bg-current" :class="props.color" />
        <span class="truncate eyebrow text-muted">{{ props.label }}</span>
      </span>
      <span v-if="!props.row" class="font-mono text-base font-semibold tabular-nums text-highlighted" data-value>{{ props.current }}<span class="text-xs text-muted">/{{ props.max }}</span></span>
    </div>
    <div v-if="props.ticks" class="flex items-center gap-1.5" :class="{ 'flex-1': props.row }" role="img" :aria-label="`${props.label} ${props.current}/${props.max}`">
      <span v-for="n in props.max" :key="n" class="size-2.5 rotate-45" :class="n <= props.current ? ['bg-current', props.color] : 'border border-accented'" />
    </div>
    <div v-else class="h-1.5 min-w-16 shrink-0 overflow-hidden rounded-full bg-accented" :class="props.row ? 'flex-1' : 'w-full'" role="progressbar" :aria-label="props.label" :aria-valuenow="props.current" aria-valuemin="0" :aria-valuemax="props.max">
      <div class="h-full rounded-full bg-current transition-[width]" :class="props.color" :style="{ width: `${pct}%` }" />
    </div>
    <span v-if="props.row" class="font-mono text-sm tabular-nums text-highlighted" data-value>{{ props.current }}/{{ props.max }}</span>
    <div v-if="$slots.actions" class="flex items-center gap-1" :class="props.row ? '' : 'mt-1'">
      <slot name="actions" />
    </div>
  </div>
</template>
