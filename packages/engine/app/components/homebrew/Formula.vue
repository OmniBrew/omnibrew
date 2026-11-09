<script setup lang="ts">
/**
 * A value formula in plain words (plan/26 §1.3): a number, the proficiency bonus, an ability
 * modifier, or the character level (times a number). Writes the engine's formula shapes
 * (`{ type: 'flat', value: 2 }`); a formula of another kind (from a record this one is based
 * on) is kept until changed.
 */
type Formula = { type: string, value?: unknown, multiplier?: number }
const props = defineProps<{ modelValue: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: Formula | undefined] }>()
const { t } = useI18n()
const options = useHomebrewOptions()

const f = computed(() => (props.modelValue && typeof props.modelValue === 'object' ? props.modelValue as Formula : undefined))
const KINDS = ['flat', 'proficiency', 'mod', 'level'] as const
const kind = computed(() => f.value?.type as typeof KINDS[number] | undefined)
const other = computed(() => kind.value !== undefined && !(KINDS as readonly string[]).includes(kind.value))
const kinds = computed(() => KINDS.map(k => ({ value: k, label: t(`homebrew.formula.${k}`) })))
const abilities = computed(() => options.enumItems('abilities', 'abilities.{v}.title'))

function setKind(k: string | undefined) {
  if (!k) emit('update:modelValue', undefined)
  else if (k === 'flat') emit('update:modelValue', { type: 'flat', value: 1 })
  else if (k === 'mod') emit('update:modelValue', { type: 'mod', value: 'str' })
  else emit('update:modelValue', { type: k })
}
const setLevel = (v: unknown) => emit('update:modelValue', !v || Number(v) === 1 ? { type: 'level' } : { type: 'level', multiplier: Number(v) })
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <USelect :model-value="other ? undefined : kind" :items="kinds" :placeholder="other ? t('homebrew.formula.other') : t('homebrew.none')" class="w-48" @update:model-value="v => setKind(v as string)" />
    <UInputNumber v-if="kind === 'flat'" :model-value="Number(f?.value ?? 0)" class="w-28" :aria-label="t('homebrew.formula.value')" @update:model-value="v => emit('update:modelValue', { type: 'flat', value: Number(v) || 0 })" />
    <USelect v-else-if="kind === 'mod'" :model-value="String(f?.value ?? 'str')" :items="abilities" class="w-40" :aria-label="t('homebrew.formula.ability')" @update:model-value="v => emit('update:modelValue', { type: 'mod', value: v })" />
    <template v-else-if="kind === 'level'">
      <span class="text-sm text-muted">×</span>
      <UInputNumber :model-value="f?.multiplier ?? 1" :min="0" :step="0.5" class="w-24" :aria-label="t('homebrew.formula.multiplier')" @update:model-value="setLevel" />
    </template>
    <UButton v-if="kind" size="xs" color="neutral" variant="link" icon="i-lucide-x" :aria-label="t('homebrew.clear')" @click="emit('update:modelValue', undefined)" />
  </div>
</template>
