<script setup lang="ts">
/**
 * The rest menu (the live MeCsRestMenu). Short rest: spend hit dice (rolled, with
 * `min-hit-die-roll`), recover points or slots (`power-resource-recovery`). Long rest:
 * regain hit dice (all with `regain-all-hit-dice`), lose a level of exhaustion. Both
 * ask the game's questions (ME indoctrination). `rules/actions.ts` `rest` applies it.
 */
import { actions } from '@omnibrew/engine/rules'

const { t } = useI18n()
const ui = useSheetUi()
const { sheet, apply } = useSheet()
const rolls = useRollStore()
const toast = useToast()

const open = ui.model('rest')
const type = ref<'short' | 'long'>(ui.arg === 'long' ? 'long' : 'short')

const classes = computed(() => sheet.value.classes.map(k => ({ id: k.id, name: k.data.name, die: Number(k.data.hitDie) || 0, levels: k.levels, used: sheet.value.character.state.hitDiceUsed[k.id] ?? 0 })))
const conMod = computed(() => sheet.value.abilities.con?.mod ?? 0)
const minRoll = computed(() => actions.minHitDieRoll(sheet.value))

// Short rest: hit dice.
const spend = ref<Record<string, number>>({})
const healed = ref<Record<string, number>>({})
function rollHitDice(k: { id: string, die: number }) {
  const n = spend.value[k.id] ?? 0
  if (!n || !k.die) return
  const notation = `${n}d${k.die}${minRoll.value > 1 ? `min${minRoll.value}` : ''}${signed(conMod.value * n)}`
  const entry = rolls.roll({ label: t('sheet.rest.hit_dice_of', { name: k.id }), kind: 'hit_dice', notation })
  healed.value = { ...healed.value, [k.id]: Math.max(0, entry.total) }
}
const hpBack = computed(() => Math.min(sheet.value.hp.max - sheet.value.hp.current, Object.values(healed.value).reduce((a, n) => a + n, 0)))

// Short rest: power resource recovery.
const recovery = computed(() => actions.recoveryOptions(sheet.value))
const recoveryTotal = ref<number[]>([])
const picks = ref<number[]>([])
const pc = computed(() => sheet.value.powercasting)
const pointsPool = computed(() => Object.entries(pc.value.points).find(([, p]) => p.max > 0))
const recoverable = computed(() => {
  const rows: Array<{ index: number, label: string, used: number, weight: number }> = []
  const limits = recovery.value.map(r => r.limit)
  const maxSlot = Math.max(0, ...recovery.value.map(r => r.maxSlot))
  if (pointsPool.value && limits.some(l => l !== 'slots')) rows.push({ index: 0, label: t(`sheet.powers.pool.${pointsPool.value[0].replace(':', '_')}`), used: pointsPool.value[1].used, weight: 1 })
  if (limits.some(l => l !== 'points')) {
    for (const [l, s] of Object.entries(pc.value.slots)) {
      if (s.max > 0 && Number(l) <= maxSlot) rows.push({ index: Number(l), label: t('level_nth', { nth: t(`ordinal_numbers[${l}]`) }), used: s.used, weight: Number(l) })
    }
  }
  return rows
})
const budget = computed(() => recovery.value.reduce((a, r, i) => a + (r.dieCount && r.dieType ? recoveryTotal.value[i] ?? 0 : r.bonus), 0))
const spent = computed(() => recoverable.value.reduce((a, r) => a + (picks.value[r.index] ?? 0) * r.weight, 0))
function rollRecovery(i: number) {
  const r = recovery.value[i]!
  const entry = rolls.roll({ label: r.label ?? t('sheet.rest.recovery'), kind: 'recovery', notation: `${r.dieCount}d${r.dieType}${r.bonus ? signed(r.bonus) : ''}` })
  const next = [...recoveryTotal.value]
  next[i] = entry.total
  recoveryTotal.value = next
}

// Long rest.
const regainAll = computed(() => sheet.value.ofType('regain-all-hit-dice').length > 0)
const regainLimit = computed(() => actions.hitDiceRegainLimit(sheet.value))
const regain = ref<Record<string, number>>({})
const regainUsed = computed(() => Object.values(regain.value).reduce((a, n) => a + n, 0))
const reduceExhaustion = ref(false)

const gameOptions = computed(() => (sheet.value.rules.play?.restOptions ?? []).filter(o => o.rest === type.value))
const gameAnswers = ref<Record<string, boolean>>({})

function take() {
  const choices: actions.RestChoices = type.value === 'short'
    ? {
        hitDice: Object.fromEntries(classes.value.map(k => [k.id, { used: spend.value[k.id] ?? 0, hp: healed.value[k.id] ?? 0 }])),
        recovered: picks.value,
        game: gameAnswers.value,
      }
    : { hitDiceRegained: regain.value, reduceExhaustion: reduceExhaustion.value, game: gameAnswers.value }
  apply(s => actions.rest(s, type.value, choices))
  toast.add({ title: type.value === 'short' ? t('sheet.rest.done_short') : t('sheet.rest.done_long'), icon: 'i-lucide-check', color: 'success' })
  ui.close()
}
</script>

<template>
  <USlideover v-model:open="open" :title="type === 'short' ? t('sheet.rest.short') : t('sheet.rest.long')" :description="type === 'short' ? t('sheet.rest.short_text') : t('sheet.rest.long_text')">
    <template #body>
      <div class="flex flex-col gap-5 text-sm">
        <UTabs v-model="type" :items="[{ label: t('sheet.rest.short'), value: 'short' }, { label: t('sheet.rest.long'), value: 'long' }]" :content="false" />

        <template v-if="type === 'short'">
          <section class="flex flex-col gap-2">
            <h3 class="eyebrow text-muted">
              {{ t('hit_dice_title') }}
            </h3>
            <div v-for="k in classes" :key="k.id" class="flex flex-wrap items-center gap-2 rounded-sm border border-default bg-muted p-2">
              <span class="flex-1">{{ k.name }} <span class="font-mono text-xs text-muted">d{{ k.die }} · {{ t('sheet.rest.hit_dice_left', { n: k.levels - k.used, max: k.levels }) }}</span></span>
              <UInputNumber v-model="spend[k.id]" :min="0" :max="k.levels - k.used" :default-value="0" size="sm" class="w-24" :aria-label="t('sheet.rest.spend_of', { name: k.name })" @update:model-value="healed = { ...healed, [k.id]: 0 }" />
              <UButton :label="t('sheet.dice.roll')" icon="i-lucide-dices" size="sm" variant="outline" :disabled="!spend[k.id]" @click="rollHitDice(k)" />
              <span v-if="healed[k.id]" class="font-mono text-success">+{{ healed[k.id] }}</span>
            </div>
            <p v-if="minRoll > 1" class="text-xs text-muted">
              {{ t('sheet.rest.min_roll', { n: minRoll }) }}
            </p>
            <p v-if="hpBack" class="text-success">
              {{ t('sheet.rest.hp_back', { n: hpBack }) }}
            </p>
          </section>

          <section v-if="recovery.length" class="flex flex-col gap-2">
            <h3 class="eyebrow text-muted">
              {{ t('sheet.rest.recovery') }}
            </h3>
            <div v-for="(r, i) in recovery" :key="i" class="flex flex-wrap items-center gap-2">
              <span class="flex-1">{{ r.label ?? t('sheet.rest.recovery') }}</span>
              <UButton v-if="r.dieCount && r.dieType" :label="recoveryTotal[i] !== undefined ? String(recoveryTotal[i]) : `${r.dieCount}d${r.dieType}${r.bonus ? signed(r.bonus) : ''}`" icon="i-lucide-dices" size="sm" variant="outline" @click="rollRecovery(i)" />
              <span v-else class="font-mono">{{ r.bonus }}</span>
            </div>
            <p class="text-muted">
              {{ t('sheet.rest.recovery_budget', { used: spent, max: budget }) }}
            </p>
            <div v-for="row in recoverable" :key="row.index" class="flex items-center gap-2">
              <span class="flex-1">{{ row.label }} <span class="text-xs text-muted">{{ t('sheet.rest.used', { n: row.used }) }}</span></span>
              <UInputNumber
                :model-value="picks[row.index] ?? 0"
                :min="0"
                :max="Math.min(row.used, (picks[row.index] ?? 0) + Math.floor((budget - spent) / row.weight))"
                size="sm"
                class="w-24"
                :aria-label="t('sheet.rest.recover_of', { name: row.label })"
                @update:model-value="v => { const next = [...picks]; next[row.index] = Number(v) || 0; picks = next }"
              />
            </div>
          </section>
        </template>

        <template v-else>
          <section class="flex flex-col gap-2">
            <h3 class="eyebrow text-muted">
              {{ t('hit_dice_title') }}
            </h3>
            <p v-if="regainAll" class="text-muted">
              {{ t('sheet.rest.regain_all') }}
            </p>
            <template v-else>
              <p class="text-muted">
                {{ t('sheet.rest.regain_up_to', { n: regainLimit }) }}
              </p>
              <div v-for="k in classes" :key="k.id" class="flex items-center gap-2">
                <span class="flex-1">{{ k.name }} <span class="text-xs text-muted">{{ t('sheet.rest.used', { n: k.used }) }}</span></span>
                <UInputNumber v-model="regain[k.id]" :min="0" :max="Math.min(k.used, (regain[k.id] ?? 0) + regainLimit - regainUsed)" :default-value="0" size="sm" class="w-24" :disabled="!k.used" :aria-label="t('sheet.rest.regain_of', { name: k.name })" />
              </div>
            </template>
          </section>
          <UCheckbox v-model="reduceExhaustion" :label="t('sheet.rest.reduce_exhaustion')" :disabled="!sheet.character.state.exhaustion" />
        </template>

        <UCheckbox v-for="o in gameOptions" :key="o.id" v-model="gameAnswers[o.id]" :label="t(o.label)" />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton :label="t('characters.cancel')" color="neutral" variant="ghost" @click="ui.close()" />
        <UButton :label="type === 'short' ? t('sheet.rest.take_short') : t('sheet.rest.take_long')" @click="take" />
      </div>
    </template>
  </USlideover>
</template>
