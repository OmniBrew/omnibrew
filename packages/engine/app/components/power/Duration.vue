<script setup lang="ts">
/** A power's duration; concentration shows as a "C" badge, or in words with `long`. */
import type { Casting } from '../../utils/powers'

const props = defineProps<{ casting: Casting, long?: boolean }>()
const { t } = useI18n()
const text = computed(() => durationText(t, props.casting))
</script>

<template>
  <span v-if="casting.concentration && long">{{ t('concentration_text', { time: text }) }}</span>
  <span v-else class="inline-flex items-center gap-1 whitespace-nowrap">
    <span
      v-if="casting.concentration"
      class="inline-flex size-4 items-center justify-center rounded-full bg-inverted text-[0.625rem] font-bold text-inverted"
      :title="t('concentration_title')"
    >{{ t('concentration_abbr') }}</span>
    {{ text }}
  </span>
</template>
