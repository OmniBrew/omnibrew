import { ABILITY_KEYS } from '../../character/schema'
import type { Sheet } from '../sheet'
import type { Mech } from '../types'
import { withLookup } from './skills'

export interface SaveScore {
  proficient: boolean
  mod: number
}

/** Saving throws (the live MeCsSavingThrows component): proficiency from `saving-throw` mechanics or typed saves, plus bonuses. */
export function computeSaves(sheet: Sheet): Record<string, SaveScore> {
  const mechanics = sheet.ofType('saving-throw').map(m => withLookup(sheet, m))
  const out: Record<string, SaveScore> = {}
  for (const ability of ABILITY_KEYS) {
    const proficient = mechanics.some(m => m.value?.includes(ability) && !m.effect) || sheet.profs.savingThrow.includes(ability)
    const bonus = mechanics.filter(m => m.value?.includes(ability) && m.effect?.type === 'bonus').reduce((a, m) => a + sheet.formula(m.effect.bonus), 0)
    out[ability] = { proficient, mod: (sheet.abilities[ability]?.mod ?? 0) + (proficient ? sheet.profBonus : 0) + bonus }
  }
  return out
}

/** Advantage and disadvantage on saves "against" conditions and other noted effects. */
export function saveNotes(sheet: Sheet) {
  const mechanics = sheet.ofType('saving-throw')
  const against = (type: string) => [...new Set(mechanics.filter(m => m.effect?.type === type && !m.ability && m.against?.length).flatMap(m => [m.against].flat()))]
  return {
    advantageAgainst: against('advantage'),
    disadvantageAgainst: against('disadvantage'),
    notes: mechanics.filter(m => m.effect && !m.effect.type && !m.ability && !m.against).map(m => m.note),
  }
}

export interface SpeedValue {
  distance: number
  note?: string
  overridden?: boolean
}

/**
 * Speeds (the live `speeds` getter): a typed speed wins; otherwise the highest
 * `speed` of each kind plus every `speed-bonus` for it, minus the armor
 * strength penalty. Walking speed is 0 without any; other speeds are absent.
 */
export function computeSpeeds(sheet: Sheet): Record<string, SpeedValue | null> {
  const armor = sheet.rules.armor
  let penalty = 0
  if (sheet.character.options.armorSpeedPenalty && !sheet.hasFlag('ignore-armor-strength')) {
    const str = sheet.abilities.str?.total ?? 0
    const { pieces } = sheet.armorBreakdown
    const rule = armor.strength.find(r => (pieces[r.type] ?? 0) >= r.pieces)
    if (rule && rule.str > (str ?? 0)) penalty = -armor.strengthPenalty
  }
  const out: Record<string, SpeedValue | null> = {}
  for (const speed of ['walk', 'swim', 'fly', 'climb', 'burrow']) {
    const typed = sheet.character.overrides.speeds[speed]
    if (typed) {
      out[speed] = { distance: typed, note: 'overridden', overridden: true }
      continue
    }
    const candidates = sheet.ofType('speed').filter(m => m.speed === speed).sort((a, b) => b.distance - a.distance)
    if (!candidates.length) {
      out[speed] = null
      continue
    }
    const bonus = sheet.ofType('speed-bonus').filter(m => m.value.includes(speed)).reduce((a, m) => a + sheet.formula(m.bonus), 0)
    out[speed] = { distance: candidates[0]!.distance + bonus + penalty, ...(candidates[0]!.note ? { note: candidates[0]!.note } : {}) }
  }
  return out
}

/** Highest distance of each sense, typed or from `sense` mechanics. */
export function computeSenses(sheet: Sheet): Record<string, number> {
  const out: Record<string, number> = {}
  const typed = sheet.character.overrides.senses
  for (const sense of sheet.enums.values.senses ?? []) {
    const distances = sheet.ofType('sense').filter(m => [m.sense].flat().includes(sense) && typeof m.distance === 'number').map(m => m.distance as number)
    out[sense] = Math.max(0, typed[sense] ?? 0, ...distances)
  }
  return out
}

export function computeInitiative(sheet: Sheet) {
  const mechanics = sheet.ofType('initiative')
  const bonus = mechanics.filter(m => m.effect?.type === 'bonus').reduce((a, m) => a + sheet.formula(m.effect.bonus), 0)
  return {
    bonus: (sheet.abilities.dex?.mod ?? 0) + bonus,
    advantage: mechanics.some(m => m.effect?.type === 'advantage'),
    disadvantage: mechanics.some(m => m.effect?.type === 'disadvantage'),
  }
}

export interface DefenseEntry {
  id: string
  label?: string
  note?: string
}

export type Defenses = Record<'resistance' | 'immunity' | 'condition-immunity' | 'vulnerability', DefenseEntry[]>

/**
 * Resistances, immunities, condition immunities and vulnerabilities: typed ones
 * first, then mechanics, each id once (the first one's note and label win).
 * `fall-damage` with `resistance` lists as the resistance `fall` ("Falling Damage").
 */
export function computeDefenses(sheet: Sheet): Defenses {
  const typed = sheet.character.overrides.defenses
  const lists: Record<keyof Defenses, { typed: string[], mechanics: Mech[] }> = {
    'resistance': { typed: typed.resistance, mechanics: sheet.ofType('resistance', 'fall-damage').filter(m => m.type === 'resistance' || m.resistance).map(m => (m.type === 'fall-damage' ? { ...m, value: 'fall' } : m)) },
    'immunity': { typed: typed.immunity, mechanics: sheet.ofType('immunity') },
    'condition-immunity': { typed: typed.conditionImmunity, mechanics: sheet.ofType('condition-immunity') },
    'vulnerability': { typed: typed.vulnerability, mechanics: sheet.ofType('vulnerability') },
  }
  const out = {} as Defenses
  for (const [type, { typed: t, mechanics }] of Object.entries(lists) as Array<[keyof Defenses, typeof lists[keyof Defenses]]>) {
    const seen = new Set<string>()
    const entries: DefenseEntry[] = []
    for (const d of [...t.map(value => ({ type: type, value }) as Mech), ...mechanics]) {
      const id = d.value ?? d.id
      if (seen.has(id)) continue
      seen.add(id)
      entries.push({ id, ...(d.label ? { label: d.label } : {}), ...(d.note ? { note: d.note } : {}) })
    }
    out[type] = entries
  }
  return out
}
