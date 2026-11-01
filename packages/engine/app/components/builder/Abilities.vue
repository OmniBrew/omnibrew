<script setup lang="ts">
/**
 * The Abilities step (the live MeCbAbilities*): standard array, point buy (27 points)
 * or manual scores, then each ability's breakdown (base, species, class and feats,
 * other) and total, as the sheet computes it.
 */
import { ABILITY_KEYS, type Character } from '@omnibrew/engine/character'
import { actions } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet, character, apply } = useSheet()

const STANDARD = [15, 14, 13, 12, 10, 8]
const COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
const BUDGET = 27

const method = computed(() => character.value.abilityScores.method)
const base = computed(() => character.value.abilityScores.base)
const change = (fn: (c: Character) => void) => apply(s => actions.edit(s.character, fn))

function setMethod(m: 'standard' | 'buy' | 'manual') {
  change((c) => {
    c.abilityScores.method = m
    for (const a of ABILITY_KEYS) c.abilityScores.base[a] = m === 'buy' ? 8 : m === 'standard' ? null : c.abilityScores.base[a]
  })
}
const setBase = (a: (typeof ABILITY_KEYS)[number], v: unknown) => change(c => (c.abilityScores.base[a] = v === null || v === undefined || v === '' ? null : Math.floor(Number(v)) || null))

const spent = computed(() => ABILITY_KEYS.reduce((sum, a) => sum + (COST[base.value[a] ?? 8] ?? 0), 0))
/** Standard array values not given to another ability yet. */
const freeValues = (a: (typeof ABILITY_KEYS)[number]) => STANDARD.filter((v, i) => {
  const used = ABILITY_KEYS.filter(x => x !== a && base.value[x] === v).length
  return STANDARD.slice(0, i).filter(x => x === v).length + used < STANDARD.filter(x => x === v).length
})
const buyMax = (a: (typeof ABILITY_KEYS)[number]) => {
  const cur = base.value[a] ?? 8
  let n = cur
  while (n < 15 && spent.value - (COST[cur] ?? 0) + (COST[n + 1] ?? 99) <= BUDGET) n++
  return n
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <UTabs
      :model-value="method"
      :items="[{ label: t('builder.abilities.standard'), value: 'standard' }, { label: t('builder.abilities.buy'), value: 'buy' }, { label: t('builder.abilities.manual'), value: 'manual' }]"
      :content="false"
      @update:model-value="v => setMethod(v as 'standard' | 'buy' | 'manual')"
    />
    <p v-if="method === 'buy'" class="text-sm" :class="spent > BUDGET ? 'text-error' : 'text-muted'">
      {{ t('builder.abilities.points', { n: BUDGET - spent, max: BUDGET }) }}
    </p>
    <p v-else-if="method === 'standard'" class="text-sm text-muted">
      {{ t('builder.abilities.standard_text', { values: STANDARD.join(', ') }) }}
    </p>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[34rem] text-sm">
        <thead>
          <tr class="border-b border-accented text-start">
            <th class="py-2 text-start font-label text-xs font-semibold tracking-[0.1em] text-muted uppercase">
              {{ t('builder.abilities.ability') }}
            </th>
            <th class="py-2 font-label text-xs font-semibold tracking-[0.1em] text-muted uppercase">
              {{ t('builder.abilities.base') }}
            </th>
            <th class="py-2 text-end font-label text-xs font-semibold tracking-[0.1em] text-muted uppercase">
              {{ t('species_title', 1) }}
            </th>
            <th class="py-2 text-end font-label text-xs font-semibold tracking-[0.1em] text-muted uppercase">
              {{ t('builder.abilities.class') }}
            </th>
            <th class="py-2 text-end font-label text-xs font-semibold tracking-[0.1em] text-muted uppercase">
              {{ t('builder.abilities.other') }}
            </th>
            <th class="py-2 text-end font-label text-xs font-semibold tracking-[0.1em] text-muted uppercase">
              {{ t('builder.abilities.total') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in ABILITY_KEYS" :key="a" class="border-b border-default" :data-ability="a">
            <td class="py-2 font-semibold text-highlighted">
              {{ t(`abilities.${a}.title`) }}
            </td>
            <td class="py-2">
              <USelect
                v-if="method === 'standard'"
                :model-value="base[a] ?? undefined"
                :items="freeValues(a).concat(base[a] && !freeValues(a).includes(base[a]!) ? [base[a]!] : []).sort((x, y) => y - x)"
                :placeholder="t('builder.abilities.pick')"
                class="w-24"
                :aria-label="t(`abilities.${a}.title`)"
                @update:model-value="v => setBase(a, v)"
              />
              <UInputNumber v-else-if="method === 'buy'" :model-value="base[a] ?? 8" :min="8" :max="buyMax(a)" class="w-28" :aria-label="t(`abilities.${a}.title`)" @update:model-value="v => setBase(a, v)" />
              <UInputNumber v-else :model-value="base[a] ?? undefined" :min="1" :max="30" class="w-28" :aria-label="t(`abilities.${a}.title`)" @update:model-value="v => setBase(a, v)" />
            </td>
            <td class="py-2 text-end font-mono">
              {{ sheet.abilities[a]?.species ? signed(sheet.abilities[a]!.species) : '–' }}
            </td>
            <td class="py-2 text-end font-mono">
              {{ sheet.abilities[a]?.klass ? signed(sheet.abilities[a]!.klass) : '–' }}
            </td>
            <td class="py-2 text-end font-mono">
              {{ (sheet.abilities[a]?.misc || sheet.abilities[a]?.bonus) ? signed((sheet.abilities[a]!.misc || 0) + (sheet.abilities[a]!.bonus || 0)) : '–' }}
            </td>
            <td class="py-2 text-end font-mono text-base font-semibold text-highlighted">
              {{ sheet.abilities[a]?.total ?? '–' }} <span class="text-xs text-muted">{{ sheet.abilities[a]?.mod !== null && sheet.abilities[a]?.mod !== undefined ? `(${signed(sheet.abilities[a]!.mod!)})` : '' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
