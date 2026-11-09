<script setup lang="ts">
/** An attack roll: none, melee or ranged. On a power it is a proficient power attack (`wp: power`), as content writes them. */
type Attack = { type?: string, wp?: string, proficient?: boolean, [k: string]: unknown }
const props = defineProps<{ modelValue: unknown, record: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:modelValue': [value: Attack | undefined] }>()
const { t } = useI18n()
const a = computed(() => (props.modelValue && typeof props.modelValue === 'object' ? props.modelValue as Attack : undefined))
const items = computed(() => ['none', 'melee', 'ranged'].map(v => ({ value: v, label: t(`homebrew.attack_type.${v}`) })))
const isPower = computed(() => Array.isArray(props.record.casting))
function set(v: string) {
  if (v === 'none') emit('update:modelValue', undefined)
  else emit('update:modelValue', { ...(isPower.value ? { wp: 'power', proficient: true } : { proficient: true }), ...a.value, type: v })
}
</script>

<template>
  <USelect :model-value="a?.type ?? 'none'" :items="items" class="w-48" @update:model-value="v => set(v as string)" />
</template>
