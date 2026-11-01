import type { Character, EquipmentEntry, LearnedPower } from '../character/schema'
import type { Sheet } from './sheet'
import type { GradientCondition, Rec, VitalPool } from './types'

/**
 * What playing a sheet changes (plan/24 §1.3): pure functions, character in,
 * character out. The page applies one and saves the result; nothing here reads
 * the page. Game rules (ME shields, barrier, capacities) come from
 * `GameRules.play`, never from a game id. Ported from the live sheet's health,
 * rest, toggle and manager components.
 */

/** A changed copy of the character (characters are plain JSON). */
export function edit(character: Character, change: (c: Character) => void): Character {
  const next = JSON.parse(JSON.stringify(character)) as Character
  change(next)
  return next
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)

// --- vitals ---

/** The game's pools (ME barrier, tech armor, shields), in the order damage applies. */
export function vitalPools(sheet: Sheet): VitalPool[] {
  return sheet.rules.play?.pools?.(sheet) ?? []
}

export interface DamageOptions {
  /** Skip bypassable pools (shields). */
  bypass?: boolean
  /** Double the damage doublable pools take (2× to shields). */
  double?: boolean
}

/** Damage through the game's pools, then temp HP, then hit points (the live `execDamage`). */
export function damage(sheet: Sheet, amount: number, options: DamageOptions = {}): Character {
  let left = Math.max(0, Math.floor(amount))
  let character = sheet.character
  if (!left) return character
  for (const pool of vitalPools(sheet)) {
    if (!pool.absorbs || left <= 0 || pool.current <= 0) continue
    if (pool.bypassable && options.bypass) continue
    const double = pool.doublable && options.double
    const taken = Math.min(pool.current, double ? left * 2 : left)
    character = pool.set(character, pool.current - taken)
    left = double ? Math.floor((left * 2 - taken) / 2) : left - taken
  }
  const temp = sheet.character.state.tempHp
  const hpMax = sheet.hp.max
  return edit(character, (c) => {
    if (left > 0 && temp.value > 0) {
      const taken = Math.min(temp.value, left)
      const value = temp.value - taken
      c.state.tempHp = { max: value === 0 ? 0 : temp.max, value }
      left -= taken
    }
    if (left > 0) c.state.hitPointsLost = Math.min(hpMax, c.state.hitPointsLost + left)
  })
}

/** Heals hit points; healing from 0 clears the death saves. */
export function heal(sheet: Sheet, amount: number): Character {
  const n = Math.max(0, Math.floor(amount))
  if (!n) return sheet.character
  return edit(sheet.character, (c) => {
    if (c.state.hitPointsLost >= sheet.hp.max) c.state.deathSaves = { successes: 0, failures: 0 }
    c.state.hitPointsLost = Math.max(0, c.state.hitPointsLost - n)
  })
}

/** Adds temp HP (as live: they add up, and the max grows with them). */
export function addTempHp(sheet: Sheet, amount: number): Character {
  const n = Math.max(0, Math.floor(amount))
  if (!n) return sheet.character
  return edit(sheet.character, (c) => {
    const t = c.state.tempHp
    c.state.tempHp = { max: Math.max(t.max, n, t.max + n), value: t.value + n }
  })
}

/** Sets a pool (barrier ticks, tech armor, shields) to a value, kept within 0..max. */
export function setPool(sheet: Sheet, id: string, current: number): Character {
  const pool = vitalPools(sheet).find(p => p.id === id)
  if (!pool) return sheet.character
  return pool.set(sheet.character, pool.gainable ? Math.max(0, current) : clamp(current, 0, pool.max))
}

/** Regains a pool's regen (or `amount`): the Regen button. */
export function regen(sheet: Sheet, id: string, amount?: number): Character {
  const pool = vitalPools(sheet).find(p => p.id === id)
  if (!pool) return sheet.character
  return pool.set(sheet.character, clamp(pool.current + (amount ?? pool.regen ?? 0), 0, pool.max))
}

export function setDeathSaves(character: Character, saves: { successes: number, failures: number }): Character {
  return edit(character, (c) => {
    c.state.deathSaves = { successes: clamp(saves.successes, 0, 3), failures: clamp(saves.failures, 0, 3) }
  })
}

export function setInspiration(character: Character, value: boolean): Character {
  return edit(character, (c) => {
    c.state.inspiration = value
  })
}

// --- conditions ---

export const EXHAUSTION_LEVELS = 6

/** Conditions with levels: the game's, plus exhaustion unless the game lists it. */
export function gradientConditions(sheet: Sheet): GradientCondition[] {
  const game = sheet.rules.play?.gradients?.(sheet) ?? []
  if (game.some(g => g.id === 'exhaustion')) return game
  return [{
    id: 'exhaustion',
    value: sheet.character.state.exhaustion,
    max: EXHAUSTION_LEVELS,
    set: (character, value) => edit(character, (c) => {
      c.state.exhaustion = value
    }),
  }, ...game]
}

export function setGradient(sheet: Sheet, id: string, value: number): Character {
  const g = gradientConditions(sheet).find(x => x.id === id)
  return g ? g.set(sheet.character, clamp(Math.floor(value), 0, g.max)) : sheet.character
}

export function setCondition(character: Character, id: string, on: boolean): Character {
  return edit(character, (c) => {
    const has = c.state.conditions.includes(id)
    if (on && !has) c.state.conditions.push(id)
    if (!on && has) c.state.conditions = c.state.conditions.filter(x => x !== id)
  })
}

// --- resources and toggles ---

export function setResource(character: Character, id: string, value: number): Character {
  return edit(character, (c) => {
    c.state.resources[id] = value
  })
}

/** The option a toggle has picked (its first when none or a stale one). */
export function toggleSelection(character: Character, toggle: Rec): Rec | undefined {
  const options = toggle.options as Rec[] | undefined
  if (!options?.length) return undefined
  const picked = character.state.toggles[`${toggle.id}-selection`]
  return options.find(o => o.id === picked) ?? options[0]
}

/**
 * Turns a toggle on or off and runs its `resource` effects (`whenOn`/`whenOff`, its
 * picked option's too): set, add or subtract a resource (the live `executeToggle`).
 */
export function setToggle(sheet: Sheet, toggle: Rec, on: boolean): Character {
  const which = on ? 'whenOn' : 'whenOff'
  const effects = [...(toggle[which] as Rec[] | undefined) ?? [], ...(toggleSelection(sheet.character, toggle)?.[which] as Rec[] | undefined) ?? []]
  return edit(sheet.character, (c) => {
    c.state.toggles[toggle.id] = on
    for (const e of effects) {
      if (e.type !== 'resource' || !e.value) continue
      let value = sheet.formula(e.value)
      if (e.method !== 'set') {
        const current = c.state.resources[e.id] ?? 0
        value = e.method === 'add' ? current + value : current - value
      }
      c.state.resources[e.id] = value
    }
  })
}

export function setToggleSelection(character: Character, toggleId: string, optionId: string): Character {
  return edit(character, (c) => {
    c.state.toggles[`${toggleId}-selection`] = optionId
  })
}

// --- powercasting ---

/** Spends (or, negative, regains) slots of a level. */
export function spendSlots(sheet: Sheet, level: number, n = 1): Character {
  const slot = sheet.powercasting.slots[level]
  if (!slot) return sheet.character
  return edit(sheet.character, (c) => {
    c.state.slotsUsed[level] = clamp(slot.used + n, 0, slot.max)
  })
}

/** Spends (or regains) points of a pool (`points:tech`). */
export function spendPoints(sheet: Sheet, pool: string, n: number): Character {
  const p = sheet.powercasting.points[pool]
  if (!p) return sheet.character
  return edit(sheet.character, (c) => {
    c.state.pointsUsed[pool] = clamp(p.used + n, 0, p.max)
  })
}

/** The pool a power of this type casts from, and what one casting at `level` costs. */
export function castCost(sheet: Sheet, powerType: string, level: number): { pool: string, kind: 'slots' | 'points', amount: number } | null {
  if (level === 0) return null
  const pool = sheet.powerSystem.pools.find(p => p.powerTypes.includes(powerType))
  if (!pool) return null
  return pool.kind === 'points' ? { pool: pool.id, kind: 'points', amount: level } : { pool: pool.id, kind: 'slots', amount: 1 }
}

/** Casts a leveled power: spends a slot of its level or its level in points. */
export function cast(sheet: Sheet, powerType: string, level: number): Character {
  const cost = castCost(sheet, powerType, level)
  if (!cost) return sheet.character
  return cost.kind === 'points' ? spendPoints(sheet, cost.pool, cost.amount) : spendSlots(sheet, level, 1)
}

// --- rests ---

export interface RestChoices {
  /** Short rest: hit dice spent per class, and the hit points they rolled. */
  hitDice?: Record<string, { used: number, hp: number }>
  /** Long rest: hit dice regained per class (ignored with `regain-all-hit-dice`). */
  hitDiceRegained?: Record<string, number>
  /** Short rest: points and slots regained (`power-resource-recovery`): index 0 = points, 1..n = slot levels. */
  recovered?: number[]
  /** Long rest: lose one level of exhaustion. */
  reduceExhaustion?: boolean
  /** Answers to the game's rest options (`GamePlay.restOptions`). */
  game?: Record<string, boolean>
}

/** Hit dice the character may regain on a long rest: half its level, at least one. */
export const hitDiceRegainLimit = (sheet: Sheet) => Math.max(Math.floor(sheet.level / 2), 1)

/** The highest `min-hit-die-roll` bonus: the lowest a hit die can roll. */
export const minHitDieRoll = (sheet: Sheet) => sheet.ofType('min-hit-die-roll').reduce((a, m) => Math.max(a, sheet.formula(m.bonus)), 0)

/** `power-resource-recovery` mechanics: what a short rest may recover (dice, bonus, limit, highest slot). */
export function recoveryOptions(sheet: Sheet) {
  return sheet.ofType('power-resource-recovery').map(m => ({
    mechanic: m,
    dieCount: Number(m.dieCount) || 0,
    dieType: Number(m.dieType) || 0,
    bonus: m.bonus ? sheet.formula(m.bonus) : 0,
    maxSlot: Number(m.maxSlot) || 5,
    limit: (m.limit ?? null) as 'points' | 'slots' | null,
    label: (m.label as string | undefined) ?? null,
  }))
}

/** Whether a mechanic's resource resets on this rest (a long rest resets short-rest resources too). */
const resets = (reset: unknown, type: 'short' | 'long') => (type === 'short' ? reset === 'short' : [null, undefined, 'short', 'long'].includes(reset as string))

/** A short or long rest (the live rest menu's `execRest`). */
export function rest(sheet: Sheet, type: 'short' | 'long', choices: RestChoices = {}): Character {
  const pc = sheet.powercasting
  let next = edit(sheet.character, (c) => {
    const s = c.state
    // Resources of mechanics, powers and custom features that reset on this rest.
    const withResource = [...sheet.mechanics, ...sheet.actions, ...sheet.powers].filter(m => m.resource && resets(m.resource.reset, type))
    for (const m of withResource) {
      const id = m.resource.id || m.id
      if (s.resources[id]) s.resources[id] = 0
    }
    for (const f of c.customFeatures) {
      if (f.uses && (type === 'long' || f.recharge === 'short') && s.resources[f.id]) s.resources[f.id] = 0
    }

    if (type === 'long') {
      s.slotsUsed = {}
      s.pointsUsed = {}
      s.hitPointsLost = 0
      s.tempHp = { max: 0, value: 0 }
      if (sheet.ofType('regain-all-hit-dice').length) {
        for (const k of c.classes) s.hitDiceUsed[k.id] = 0
      }
      else {
        let left = hitDiceRegainLimit(sheet)
        for (const [klass, n] of Object.entries(choices.hitDiceRegained ?? {})) {
          const take = Math.min(n, left, s.hitDiceUsed[klass] ?? 0)
          if (take > 0) s.hitDiceUsed[klass] = (s.hitDiceUsed[klass] ?? 0) - take
          left -= Math.max(take, 0)
        }
      }
      if (choices.reduceExhaustion) s.exhaustion = Math.max(0, s.exhaustion - 1)
    }
    else {
      if (pc.pact.slotLevel > 0) {
        const l = pc.pact.slotLevel
        s.slotsUsed[l] = Math.max(0, (s.slotsUsed[l] ?? 0) - pc.pact.numSlots)
      }
      const recovered = choices.recovered ?? []
      recovered.forEach((n, i) => {
        if (!n) return
        if (i === 0) {
          const pool = Object.keys(pc.points)[0]
          if (pool) s.pointsUsed[pool] = Math.max(0, (s.pointsUsed[pool] ?? 0) - n)
        }
        else s.slotsUsed[i] = Math.max(0, (s.slotsUsed[i] ?? 0) - n)
      })
      let healed = 0
      for (const [klass, spent] of Object.entries(choices.hitDice ?? {})) {
        const k = c.classes.find(x => x.id === klass)
        if (!k || spent.used <= 0) continue
        const used = s.hitDiceUsed[klass] ?? 0
        const n = Math.min(spent.used, k.levels - used)
        s.hitDiceUsed[klass] = used + n
        healed += spent.hp
      }
      if (healed > 0) s.hitPointsLost = Math.max(0, s.hitPointsLost - healed)
    }
  })
  const play = sheet.rules.play
  if (play?.rest) next = play.rest(sheet, next, type, choices.game ?? {})
  return next
}

// --- equipment ---

const uuid = () => globalThis.crypto.randomUUID()

/** Adds an owned item: a content record (`kind` is its collection's item kind). */
export function addItem(character: Character, item: { id: string, kind: string }, extra: Partial<EquipmentEntry> = {}): Character {
  return edit(character, (c) => {
    c.equipment.push({ uuid: uuid(), id: item.id, kind: item.kind, equipped: false, ...extra })
  })
}

export function removeItem(character: Character, uuid: string): Character {
  return edit(character, (c) => {
    c.equipment = c.equipment.filter(e => e.uuid !== uuid)
  })
}

export function updateItem(character: Character, uuid: string, patch: Partial<EquipmentEntry>): Character {
  return edit(character, (c) => {
    const entry = c.equipment.find(e => e.uuid === uuid)
    if (entry) Object.assign(entry, patch)
  })
}

/** Why the item can't be equipped now (the game's rules), or null. */
export function equipCheck(sheet: Sheet, uuid: string) {
  return sheet.rules.play?.canEquip?.(sheet, uuid) ?? null
}

/** Equips or unequips an item; equipping follows the game's rules (throws nothing: check `equipCheck` first). */
export function setEquipped(sheet: Sheet, uuid: string, equipped: boolean): Character {
  let next = updateItem(sheet.character, uuid, { equipped })
  if (sheet.rules.play?.onEquip) next = sheet.rules.play.onEquip(sheet, next, uuid, equipped)
  return next
}

export function setCredits(character: Character, credits: number): Character {
  return edit(character, (c) => {
    c.state.credits = Math.max(0, credits)
  })
}

// --- powers ---

export interface PickablePower {
  power: Rec
  learned: boolean
  advancement: string | null
  /** Granted by a feature (its mechanic's source path): doesn't count, can't be removed. */
  fromFeature: string | false
  /** Learned, but above the class's highest power level now. */
  notAvailable: boolean
  /** Advancements can't be picked for it (ME `me:prevent-advancements`). */
  noAdvancements: boolean
}

/** Powers a class may learn: its list, plus other classes' lists from `use-class-for-*-list` (the live picker). */
export function powerList(sheet: Sheet, classId: string): Rec[] {
  const all = sheet.content.list('powers')
  const forClass = (k: string) => all.filter(p => (p.classes as string[] | undefined)?.includes(k))
  const other = sheet.ofType('use-class-for-power-list')
  const otherCantrips = sheet.ofType('use-class-for-cantrip-list')
  const cantripLists = otherCantrips.length ? otherCantrips : other
  const seen = new Set<string>()
  return [
    ...forClass(classId),
    ...cantripLists.flatMap(m => forClass(m.klass).filter(p => p.level === 0)),
    ...other.flatMap(m => forClass(m.klass).filter(p => p.level > 0)),
  ].filter(p => !seen.has(p.id) && seen.add(p.id))
}

/** The power picker's rows for one class, with the counts against its limits. */
export function powerPicker(sheet: Sheet, classId: string) {
  const limits = sheet.powercasting.byClass[classId] ?? { numPowers: 0, maxPowerLevel: -1, numCantrips: 0, learned: true, powercastingType: null }
  const allowAdvancements = sheet.rules.play?.advancements?.(sheet, classId) ?? true
  const learned = sheet.character.powers.filter(p => p.class === classId)
  const granted = sheet.ofType('powers')
  const rows: PickablePower[] = []
  for (const power of powerList(sheet, classId)) {
    const mine = learned.find(p => p.id === power.id)
    const fromFeature = granted.find(m => m.value === power.id)?.source ?? false
    const row: PickablePower = { power, learned: !!mine, advancement: mine?.advancement ?? null, fromFeature, notAvailable: false, noAdvancements: power.level > 0 && !allowAdvancements }
    if (power.level === 0) {
      if (limits.numCantrips > 0) rows.push(row)
    }
    else if (power.level > limits.maxPowerLevel) {
      if (row.learned) rows.push({ ...row, notAvailable: true })
    }
    else rows.push(row)
  }
  rows.sort((a, b) => a.power.level - b.power.level)
  const count = (cantrips: boolean) => rows.filter(r => (r.learned || r.fromFeature) && (r.power.level === 0) === cantrips)
    .reduce((a, r) => a + (r.fromFeature ? 0 : 1) + (r.advancement ? 1 : 0), 0)
  const cantrips = count(true)
  const powers = count(false)
  return {
    rows,
    limits,
    cantrips,
    powers,
    canLearn: cantrips < limits.numCantrips || powers < limits.numPowers,
    hasIssues: cantrips > limits.numCantrips || powers > limits.numPowers || rows.some(r => r.notAvailable),
  }
}

/** Learns a power for a class, or forgets it. */
export function togglePower(character: Character, classId: string | null, powerId: string): Character {
  return edit(character, (c) => {
    const i = c.powers.findIndex(p => p.id === powerId && p.class === classId)
    if (i > -1) c.powers.splice(i, 1)
    else c.powers.push({ id: powerId, class: classId, advancement: null } satisfies LearnedPower)
  })
}

/** Picks (or, picked again, clears) a learned power's advancement. */
export function setPowerAdvancement(character: Character, classId: string | null, powerId: string, advancement: string): Character {
  return edit(character, (c) => {
    const p = c.powers.find(x => x.id === powerId && x.class === classId)
    if (p) p.advancement = p.advancement === advancement ? null : advancement
  })
}

/** Picks (or clears) the advancement of a power a feature grants: a choice under `<feature path>/advancements`. */
export function setGrantedAdvancement(character: Character, featurePath: string, powerId: string, advancement: string): Character {
  return edit(character, (c) => {
    const path = `${featurePath}/advancements`
    const current = c.choices.find(x => x.path === path)
    const picked = current?.values[0]
    const same = picked && typeof picked === 'object' && 'advancement' in picked && picked.advancement === advancement
    c.choices = c.choices.filter(x => x.path !== path)
    if (!same) c.choices.push({ path, values: [{ power: powerId, advancement }] })
  })
}
