<script setup lang="ts">
/**
 * One stat block entry (feature, action, reaction, legendary action): its name
 * and limitation, then its text, or the attack worked out from the creature's
 * scores (`ref: weapon` entries take the weapon's damage and properties), and
 * the power or item list under it.
 */
import type { StatBlockRefs, StatBlockRules, StatEntry } from '../../utils/statblock'

const props = defineProps<{
  entry: StatEntry
  scores: Record<string, number>
  profBonus: number
  refs: StatBlockRefs
  rules?: StatBlockRules
  /** Power slots by power level and caster level, for leveled powercasting. */
  slots?: number[][]
}>()

const { t } = useI18n()
const { distance } = useUnits()
const feet = (n: number | undefined) => distance(Number(n), { abbr: true })

// A weapon action shows once its weapon has loaded.
const shown = computed(() => {
  const e = props.entry
  if (e.ref !== 'weapon' || !e.weaponId) return e
  const weapon = props.refs.weapons[e.weaponId]
  return weapon ? weaponAttackEntry(e, weapon, props.scores, props.rules) : undefined
})

const description = computed(() => {
  const e = shown.value
  if (!e) return ''
  if (e.attack) return attackDescription(t, e, props.scores, props.profBonus, feet)
  const save = entrySaveText(t, e, props.scores, props.profBonus)
  return [e.text, save && t('lists.sentences[1]', [save])].filter(Boolean).join(' ')
})

const list = computed(() => {
  const e = props.entry
  switch (entryListKind(e)) {
    case 'leveled': return { collection: 'powers', lines: leveledPowerLines(t, e, props.refs.powers, props.slots) }
    case 'innate': return { collection: 'powers', lines: innatePowerLines(t, e, props.refs.powers) }
    case 'items': return { collection: 'gear', lines: itemUseLines(t, e, props.refs.items) }
    default: return undefined
  }
})
</script>

<template>
  <div v-if="shown">
    <p>
      <span class="font-semibold italic text-highlighted">{{ entryTitle(t, shown) }}</span>{{ ' ' }}<StatblockText v-if="description" :value="description" />
    </p>
    <StatblockListLines v-if="list?.lines.length" :lines="list.lines" :collection="list.collection" />
  </div>
</template>
