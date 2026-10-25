import type { Sheet } from '../sheet'

export interface ArmorBreakdown {
  /** AC from armor before Dex (the unarmored base plus what the pieces add). */
  armorAc: number
  /** Pieces worn per armor type (a suit counts as `suitPieces`). */
  pieces: Record<string, number>
  /** Armor type worn in each slot (`none` when empty), for `ac` mechanics limited to armor types. */
  wornTypes: string[]
  /** Sum of `ac` mechanic bonuses that apply. */
  flatBonus: number
  /** Dex cap of the heaviest type worn (`undefined` = none, 0 = no Dex). */
  maxDex?: number
}

/**
 * Armor worn (the live `equippedArmorBreakdown`): a suit adds its type's bonus
 * and ignores chest, arm and leg pieces for AC; otherwise each piece adds its
 * slot's bonus for its type. Every piece worn (the head too) counts toward the
 * strength and proficiency rules. A suit with its own `ac.base` (5e armor) sets
 * the base instead.
 */
export function computeArmorBreakdown(sheet: Sheet): ArmorBreakdown {
  const rules = sheet.rules.armor
  const worn = sheet.equipment.equippedArmor
  const slotOf = (data: { coverage?: string, slot?: string }) => (data.coverage === 'suit' ? 'suit' : data.slot ?? 'none')
  const first = (slot: string) => worn.find(a => slotOf(a.data) === slot)
  const slots = ['head', 'suit', 'chest', 'legs', 'arms']
  const bySlot = Object.fromEntries(slots.map(s => [s, first(s)]))
  const pieces: Record<string, number> = {}
  const count = (type: string, n: number) => { pieces[type] = (pieces[type] ?? 0) + n }
  let armorAc = rules.base
  const suit = bySlot.suit
  if (suit) {
    const type = suit.data.armorType
    armorAc = suit.data.ac?.base ?? armorAc + (rules.bonus.suit?.[type] ?? 0)
    count(type, rules.suitPieces)
  }
  else {
    for (const slot of ['chest', 'arms', 'legs']) {
      const piece = bySlot[slot]
      if (!piece) continue
      count(piece.data.armorType, 1)
      armorAc += rules.bonus[slot]?.[piece.data.armorType] ?? 0
    }
  }
  if (bySlot.head) count(bySlot.head.data.armorType, 1)

  const wornTypes = ['head', 'suit', 'chest', 'legs', 'arms'].map(s => bySlot[s]?.data.armorType ?? 'none')
  let flatBonus = 0
  for (const m of sheet.ofType('ac')) {
    let bonus = m.bonus ? sheet.formula(m.bonus) : 0
    if (m.condition && sheet.rules.conditions?.[m.condition] && !sheet.rules.conditions[m.condition]!(sheet)) bonus = 0
    if (m.limit && !wornTypes.every(t => [...m.limit, 'none'].includes(t))) bonus = 0
    flatBonus += bonus
  }
  const caps = Object.entries(rules.maxDex).filter(([type]) => (pieces[type] ?? 0) > 0).map(([, cap]) => cap)
  return { armorAc, pieces, wornTypes, flatBonus, maxDex: caps.length ? Math.min(...caps) : suit?.data.ac?.maxDex }
}

/** AC: a typed AC wins; else the better of armor + Dex and natural armor, plus bonuses. */
export function computeAc(sheet: Sheet): number {
  const typed = sheet.character.overrides.ac
  if (typed) return typed
  const { armorAc, flatBonus, maxDex } = sheet.armorBreakdown
  const dex = sheet.abilities.dex?.mod ?? 0
  const appliedDex = maxDex === 0 ? 0 : Math.min(maxDex ?? Infinity, dex)
  const natural = Math.max(0, ...sheet.ofType('natural-armor').map(m => m.base + (sheet.abilities[m.mod]?.mod ?? 0)))
  return Math.max(armorAc + appliedDex, natural) + flatBonus + sheet.character.overrides.acBonus
}
