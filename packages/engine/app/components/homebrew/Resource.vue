<script setup lang="ts">
/** Uses of a card or power (plan/26 §1.3): how many, and whether a short or long rest brings them back. */
type Resource = { max?: { type: string, value?: unknown }, reset?: string, [k: string]: unknown }
const props = defineProps<{ modelValue: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: Resource | undefined] }>()
const { t } = useI18n()
const r = computed(() => (props.modelValue && typeof props.modelValue === 'object' ? props.modelValue as Resource : undefined))
const resets = computed(() => [{ value: 'short', label: t('homebrew.reset.short') }, { value: 'long', label: t('homebrew.reset.long') }])

function setMax(v: unknown) {
  const n = Number(v) || 0
  if (!n) emit('update:modelValue', undefined)
  else emit('update:modelValue', { reset: 'long', ...r.value, max: { type: 'flat', value: n } })
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UInputNumber :model-value="r?.max?.type === 'flat' ? Number(r.max.value) || 0 : 0" :min="0" :max="20" class="w-28" :aria-label="t('homebrew.fields.uses')" @update:model-value="setMax" />
    <USelect v-if="r" :model-value="r.reset ?? 'long'" :items="resets" class="w-48" :aria-label="t('homebrew.reset.title')" @update:model-value="v => emit('update:modelValue', { ...r, reset: v as string })" />
    <span v-else class="text-sm text-muted">{{ t('homebrew.unlimited') }}</span>
  </div>
</template>
