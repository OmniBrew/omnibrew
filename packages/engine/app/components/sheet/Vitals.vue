<script setup lang="ts">
/**
 * Vitals (design notes "Vitals", B82): on desktop the ring (hit points inside, the
 * first regenerating pool, ME shields, outside) with its legend; pool rows instead for
 * a character with more pools (ME tech armor, barrier) and on phones, in the order
 * damage applies. Below: the amount stepper (minus deals damage, plus heals; the menu
 * picks how damage lands, or adds temp HP or another gainable pool), Regen, and the
 * death saves at 0 hit points. Pool colors are fixed and never take the sheet accent.
 */
import { actions, type VitalPool } from '@omnibrew/engine/rules'

const { t } = useI18n()
const { sheet, character, editable, apply } = useSheet()
const rolls = useSheetRolls()

const HP_COLOR = 'text-emerald-700 dark:text-emerald-400'

const pools = computed(() => actions.vitalPools(sheet.value))
const regenPool = computed(() => pools.value.find(p => p.regen !== undefined && p.absorbs))
const hp = computed(() => sheet.value.hp)
const temp = computed(() => sheet.value.tempHp)
/** The ring fits hit points and one more pool; more pools show as rows. */
const ringFits = computed(() => pools.value.filter(p => p !== regenPool.value).length === 0)

const amount = ref(0)
const mode = ref<'normal' | 'bypass' | 'double'>('normal')
const step = (n: number) => (amount.value = Math.max(0, (Number(amount.value) || 0) + n))

function hurt() {
  const n = Number(amount.value) || 0
  if (!n) return
  apply(s => actions.damage(s, n, { bypass: mode.value === 'bypass', double: mode.value === 'double' }))
  amount.value = 0
}
function heal() {
  const n = Number(amount.value) || 0
  if (!n) return
  apply(s => actions.heal(s, n))
  amount.value = 0
}
function gain(pool: VitalPool | 'temp') {
  const n = Number(amount.value) || 0
  if (!n) return
  apply(s => (pool === 'temp' ? actions.addTempHp(s, n) : actions.setPool(s, pool.id, pool.current + n)))
  amount.value = 0
}
function regen(pool: VitalPool, custom = false) {
  const n = Number(amount.value) || 0
  apply(s => actions.regen(s, pool.id, custom ? n : undefined))
  if (custom) amount.value = 0
}
function spend(pool: VitalPool) {
  if (pool.current <= 0) return
  apply(s => actions.setPool(s, pool.id, pool.current - 1))
  if (pool.roll) rolls.damage(t(pool.label), [{ types: { [t('sheet.vitals.reduction')]: parseDice(pool.roll) } }])
}

const refill = (pool: VitalPool) => apply(s => actions.setPool(s, pool.id, pool.max))

/** `2d6` as the rules engine's damage dice (`{ 6: 2 }`). */
function parseDice(notation: string) {
  const [count, sides] = notation.split('d').map(Number)
  return { [String(sides)]: count ?? 1, bonus: 0 }
}

const menu = computed(() => [
  [
    { type: 'label' as const, label: t('sheet.vitals.damage_mode') },
    { type: 'checkbox' as const, label: t('sheet.vitals.mode_normal'), checked: mode.value === 'normal', onUpdateChecked: () => (mode.value = 'normal') },
    ...(pools.value.some(p => p.bypassable) ? [{ type: 'checkbox' as const, label: t('sheet.vitals.mode_bypass', { pool: t(pools.value.find(p => p.bypassable)!.label) }), checked: mode.value === 'bypass', onUpdateChecked: () => (mode.value = 'bypass') }] : []),
    ...(pools.value.some(p => p.doublable) ? [{ type: 'checkbox' as const, label: t('sheet.vitals.mode_double', { pool: t(pools.value.find(p => p.doublable)!.label) }), checked: mode.value === 'double', onUpdateChecked: () => (mode.value = 'double') }] : []),
  ],
  [
    { label: t('sheet.vitals.add_temp'), icon: 'i-lucide-heart-plus', onSelect: () => gain('temp') },
    ...pools.value.filter(p => p.gainable).map(p => ({ label: t('sheet.vitals.add_to', { pool: t(p.label) }), icon: 'i-lucide-plus', onSelect: () => gain(p) })),
    ...(regenPool.value ? [{ label: t('sheet.vitals.regen_amount', { pool: t(regenPool.value.label) }), icon: 'i-lucide-rotate-ccw', onSelect: () => regen(regenPool.value!, true) }] : []),
  ],
])

const pct = (v: number, max: number) => (max > 0 ? Math.min(100, Math.max(0, (v / max) * 100)) : 0)
const dying = computed(() => hp.value.current === 0)
const saves = computed(() => character.value.state.deathSaves)
const setSaves = (key: 'successes' | 'failures', n: number) => apply(s => actions.setDeathSaves(s.character, { ...saves.value, [key]: saves.value[key] === n ? n - 1 : n }))

// Ring geometry: inner hit points, outer regenerating pool.
const R_IN = 44
const R_OUT = 54
const circ = (r: number) => 2 * Math.PI * r
</script>

<template>
  <SheetPanel :title="t('sheet.vitals.title')">
    <!-- Desktop ring -->
    <div v-if="ringFits" class="hidden items-center gap-4 sm:flex">
      <div class="relative size-36 shrink-0">
        <svg viewBox="0 0 120 120" class="size-full -rotate-90" aria-hidden="true">
          <template v-if="regenPool">
            <circle cx="60" cy="60" :r="R_OUT" fill="none" stroke-width="6" class="stroke-(--ui-bg-accented)" />
            <circle cx="60" cy="60" :r="R_OUT" fill="none" stroke-width="6" stroke="currentColor" :class="regenPool.color" :stroke-dasharray="circ(R_OUT)" :stroke-dashoffset="circ(R_OUT) * (1 - pct(regenPool.current, regenPool.max) / 100)" class="transition-[stroke-dashoffset]" />
          </template>
          <circle cx="60" cy="60" :r="R_IN" fill="none" stroke-width="8" class="stroke-(--ui-bg-accented)" />
          <circle cx="60" cy="60" :r="R_IN" fill="none" stroke-width="8" stroke="currentColor" :class="HP_COLOR" :stroke-dasharray="circ(R_IN)" :stroke-dashoffset="circ(R_IN) * (1 - pct(hp.current, hp.max) / 100)" class="transition-[stroke-dashoffset]" />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span class="eyebrow text-[0.625rem] text-muted">{{ t('hit_points_title') }}</span>
          <span class="font-mono text-2xl font-semibold text-highlighted" data-sheet="hp.current">{{ hp.current }}<span class="text-base text-muted">/{{ hp.max }}</span></span>
          <span v-if="regenPool" class="font-mono text-xs" :class="regenPool.color">+{{ regenPool.current }} {{ t(regenPool.label).toLowerCase() }}</span>
        </div>
      </div>
      <dl class="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
        <div class="flex items-center gap-2">
          <span class="size-2 shrink-0 bg-current" :class="HP_COLOR" />
          <dt class="flex-1">
            {{ t('sheet.vitals.hp') }}
          </dt>
          <dd class="font-mono tabular-nums text-highlighted">
            {{ hp.current }} / {{ hp.max }}
          </dd>
        </div>
        <div v-if="regenPool" class="flex items-center gap-2">
          <span class="size-2 shrink-0 bg-current" :class="regenPool.color" />
          <dt class="flex-1">
            {{ t(regenPool.label) }}
          </dt>
          <dd class="font-mono tabular-nums text-highlighted" :data-sheet="`pool.${regenPool.id}`">
            {{ regenPool.current }} / {{ regenPool.max }}
          </dd>
        </div>
        <div class="flex items-center gap-2 text-muted">
          <span class="size-2 shrink-0 border border-current" :class="HP_COLOR" />
          <dt class="flex-1">
            {{ t('sheet.vitals.temp_hp') }}
          </dt>
          <dd class="font-mono tabular-nums">
            {{ temp.value }}
          </dd>
        </div>
        <dd v-if="regenPool && editable" class="mt-1">
          <UButton :label="t('sheet.vitals.regen', { n: regenPool.regen })" icon="i-lucide-rotate-ccw" size="sm" color="warning" variant="soft" :disabled="regenPool.current >= regenPool.max" @click="regen(regenPool)" />
        </dd>
      </dl>
    </div>

    <!-- Pool rows: phones always, desktop when the ring doesn't fit -->
    <div :class="ringFits ? 'sm:hidden' : ''" class="flex flex-col gap-2">
      <div class="grid grid-cols-2 gap-3">
        <SheetPoolBar :label="t('sheet.vitals.hp')" :color="HP_COLOR" :current="hp.current" :max="hp.max" data-sheet-pool="hp" />
        <SheetPoolBar v-if="regenPool" :label="t(regenPool.label)" :color="regenPool.color" :current="regenPool.current" :max="regenPool.max" />
      </div>
      <template v-for="pool in pools" :key="pool.id">
        <SheetPoolBar v-if="pool !== regenPool" :label="t(pool.label)" :color="pool.color" :current="pool.current" :max="pool.max" :ticks="pool.ticks" row>
          <template v-if="pool.ticks && editable" #actions>
            <UButton :label="pool.roll ? t('sheet.vitals.spend_roll', { dice: pool.roll }) : t('sheet.vitals.spend')" size="xs" color="neutral" variant="outline" :disabled="pool.current <= 0" @click="spend(pool)" />
            <UButton icon="i-lucide-rotate-ccw" size="xs" color="neutral" variant="ghost" :aria-label="t('sheet.vitals.refill', { pool: t(pool.label) })" :disabled="pool.current >= pool.max" @click="refill(pool)" />
          </template>
        </SheetPoolBar>
      </template>
      <p v-if="temp.value > 0 || !regenPool" class="text-xs text-muted">
        {{ t('sheet.vitals.temp_hp') }} <span class="font-mono text-highlighted">{{ temp.value }}</span>
      </p>
    </div>

    <!-- Stepper -->
    <div v-if="editable" class="mt-3 flex flex-wrap items-center gap-2 border-t border-default pt-3">
      <UButton icon="i-lucide-minus" color="neutral" variant="outline" class="size-8 justify-center max-sm:size-11" :aria-label="t('sheet.vitals.damage')" :title="t('sheet.vitals.damage')" @click="hurt" />
      <UInput v-model.number="amount" type="number" inputmode="numeric" min="0" max="9999" :aria-label="t('sheet.vitals.amount')" class="w-16 max-sm:w-20" :ui="{ base: 'text-center font-mono [appearance:textfield] max-sm:h-11 [&::-webkit-inner-spin-button]:appearance-none' }" @keydown.enter="hurt" @focus="(e: FocusEvent) => (e.target as HTMLInputElement).select()" />
      <UButton icon="i-lucide-plus" color="neutral" variant="outline" class="size-8 justify-center max-sm:size-11" :aria-label="t('sheet.vitals.heal')" :title="t('sheet.vitals.heal')" @click="heal" />
      <div class="flex gap-0.5 max-sm:hidden">
        <UButton v-for="n in [1, 5, 10]" :key="n" :label="`+${n}`" size="xs" color="neutral" variant="ghost" class="font-mono" @click="step(n)" />
      </div>
      <UDropdownMenu :items="menu" :content="{ align: 'end' }">
        <UButton :label="mode === 'normal' ? t('sheet.vitals.more') : t(`sheet.vitals.mode_short_${mode}`)" trailing-icon="i-lucide-chevron-down" size="sm" color="neutral" variant="ghost" class="ms-auto" />
      </UDropdownMenu>
      <UButton v-if="regenPool" :label="t('sheet.vitals.regen', { n: regenPool.regen })" icon="i-lucide-rotate-ccw" color="warning" variant="soft" class="max-sm:h-11 sm:hidden" :disabled="regenPool.current >= regenPool.max" @click="regen(regenPool)" />
    </div>

    <!-- Death saves -->
    <div v-if="dying" class="mt-3 rounded-sm border border-error/40 bg-error/10 p-3" data-sheet="deathSaves">
      <p class="eyebrow text-error">
        {{ saves.failures >= 3 ? t('sheet.vitals.dead') : saves.successes >= 3 ? t('sheet.vitals.stable') : t('sheet.vitals.death_saves') }}
      </p>
      <div class="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-sm">
        <span>{{ t('sheet.vitals.successes') }}</span>
        <span class="flex gap-1">
          <UCheckbox v-for="n in 3" :key="`s${n}`" :model-value="saves.successes >= n" :disabled="!editable" :aria-label="t('sheet.vitals.success_n', { n })" @update:model-value="setSaves('successes', n)" />
        </span>
        <span>{{ t('sheet.vitals.failures') }}</span>
        <span class="flex gap-1">
          <UCheckbox v-for="n in 3" :key="`f${n}`" :model-value="saves.failures >= n" color="error" :disabled="!editable" :aria-label="t('sheet.vitals.failure_n', { n })" @update:model-value="setSaves('failures', n)" />
        </span>
      </div>
      <UButton :label="t('sheet.vitals.death_save')" icon="i-lucide-dices" size="sm" variant="outline" class="mt-2" @click="rolls.check(t('sheet.vitals.death_save'), 0, 'save')" />
    </div>
  </SheetPanel>
</template>
