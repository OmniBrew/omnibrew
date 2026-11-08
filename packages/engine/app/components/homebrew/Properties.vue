<script setup lang="ts">
/** Item properties with their values (`{ id, value }`): a value box for those that take one (heat, reload). */
type Prop = { id: string, value?: number | string }
const props = defineProps<{ modelValue: unknown, collection: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: Prop[] | undefined] }>()
const { t } = useI18n()
const hb = useHomebrewRules()
const options = useHomebrewOptions()

const list = computed<Prop[]>(() => (Array.isArray(props.modelValue) ? props.modelValue as Prop[] : []))
const records = computed(() => hb.rules?.content.list(props.collection) ?? [])
const takesValue = (id: string) => Boolean(records.value.find(r => r.id === id)?.takesValue)
const items = computed(() => options.recordItems(props.collection))

function pick(ids: string[]) {
  const next = ids.map(id => list.value.find(p => p.id === id) ?? (takesValue(id) ? { id, value: 1 } : { id }))
  emit('update:modelValue', next.length ? next : undefined)
}
const setValue = (id: string, value: unknown) => emit('update:modelValue', list.value.map(p => (p.id === id ? { id, value: Number(value) || 0 } : p)))
</script>

<template>
  <div class="flex flex-col gap-2">
    <USelectMenu :model-value="list.map(p => p.id)" :items="items" value-key="value" multiple class="w-full" @update:model-value="v => pick(v as string[])" />
    <div v-for="p in list.filter(x => takesValue(x.id))" :key="p.id" class="flex items-center gap-2">
      <span class="w-40 text-sm text-default">{{ options.recordName(collection, p.id) }}</span>
      <UInputNumber :model-value="Number(p.value ?? 0)" :min="0" class="w-28" :aria-label="t('homebrew.property_value', { name: options.recordName(collection, p.id) })" @update:model-value="v => setValue(p.id, v)" />
    </div>
  </div>
</template>
