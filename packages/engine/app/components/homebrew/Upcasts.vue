<script setup lang="ts">
/**
 * A power's upcast entries (plan/26 §1.3): for each higher level (a cantrip's tiers by
 * character level), the dice count and bonus of each damage roll. Writes `casting[1..]` as
 * deltas merged onto `casting[0]`, as content does; an unchanged level is `{}`.
 */
type Rec = Record<string, unknown>
const props = defineProps<{ record: Rec }>()
const emit = defineEmits<{ update: [record: Rec] }>()
const { t } = useI18n()
const hb = useHomebrewRules()

const casting = computed<Rec[]>(() => (Array.isArray(props.record.casting) ? props.record.casting as Rec[] : []))
const base = computed(() => (casting.value[0]?.damage as Rec[] | undefined) ?? [])
const level = computed(() => Number(props.record.level) || 0)
const tiers = computed(() => {
  const def = hb.game?.def
  if (!def) return []
  if (level.value === 0) return (def.rules?.powers.cantripLevels.normal ?? []).map((l: number, i: number) => ({ index: i + 1, label: t('homebrew.upcast_cantrip', { level: l }) }))
  const max = def.powerSystem.maxLevel
  return Array.from({ length: Math.max(0, max - level.value) }, (_, i) => ({ index: i + 1, label: t('homebrew.upcast_level', { level: level.value + i + 1 }) }))
})

const dmg = (tier: number, d: number) => ((casting.value[tier]?.damage as Rec[] | undefined)?.[d] ?? {}) as Rec
function set(tier: number, d: number, key: 'dieCount' | 'bonus', value: unknown) {
  const next = cloneData(casting.value)
  while (next.length <= tier) next.push({})
  const entry = next[tier]!
  const list = ((entry.damage as Rec[] | undefined) ?? base.value.map(() => ({}))).slice()
  while (list.length < base.value.length) list.push({})
  const cell: Rec = { ...list[d] }
  const n = value === null || value === undefined || value === '' ? undefined : Number(value)
  if (n === undefined) Reflect.deleteProperty(cell, key)
  else cell[key] = key === 'bonus' ? { value: n } : n
  list[d] = cell
  if (list.every(x => !Object.keys(x).length)) delete entry.damage
  else entry.damage = list
  // Trailing empty entries are dropped; a level in between stays `{}`.
  while (next.length > 1 && !Object.keys(next[next.length - 1]!).length) next.pop()
  emit('update', { ...props.record, casting: next })
}
// Entries past the power's levels (its level went up) are dropped.
watch(tiers, (list) => {
  if (casting.value.length > list.length + 1) emit('update', { ...props.record, casting: casting.value.slice(0, list.length + 1) })
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="!base.length" class="text-sm text-muted">
      {{ t('homebrew.upcast_no_damage') }}
    </p>
    <div v-for="tier in base.length ? tiers : []" :key="tier.index" class="flex flex-wrap items-center gap-3 rounded-sm border border-default p-2" data-upcast>
      <span class="w-36 font-label text-sm font-semibold text-highlighted">{{ tier.label }}</span>
      <div v-for="(d, i) in base" :key="i" class="flex items-center gap-1.5">
        <UInputNumber :model-value="(dmg(tier.index, i).dieCount as number | undefined) ?? null" :min="0" :placeholder="String(d.dieCount ?? 0)" class="w-24" :aria-label="t('homebrew.upcast_dice', { level: tier.label })" @update:model-value="v => set(tier.index, i, 'dieCount', v)" />
        <span class="text-sm text-muted">d{{ d.dieType }} +</span>
        <UInputNumber :model-value="((dmg(tier.index, i).bonus as Rec | undefined)?.value as number | undefined) ?? null" :placeholder="String((d.bonus as Rec | undefined)?.value ?? 0)" class="w-24" :aria-label="t('homebrew.upcast_bonus', { level: tier.label })" @update:model-value="v => set(tier.index, i, 'bonus', v)" />
      </div>
    </div>
  </div>
</template>
