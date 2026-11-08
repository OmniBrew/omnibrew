import { ABILITY_KEYS, type Character } from '../character'
import { readCompanion, type Companion, type CompanionAction, type CompanionActionType, type CompanionExtension, type CompanionPool } from '../character/companion'

/**
 * Companions on the sheet (plan/26 §1.6; the live MeCsCompanionStatBlock): what a stat
 * block shows, computed from the companion's own numbers, and the play actions (damage
 * through the game's pools, healing, regen, resources). Pure functions, character in,
 * character out; components only show `companionSheet`'s values.
 */
export type AbilityKey = typeof ABILITY_KEYS[number]

export interface CompanionSkill {
  id: string
  name: string
  ability: AbilityKey
}

export interface CompanionView {
  companion: Companion
  abilities: Array<{ key: AbilityKey, score: number, mod: number }>
  saves: Array<{ key: AbilityKey, mod: number, proficient: boolean }>
  skills: Array<{ id: string, name: string, mod: number, expertise: boolean }>
  passivePerception: number
  /** Hit points, then the game's pools (ME shields), each with its current, max and regen. */
  pools: Array<{ id: string, label: string, color: string, current: number, max: number, regen: number }>
  actions: Array<{ type: CompanionActionType, items: CompanionActionView[] }>
}

export interface CompanionActionView {
  action: CompanionAction
  /** `1d20+5`, when the action has an attack bonus. */
  hitNotation?: string
  hit?: number
  /** `2d6+3`, when it deals damage. */
  damageNotation?: string
  dc?: number
}

export const abilityMod = (score: number) => Math.floor((score - 10) / 2)
const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))

export const HP_POOL: CompanionPool = { id: 'hp', label: 'sheet.vitals.hp', color: 'text-emerald-700 dark:text-emerald-400', current: 'currentHp', max: 'hp' }

export function companionSheet(raw: unknown, ext: CompanionExtension = {}, skills: CompanionSkill[] = []): CompanionView {
  const c = readCompanion(raw, ext)
  const prof = c.profBonus
  const mods = Object.fromEntries(ABILITY_KEYS.map(k => [k, abilityMod(Number(c[k]) || 10)])) as Record<AbilityKey, number>
  const skillMod = (s: CompanionSkill) => mods[s.ability] + (c.skills.includes(s.id) ? prof * (c.expertises.includes(s.id) ? 2 : 1) : 0)
  const perception = skills.find(s => s.id === 'perception')
  const pools = [HP_POOL, ...(ext.pools ?? [])].map(p => ({
    id: p.id,
    label: p.label,
    color: p.color,
    current: Number(c[p.current]) || 0,
    max: Number(c[p.max]) || 0,
    regen: p.regen ? Number(c[p.regen]) || 0 : 0,
  })).filter(p => p.id === 'hp' || p.max > 0)

  const view = (a: CompanionAction): CompanionActionView => {
    const out: CompanionActionView = { action: a }
    if (a.hit !== undefined) {
      out.hit = a.hit
      out.hitNotation = `1d20${signed(a.hit)}`
    }
    if (a.dmgDieCount && a.dmgDieType) out.damageNotation = `${a.dmgDieCount}d${a.dmgDieType}${a.dmgBonus ? signed(a.dmgBonus) : ''}`
    else if (a.dmgBonus) out.damageNotation = String(a.dmgBonus)
    if (a.dc !== undefined) out.dc = a.dc
    return out
  }
  const order: CompanionActionType[] = ['Attack', 'Action', 'Bonus Action', 'Reaction', 'Other']
  return {
    companion: c,
    abilities: ABILITY_KEYS.map(k => ({ key: k, score: Number(c[k]) || 10, mod: mods[k] })),
    saves: ABILITY_KEYS.map(k => ({ key: k, mod: mods[k] + (c.savingThrows.includes(k) ? prof : 0), proficient: c.savingThrows.includes(k) })),
    skills: skills.filter(s => c.skills.includes(s.id)).map(s => ({ id: s.id, name: s.name, mod: skillMod(s), expertise: c.expertises.includes(s.id) })),
    passivePerception: 10 + (perception ? skillMod(perception) : mods.wis),
    pools,
    actions: order.map(type => ({ type, items: c.features.filter(f => f.type === type).map(view) })).filter(g => g.items.length),
  }
}

/** Edits one companion of a character (by uuid); the rest of the character is untouched. */
export function editCompanion(character: Character, uuid: string, fn: (c: Companion) => void, ext: CompanionExtension = {}): Character {
  const next = structuredClone(character)
  next.companions = next.companions.map((raw) => {
    if ((raw as { uuid?: unknown }).uuid !== uuid) return raw
    const c = readCompanion(raw, ext)
    fn(c)
    return c
  })
  return next
}

export function addCompanion(character: Character, companion: Companion): Character {
  return { ...structuredClone(character), companions: [...character.companions, companion] }
}

export function removeCompanion(character: Character, uuid: string): Character {
  return { ...structuredClone(character), companions: character.companions.filter(c => (c as { uuid?: unknown }).uuid !== uuid) }
}

/**
 * Damage to a companion: the game's pools absorb first (in the order the game lists them;
 * `bypass` skips them), then hit points, which stop at 0.
 */
export function damageCompanion(c: Companion, amount: number, ext: CompanionExtension = {}, options: { bypass?: boolean } = {}) {
  let left = Math.max(0, Math.floor(amount))
  if (!options.bypass) {
    for (const p of ext.pools ?? []) {
      const current = Number(c[p.current]) || 0
      const taken = Math.min(current, left)
      ;(c as Record<string, unknown>)[p.current] = current - taken
      left -= taken
    }
  }
  c.currentHp = Math.max(0, c.currentHp - left)
}

export function healCompanion(c: Companion, amount: number) {
  c.currentHp = Math.min(c.hp, c.currentHp + Math.max(0, Math.floor(amount)))
}

/** Regains each pool's regen (ME shields), up to its maximum. */
export function regenCompanion(c: Companion, ext: CompanionExtension = {}) {
  for (const p of ext.pools ?? []) {
    if (!p.regen) continue
    const max = Number(c[p.max]) || 0
    ;(c as Record<string, unknown>)[p.current] = Math.min(max, (Number(c[p.current]) || 0) + (Number(c[p.regen]) || 0))
  }
}

/** Sets a pool's current value, kept between 0 and its maximum. */
export function setCompanionPool(c: Companion, pool: Pick<CompanionPool, 'current' | 'max'>, value: number) {
  const max = Number(c[pool.max]) || 0
  ;(c as Record<string, unknown>)[pool.current] = Math.min(max, Math.max(0, Math.floor(value) || 0))
}

/** Uses or regains one use of an action's resource (the live counter, checkboxes and heat). */
export function setCompanionResource(c: Companion, actionUuid: string, remaining: number) {
  const a = c.features.find(f => f.uuid === actionUuid)
  if (!a || a.resourceMax === undefined) return
  a.remainingResources = Math.min(a.resourceMax, Math.max(0, Math.floor(remaining)))
}
