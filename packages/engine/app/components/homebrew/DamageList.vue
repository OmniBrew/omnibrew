<script setup lang="ts">
/** Damage rolls (plan/26 §1.3): dice count, die, a flat bonus and the type, per roll. */
type Damage = { dieCount?: number, dieType?: number | false, type?: string, bonus?: { type: string, value?: unknown } }
const props = defineProps<{ modelValue: unknown, max?: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: Damage[] | undefined] }>()
const { t } = useI18n()
const options = useHomebrewOptions()

const list = computed<Damage[]>(() => (Array.isArray(props.modelValue) ? props.modelValue as Damage[] : []))
const types = computed(() => [...options.enumItems('damageTypes', 'damage_types.{v}'), ...options.enumItems('healingTypes', 'homebrew.healing.{v}')])
const dice = [4, 6, 8, 10, 12, 20].map(d => ({ value: d, label: `d${d}` }))

function update(i: number, patch: Partial<Damage>) {
  emit('update:modelValue', list.value.map((d, j) => {
    if (j !== i) return d
    const out: Damage = { ...d, ...patch }
    for (const k of Object.keys(out) as Array<keyof Damage>) if (out[k] === undefined) Reflect.deleteProperty(out, k)
    return out
  }))
}
const add = () => emit('update:modelValue', [...list.value, { dieCount: 1, dieType: 6, type: 'piercing' }])
function remove(i: number) {
  const next = list.value.filter((_, j) => j !== i)
  emit('update:modelValue', next.length ? next : undefined)
}
const bonus = (d: Damage) => (d.bonus?.type === 'flat' ? Number(d.bonus.value) || 0 : 0)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="(d, i) in list" :key="i" class="flex flex-wrap items-center gap-2" data-damage-row>
      <UInputNumber :model-value="d.dieCount ?? 0" :min="0" :max="40" class="w-24" :aria-label="t('homebrew.fields.die_count')" @update:model-value="v => update(i, { dieCount: Number(v) || 0 })" />
      <USelect :model-value="d.dieType || undefined" :items="dice" class="w-24" :aria-label="t('homebrew.fields.die_type')" @update:model-value="v => update(i, { dieType: Number(v) })" />
      <span class="text-sm text-muted">+</span>
      <UInputNumber :model-value="bonus(d)" class="w-24" :aria-label="t('homebrew.fields.damage_bonus')" @update:model-value="v => update(i, { bonus: Number(v) ? { type: 'flat', value: Number(v) } : undefined })" />
      <USelectMenu :model-value="d.type" :items="types" value-key="value" class="w-44" :aria-label="t('homebrew.fields.damage_type')" @update:model-value="v => update(i, { type: v as string })" />
      <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('homebrew.remove')" @click="remove(i)" />
    </div>
    <UButton v-if="!max || list.length < max" size="sm" variant="outline" icon="i-lucide-plus" :label="t('homebrew.add_damage')" class="self-start" @click="add" />
  </div>
</template>
