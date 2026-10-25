<script setup lang="ts">
/** ME5e casting fields: the damage type a power primes, and whether it detonates primed targets. */
const props = defineProps<{ casting: { primes?: string | false, detonates?: boolean } }>()
const { t } = useI18n()

// The live site's prime colors (config.primeTypeText), as Tailwind classes for both modes.
const COLORS: Record<string, string> = {
  force: 'text-purple-700 dark:text-purple-300',
  necrotic: 'text-slate-600 dark:text-slate-300',
  fire: 'text-orange-700 dark:text-orange-400',
  cold: 'text-cyan-700 dark:text-cyan-400',
  lightning: 'text-blue-700 dark:text-blue-400',
  detonates: 'text-secondary',
}
const primes = computed(() => props.casting.primes || undefined)
</script>

<template>
  <span>
    <span v-if="primes" :class="COLORS[primes]">{{ t('primes_text', { type: t(`damage_types.${primes}`) }) }}</span>
    <span v-if="primes && casting.detonates" class="mx-1 text-muted">|</span>
    <span v-if="casting.detonates" :class="COLORS.detonates">{{ t('detonates_title') }}</span>
    <span v-if="!primes && !casting.detonates">-</span>
  </span>
</template>
