<script setup lang="ts">
/** A power's range: Self, Touch or a distance, plus its area of effect (size and shape). */
import type { Casting } from '../../utils/powers'

defineProps<{ casting: Casting }>()
const { t } = useI18n()

const AOE_ICONS: Record<string, string> = {
  sphere: 'i-lucide-circle',
  cylinder: 'i-lucide-cylinder',
  cone: 'i-lucide-triangle',
  cube: 'i-lucide-box',
  line: 'i-lucide-minus',
}
</script>

<template>
  <span class="whitespace-nowrap">
    <Distance v-if="(casting.range?.short ?? 0) > 1" :length="casting.range!.short!" abbr />
    <span v-else>{{ t(casting.range?.short === 1 ? 'touch_title' : 'self_title') }}</span>
    <span v-if="casting.range?.aoe" class="ms-1 text-xs text-muted">
      (<Distance v-if="casting.range.aoe.size" :length="casting.range.aoe.size" abbr />
      <UIcon
        v-if="casting.range.aoe.type"
        :name="AOE_ICONS[casting.range.aoe.type] ?? 'i-lucide-shapes'"
        class="ms-0.5 size-3 align-[-2px]"
        :aria-label="t(`aoe_types.${casting.range.aoe.type}`)"
      />)
    </span>
  </span>
</template>
