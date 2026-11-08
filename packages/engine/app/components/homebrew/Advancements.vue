<script setup lang="ts">
/** A power's advancements (plan/26 §1.3): a name and a text each; the id comes from the name. */
type Adv = { id: string, name: string, text: string, [k: string]: unknown }
const props = defineProps<{ modelValue: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: Adv[] | undefined] }>()
const { t } = useI18n()

const list = computed<Adv[]>(() => (Array.isArray(props.modelValue) ? props.modelValue as Adv[] : []))
const slug = (s: string) => s.toLowerCase().trim().replaceAll(/[^a-z\d]+/g, '-').replaceAll(/^-|-$/g, '') || 'advancement'
function unique(base: string, i: number) {
  let id = base
  let n = 2
  while (list.value.some((a, j) => j !== i && a.id === id)) id = `${base}-${n++}`
  return id
}
const update = (i: number, patch: Partial<Adv>) => emit('update:modelValue', list.value.map((a, j) => {
  if (j !== i) return a
  const next = { ...a, ...patch }
  if (patch.name !== undefined) next.id = unique(slug(patch.name), i)
  return next
}))
const add = () => emit('update:modelValue', [...list.value, { id: unique('advancement', -1), name: '', text: '' }])
function remove(i: number) {
  const next = list.value.filter((_, j) => j !== i)
  emit('update:modelValue', next.length ? next : undefined)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-for="(a, i) in list" :key="i" class="flex flex-col gap-2 rounded-md border border-default bg-muted p-3">
      <div class="flex gap-2">
        <UInput :model-value="a.name" :placeholder="t('homebrew.fields.name')" class="flex-1" :aria-label="t('homebrew.fields.name')" @update:model-value="v => update(i, { name: String(v) })" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('homebrew.remove')" @click="remove(i)" />
      </div>
      <UTextarea :model-value="a.text" :rows="3" autoresize :aria-label="t('homebrew.fields.body')" @update:model-value="v => update(i, { text: String(v) })" />
    </div>
    <UButton size="sm" variant="outline" icon="i-lucide-plus" :label="t('homebrew.add_advancement')" class="self-start" @click="add" />
  </div>
</template>
