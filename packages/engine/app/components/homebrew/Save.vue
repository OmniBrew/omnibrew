<script setup lang="ts">
/** A saving throw: none, or the ability the target saves with. */
type Dc = { save?: string, [k: string]: unknown }
const props = defineProps<{ modelValue: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: Dc | undefined] }>()
const { t } = useI18n()
const options = useHomebrewOptions()
const dc = computed(() => (props.modelValue && typeof props.modelValue === 'object' ? props.modelValue as Dc : undefined))
const items = computed(() => [{ value: 'none', label: t('homebrew.none') }, ...options.enumItems('abilities', 'abilities.{v}.title')])
</script>

<template>
  <USelect :model-value="dc?.save ?? 'none'" :items="items" class="w-48" @update:model-value="v => emit('update:modelValue', v === 'none' ? undefined : { ...dc, save: v as string })" />
</template>
