import { combatPower, type CombatPowerEntry } from './npc-combat-powers'
import { npcClassOptions, npcSpeciesOptions, powerDamage, progressionRows, progressionValue, propertyIds, type NpcClass, type NpcData, type NpcPower, type NpcSpecies, type NpcStat, type NpcWeapon } from './npc-data'
import { speciesTraits } from './npc-traits'
import { abilityMod, averageDice, pick, type Random } from './random'

/**
 * The NPC generator (the live /generators/npc, `mixins/npc_generator`), ported to the new
 * record shapes. It builds a disposable NPC for a challenge rating, class and species from
 * the CR table's budgets: armor class, hit points (with shields and features' bonuses),
 * attack bonus and damage per round (powers, weapons, grenades and legendary actions),
 * tilted by the offensive/defensive scale. The result is a bestiary record (the engine's
 * stat block shape), with English feature text in MDC (`:distance{length="30"}`).
 *
 * Every random choice goes through `random`, so a seeded source repeats an NPC.
 */

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type Ability = typeof ABILITIES[number]
export type DamageFocus = 'powers' | 'weapons' | 'grenades'
export const DAMAGE_FOCUSES: DamageFocus[] = ['powers', 'weapons', 'grenades']

export interface NpcListItem { id: string, level?: number, mark?: string, perDay?: number | string, uses?: number }
export interface NpcDamage { dieCount: number, dieType: number, type: string, mod?: boolean }

/** A feature, action, reaction or legendary action (the bestiary's entry shape). */
export interface NpcEntry {
  id?: string
  name?: string
  text?: string
  hit?: string
  target?: string
  attack?: 'melee' | 'ranged'
  mod?: Ability
  proficient?: boolean
  range?: number
  damage?: NpcDamage[]
  recharge?: 'short' | 'long'
  perDay?: boolean | number | string
  uses?: number
  cost?: number
  ref?: 'weapon' | 'power'
  weaponId?: string
  casterLevel?: number
  list?: (string | NpcListItem)[]
}

export interface NpcEntries {
  features?: NpcEntry[]
  actions?: NpcEntry[]
  reactions?: NpcEntry[]
  legendary?: { text?: string, actions: NpcEntry[] }
}

/** A generated NPC: a bestiary record. */
export interface GeneratedNpc {
  id: string
  name: string
  size: 'small' | 'medium'
  type: 'organic' | 'synthetic'
  alignment: string
  ac: number
  hp: { dieCount: number, dieType: 6 | 8 }
  speed: { walk: number, swim?: number }
  abilityScores: Record<Ability, number>
  savingThrows?: Ability[]
  skills?: string[]
  senses?: Record<string, number>
  irv?: { res?: string[], damImm?: string[], vul?: string[], conImm?: string[] }
  cr: string
  profBonus: number
  unit: 'archetype'
  shields?: { capacity: number, regen?: number }
  entries: NpcEntries
}

export interface NpcOptions {
  /** `npc-stats` id; random when left out. */
  cr?: string
  klass?: string
  species?: string
  /** -2 (more defensive) to 2 (more offensive). */
  offensiveScale?: number
  grenades?: boolean
  traits?: boolean
  damageFocus?: DamageFocus
  /** Time for the id (Date.now()). */
  now?: number
}

/** The budgets the NPC was built to, for tests and the curious. */
export interface NpcBudget {
  cr: NpcStat
  klass: string
  species: string
  offensiveScale: number
  damageFocus: DamageFocus
  metaLevel: number
  metaTier: number
  /** How far the scale moves hit points and damage from the CR's (a fraction). */
  percent: number
  hp: { min: number, max: number, bonus: number, average: number }
  damage: { target: number, min: number, max: number, average: number, fallback: boolean }
  attack: { min: number, max: number }
}

type DamageKind = 'weapon' | 'power' | 'grenade' | 'combat' | 'bonus'
/** Damage the NPC can deal, for the budget: average damage per use, and how many uses. */
export interface DamageUse { type: DamageKind, damage: number, uses: number }
interface LegendaryUse { type: 'power' | 'weapon' | 'grenade', cost: number }

const PERCENT_MODS: Record<number, [number, number, number]> = {
  0: [0.05, 0.1, 0.15],
  1: [0.1, 0.2, 0.3],
  2: [0.1, 0.25, 0.5],
  3: [0.1, 0.25, 0.5],
  4: [0.1, 0.25, 0.5],
}
const CLASS_STATS: Record<string, Ability[]> = {
  adept: ['wis', 'dex', 'cha'],
  engineer: ['int', 'dex', 'con'],
  infiltrator: ['dex', 'int', 'str'],
  sentinel: ['wis', 'int', 'dex'],
  soldier: ['dex', 'str', 'con'],
  vanguard: ['str', 'wis', 'con'],
}
const AC_MODS: Record<number, number[]> = {
  [-2]: [3, 3, 2, 2, 1],
  [-1]: [2, 2, 1, 1, 0],
  0: [1, 1, 0, 0, 0, -1, -1],
  1: [0, -1, -1, -2, -2],
  2: [-1, -2, -2, -3, -3],
}
const RESISTANCES: Record<number, number[]> = {
  0: [0, 0, 0, 0, 0, 0, 0, 0],
  1: [0, 0, 0, 0, 0, 1, 1, 1],
  2: [0, 0, 0, 1, 1, 1, 2, 2],
  3: [0, 1, 1, 1, 2, 2, 2, 2],
  4: [1, 1, 1, 2, 2, 2, 3, 3],
  5: [2, 2, 2, 2, 3, 3, 3, 3],
  6: [2, 2, 2, 3, 3, 3, 3, 3],
}
const IMMUNITIES: Record<number, number[]> = {
  0: [0, 0, 0, 0, 0, 0, 0, 0],
  1: [0, 0, 0, 0, 0, 0, 1, 1],
  2: [0, 0, 0, 0, 1, 1, 1, 1],
  3: [0, 0, 1, 1, 1, 1, 2, 2],
  4: [1, 1, 1, 1, 2, 2, 2, 2],
  5: [1, 1, 2, 2, 2, 2, 3, 3],
  6: [2, 2, 2, 2, 3, 3, 3, 3],
}
const VULNERABILITIES: Record<number, number[]> = {
  0: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  1: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2],
  2: [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2],
}
const SAVING_THROW_WEIGHTS: Record<number, number[]> = {
  0: [0, 1, 1, 2],
  1: [1, 1, 2, 2],
  2: [1, 2, 2, 3],
  3: [2, 2, 3, 3],
  4: [2, 3, 3, 4],
  5: [3, 3, 4, 4],
  6: [3, 4, 4, 5],
}
const BASE_SHIELDS: Record<number, { shields: number[], regen: number[] }> = {
  0: { shields: [0, 0, 0, 5, 5], regen: [0] },
  1: { shields: [0, 0, 5, 5, 5], regen: [0, 0, 0, 5, 5] },
  2: { shields: [5, 5, 5, 10, 10], regen: [0, 0, 5, 5, 10] },
  3: { shields: [5, 10, 10, 10, 15], regen: [0, 5, 5, 5, 10] },
  4: { shields: [10, 15, 15, 20], regen: [0, 5, 10] },
  5: { shields: [15, 20, 20], regen: [5, 10] },
  6: { shields: [20, 20, 20, 25, 25], regen: [5, 10, 15] },
  7: { shields: [20, 20, 25, 25, 30], regen: [10, 10, 15] },
  8: { shields: [20, 25, 30], regen: [10, 15] },
  9: { shields: [25, 30], regen: [10, 15] },
  10: { shields: [30], regen: [15] },
}
const TIER_RARITY: Record<number, string[]> = {
  1: ['common'],
  2: ['common', 'uncommon'],
  3: ['common', 'uncommon', 'rare', 'very_rare'],
  4: ['common', 'uncommon', 'rare', 'very_rare', 'spectre'],
}
const DAMAGE_TYPES = ['acid', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder']
const CONDITIONS = ['blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'lifted', 'paralyzed', 'poisoned', 'primed', 'prone', 'restrained', 'stunned']
const MARKS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four']
const ABILITY_TITLES: Record<Ability, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }

/** 1 → "1st", 2 → "2nd". */
export function ordinal(n: number): string {
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix}`
}
export const abilityTitle = (a: Ability) => ABILITY_TITLES[a]

/** "2 1st-level, 1 2nd-level". */
const levelCounts = (counts: number[]) => counts.map((n, i) => `${n} ${ordinal(i + 1)}-level`).filter((_, i) => counts[i]! > 0).join(', ')

/** A generated NPC's id: `generated-human-soldier-1731600000000`. */
export const npcId = (name: string, now: number) => `generated-${name.toLowerCase().replace(/[^a-z\d]+/g, '-').replace(/^-|-$/g, '')}-${now}`

interface WeaponAttack { damage: number, numAttacks: number, weapons: (NpcWeapon & { average: number })[] }

/** One generation: the state the live mixins kept on the page. */
export class NpcBuilder {
  readonly npc: GeneratedNpc
  readonly cr: NpcStat
  readonly klass: NpcClass
  readonly species: NpcSpecies
  readonly scale: number
  readonly focus: DamageFocus
  readonly grenades: boolean
  damage: DamageUse[] = []
  legendary: LegendaryUse[] = []
  healthBonus = 0
  damageTarget = 1
  fallback = false

  constructor(readonly data: NpcData, readonly random: Random, opts: Required<Omit<NpcOptions, 'cr' | 'klass' | 'species' | 'now'>> & { cr: NpcStat, klass: NpcClass, species: NpcSpecies, now: number }) {
    this.cr = opts.cr
    this.klass = opts.klass
    this.species = opts.species
    this.scale = opts.offensiveScale
    this.focus = opts.damageFocus
    this.grenades = opts.grenades
    const name = `${this.species.name} ${this.klass.name}`
    this.npc = {
      id: npcId(name, opts.now),
      name,
      size: 'medium',
      type: 'organic',
      alignment: 'nn',
      ac: 10,
      hp: { dieCount: 1, dieType: 8 },
      speed: { walk: 30 },
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      savingThrows: [],
      skills: [],
      senses: {},
      irv: {},
      cr: this.cr.id,
      profBonus: this.cr.profBonus,
      unit: 'archetype',
      entries: { features: [], actions: [], reactions: [] },
    }
  }

  pick<T>(list: readonly T[]): T | undefined {
    return pick(this.random, list)
  }

  get lcName() { return this.npc.name.toLowerCase() }
  get speciesId() { return this.species.id }
  get klassId() { return this.klass.id }
  get crMeta() { return Math.min(4, Math.floor(this.cr.normalized / 8)) }
  get defensiveCrMeta() { return Math.max(0, this.crMeta - this.scale) }
  get percentileMod() {
    const mods = PERCENT_MODS[this.crMeta]!
    return this.scale === 0 ? mods[0] : this.scale % 2 === 0 ? mods[2] : mods[1]
  }

  get minHp() {
    const mod = this.scale >= 0 ? this.percentileMod : 0
    return Math.max(Math.floor(this.cr.hp - this.cr.hp * mod - this.healthBonus), 5)
  }

  get maxHp() {
    const mod = this.scale <= 0 ? this.percentileMod : 0
    return Math.ceil(this.cr.hp + this.cr.hp * mod - this.healthBonus)
  }

  get minDmg() { return Math.floor(this.cr.damage - this.cr.damage * (this.scale <= 0 ? this.percentileMod : 0)) }
  get maxDmg() { return Math.floor(this.cr.damage + this.cr.damage * (this.scale >= 0 ? this.percentileMod : 0)) }
  get metaLevel() {
    const n = this.cr.normalized
    return Math.min(20, Math.max(1, Math.floor(((n + n / 3) / 20) * 10)))
  }

  get metaTier() { return this.metaLevel < 5 ? 1 : this.metaLevel < 11 ? 2 : this.metaLevel < 17 ? 3 : 4 }

  mod(ability: Ability) { return abilityMod(this.npc.abilityScores[ability]) }
  /** 8 + proficiency + the ability's modifier. */
  dc(ability: Ability) { return 8 + this.npc.profBonus + this.mod(ability) }
  /** Dice that grow by tier: `initial` dice, plus `increase` per tier above the first. */
  tierDieCount(initial: number, increase: number) { return initial + increase * (this.metaTier - 1) }
  /** "7 (2d6)". */
  damageText(dieCount: number, dieType: number) { return `${Math.floor(averageDice(dieType, dieCount))} (${dieCount}d${dieType})` }

  addDamage(d: DamageUse) { this.damage.push(d) }
  isDamageAddable(d: DamageUse) { return averageDamage([...this.damage, d], this.legendary) <= this.maxDmg }
  isHpBonusAddable(bonus: number) { return this.mod('con') + 5 + this.healthBonus + bonus <= this.maxHp }
  isLegendaryAddable(l: LegendaryUse) {
    return averageDamage(this.damage, [...this.legendary, l]) <= this.damageTarget + this.damageTarget / 6
  }

  addSkill(id: string) {
    if (!this.npc.skills!.includes(id)) this.npc.skills!.push(id)
  }

  /** Species resistances; a type the NPC resists is no longer one it's vulnerable to (live listed both). */
  addResistances(...types: string[]) {
    const irv = this.npc.irv!
    irv.res = [...new Set([...(irv.res ?? []), ...types])].filter(d => !irv.damImm?.includes(d))
    irv.vul = irv.vul?.filter(d => !types.includes(d))
  }

  feature(e: NpcEntry) { this.npc.entries.features!.push(e) }
  action(e: NpcEntry) { this.npc.entries.actions!.push(e) }
  raise(ability: Ability, by = 1) { this.npc.abilityScores[ability] = Math.min(30, this.npc.abilityScores[ability] + by) }

  build(traits: boolean): NpcBudget {
    this.setDamageBudget()
    this.npc.type = this.speciesId === 'geth' ? 'synthetic' : 'organic'
    this.npc.alignment = `${this.pick(['l', 'n', 'c'])}${this.pick(['g', 'n', 'e'])}`
    this.npc.ac = this.cr.ac + (this.pick(AC_MODS[this.scale] ?? [0]) ?? 0)
    this.setIrvs()
    this.setSavingThrows()
    this.setSenses()
    this.npc.size = this.speciesId === 'volus' ? 'small' : 'medium'
    this.setSkills()
    this.setSpeed()
    this.setAbilityScores()
    const attack = { min: this.marginMin, max: this.marginMax }
    if (traits) speciesTraits[this.speciesId]?.(this)
    this.setFeatures()
    this.setDamageByFocus()
    this.setHp()
    if (this.metaTier > 2) this.setLegendary()
    this.finish()
    return {
      cr: this.cr,
      klass: this.klassId,
      species: this.speciesId,
      offensiveScale: this.scale,
      damageFocus: this.focus,
      metaLevel: this.metaLevel,
      metaTier: this.metaTier,
      percent: this.percentileMod,
      hp: { min: this.minHp, max: this.maxHp, bonus: this.healthBonus, average: hitPointAverage(this.npc) },
      damage: { target: this.damageTarget, min: this.minDmg, max: this.maxDmg, average: averageDamage(this.damage, this.legendary), fallback: this.fallback },
      attack,
    }
  }

  setDamageBudget() {
    const base = this.cr.damage
    const low = base - Math.floor(this.percentileMod * base)
    const high = base + Math.ceil(this.percentileMod * base)
    if (this.scale === 0) this.damageTarget = this.pick(Array.from({ length: high - low }, (_, i) => i + low)) ?? low
    else this.damageTarget = this.scale > 0 ? high : low
  }

  setIrvs() {
    const damageTypes = [...DAMAGE_TYPES]
    const irv = this.npc.irv!
    const some = (weights: number[], from: string[]) => {
      const n = this.pick(weights) ?? 0
      return [...new Set(Array.from({ length: n }, () => this.pick(from)!))]
    }
    if (this.scale <= 0) {
      if (this.scale === -2) damageTypes.push('piercing', 'slashing', 'bludgeoning')
      irv.conImm = some(IMMUNITIES[this.defensiveCrMeta]!, CONDITIONS)
      irv.res = some(RESISTANCES[this.defensiveCrMeta]!, damageTypes)
    }
    if (this.scale >= 0) {
      irv.vul = some(VULNERABILITIES[this.scale]!, damageTypes.filter(d => !irv.res?.includes(d)))
    }
  }

  setSavingThrows() {
    let n = this.pick(SAVING_THROW_WEIGHTS[this.defensiveCrMeta]!) ?? 0
    const pool: Ability[] = [...ABILITIES]
    const out: Ability[] = []
    for (const save of (this.klass.profs?.['saving-throw']?.has ?? []) as Ability[]) {
      if (n <= 0 || !pool.includes(save)) continue
      pool.splice(pool.indexOf(save), 1)
      out.push(save)
      n--
    }
    for (let i = 0; i < n; i++) {
      const save = this.pick(pool)!
      pool.splice(pool.indexOf(save), 1)
      out.push(save)
    }
    this.npc.savingThrows = out
  }

  setSenses() {
    if (this.speciesId === 'prothean') this.npc.senses = { truesight: 30 }
    else if (['quarian', 'vorcha'].includes(this.speciesId) && this.pick([1, 2, 3]) === 3) this.npc.senses = { darkvision: 60 }
  }

  setSkills() {
    const classSkills = this.klass.profs?.skill?.choices?.items ?? []
    const options = this.data.skills.filter(s => classSkills.includes(s.id))
    const n = this.pick([1, 1, 1, 2, 2, 2, 2, 3, 3])!
    for (let i = 0; i < n; i++) {
      const skill = this.pick(options)
      if (skill) this.addSkill(skill.id)
    }
  }

  setSpeed() {
    const walk: Record<string, number> = { volus: 25, elcor: 20, drell: 35, vorcha: 40 }
    this.npc.speed = { walk: this.speciesId === 'quarian' ? (this.pick([1, 2, 3]) === 3 ? 35 : 30) : walk[this.speciesId] ?? 30 }
  }

  get marginMin() { return this.cr.attack + Math.min(this.scale, 0) }
  get marginMax() { return Math.min(19, this.cr.attack + Math.max(this.scale, 0)) }

  setAbilityScores() {
    const scores = this.npc.abilityScores
    const weights = CLASS_STATS[this.klassId] ?? ['str', 'dex', 'con']
    const standard = this.cr.normalized <= 5 ? [12, 11, 10, 10, 9, 8] : [15, 14, 13, 12, 10, 8]
    for (const a of ABILITIES) scores[a] = weights.includes(a) ? standard[weights.indexOf(a)]! : standard[this.pick([3, 4, 5])!]!

    // The species' increases, and a random subspecies' when it has them.
    const increases = (this.species.mechanics ?? []).filter(m => m.type.startsWith('asi'))
    if (this.species.subspecies) {
      const sub = this.pick(this.data.species.filter(s => s.type === 'subspecies' && s.species === this.speciesId))
      increases.push(...(sub?.mechanics ?? []).filter(m => m.type.startsWith('asi')))
    }
    for (const inc of increases) {
      if (inc.type === 'asi-choice') {
        const from = [...(inc.limit?.length ? inc.limit : ABILITIES)] as Ability[]
        const count = Math.max(1, inc.selections ?? 1)
        const each = inc.total ? Math.max(1, Math.floor(inc.total / count)) : (inc.amount ?? 1)
        for (let i = 0; i < count && from.length; i++) {
          const a = this.pick(from)!
          from.splice(from.indexOf(a), 1)
          scores[a] += each
        }
      }
      else if (inc.type === 'asi') {
        const ability = (Array.isArray(inc.ability) ? this.pick(inc.ability) : inc.ability) as Ability | undefined
        if (ability && ability in scores) scores[ability] += Number(inc.amount ?? 1) || 0
      }
    }

    // Constitution follows the scale: more defensive, more hit points.
    scores.con -= this.scale

    // Keep the primary ability's attack bonus within the CR's margins.
    const attackBonus = abilityMod(scores[weights[0]!]) + this.cr.profBonus
    if (attackBonus > this.marginMax) {
      const reduction = (attackBonus - this.marginMax) * 2
      for (const a of ABILITIES) if (scores[a] > 10) scores[a] -= reduction
    }
    else if (attackBonus < this.marginMin) {
      const diff = this.marginMin - attackBonus
      for (const a of ABILITIES) scores[a] = Math.min(30, scores[a] + (weights.includes(a) ? diff * 2 : diff))
    }
  }

  // Class features (Features.js).
  setFeatures() {
    const level = this.metaLevel
    const num = (label: string) => Number(progressionValue(this.klass, label, level)) || 0
    const barrier = () => {
      const ticks = num('barrier_ticks')
      const bonus = Math.floor(ticks * 4.5)
      if (!ticks || !this.isHpBonusAddable(bonus)) return
      this.feature({
        name: 'Barrier',
        uses: num('barrier_uses') || 1,
        perDay: true,
        text: `As an action or bonus action, the ${this.lcName} gains ${ticks} barrier ticks. When the ${this.lcName} is dealt damage, it removes one barrier tick and reduces the damage by 1d8.`,
        id: 'barrier',
      })
      this.healthBonus += bonus
    }
    switch (this.klassId) {
      case 'sentinel': {
        barrier()
        const points = (level + this.mod('cha')) * 2
        if (points > 0 && this.isHpBonusAddable(points * 2)) {
          this.feature({
            name: 'Tech Armor',
            uses: 2,
            perDay: true,
            text: `As a bonus action, the ${this.lcName} can activate its Tech Armor. It immediately gains ${points} temporary hit points. Any damage is dealt to these temporary hit points first.`,
            id: 'tech-armor',
          })
          this.healthBonus += points * 2
        }
        break
      }
      case 'infiltrator': {
        const uses = num('tactical_cloak_uses')
        if (uses && this.isHpBonusAddable(5 * uses)) {
          this.feature({
            name: 'Tactical Cloak',
            uses,
            perDay: true,
            text: `As a bonus action, the ${this.lcName} may cast Tactical Cloak, becoming invisible. When it makes an attack roll, casts a power, or uses a grenade or heavy weapon, tactical cloak ends.`,
            id: 'tactical-cloak',
          })
          this.healthBonus += 10 * uses
        }
        const dice = String(progressionValue(this.klass, 'sneak_attack_damage', level) ?? '')
        const [count, sides] = dice.split('d').map(Number)
        const extra = Math.floor(averageDice(sides, count))
        const dmg: DamageUse = { type: 'bonus', damage: extra, uses: 5 }
        if (extra > 0 && this.isDamageAddable(dmg)) {
          this.feature({
            name: 'Sneak Attack',
            text: `Once per turn, the ${this.lcName} deals an extra ${extra} (${dice}) damage when it hits a target with a weapon attack and has advantage on the attack roll, or when the target is within :distance{length="5"} of an ally of the ${this.lcName} that isn't incapacitated and the ${this.lcName} doesn't have disadvantage on the attack roll.`,
            id: 'sneak-attack',
          })
          this.addDamage(dmg)
        }
        break
      }
      case 'adept':
      case 'vanguard':
        barrier()
        break
      case 'engineer': {
        const dmg: DamageUse = { type: 'bonus', damage: 2, uses: 5 }
        if (this.isHpBonusAddable(2 * this.metaTier) && this.isDamageAddable(dmg)) {
          const drone = this.pick(['assault', 'combat', 'defense', 'disruption', 'recon', 'rocket'])
          this.action({
            name: 'Summon Drone',
            uses: this.metaTier,
            perDay: true,
            text: `The ${this.lcName} summons a ${drone} drone in an unoccupied space within :distance{length="30"}.`,
            id: 'summon-drone',
          })
          this.healthBonus += 5 * this.metaTier
          this.addDamage(dmg)
        }
        break
      }
    }
  }

  setDamageByFocus() {
    const order: Record<DamageFocus, (() => void)[]> = {
      powers: [() => this.setPowercasting(), () => this.setCombatPowers(), () => this.setWeaponActions(), () => this.setGrenades()],
      weapons: [() => this.setWeaponActions(), () => this.setPowercasting(), () => this.setCombatPowers(), () => this.setGrenades()],
      grenades: [() => this.setGrenades(), () => this.setPowercasting(), () => this.setCombatPowers(), () => this.setWeaponActions()],
    }
    for (const step of order[this.focus]) step()
  }

  // Powercasting (Powercasting.js).
  get classPowers() {
    return this.data.powers.filter(p => p.classes?.includes(this.klassId) && p.powerType !== 'combat')
  }

  /** Picks `count` powers one at a time: the first a 1st-level power, damaging ones first when powers are the focus. */
  private choosePowers(options: { power: NpcPower, dmg: DamageUse }[], count: number, allowed: (p: NpcPower) => boolean) {
    const list: string[] = []
    let n = 0
    let damaging = this.focus === 'powers'
    while (n < count) {
      const left = options.filter(o => allowed(o.power)
        && !list.includes(o.power.id)
        && this.isDamageAddable(o.dmg)
        && (n === 0 ? o.power.level === 1 : true)
        && (damaging ? !!powerDamage(o.power) : true))
      const chosen = this.pick(left)
      if (chosen) {
        list.push(chosen.power.id)
        this.addDamage(chosen.dmg)
        n++
      }
      else if (!damaging) n++
      else damaging = false
    }
    return list
  }

  /** How many leveled powers a caster of this level knows (half the adept's or vanguard's slots). */
  numPowers(level: number) {
    const lookup = ['adept', 'engineer'].includes(this.klassId) ? 'adept' : 'vanguard'
    const rows = progressionRows(this.data.classes.find(c => c.id === lookup), 'power_slots_by_power_level')
    const n = rows.reduce((sum, row) => sum + ((row[level - 1] ?? 0) > 0 ? Math.ceil(row[level - 1]! / 2) : 0), 0)
    return this.klassId === 'vanguard' ? n : Math.max(1, n)
  }

  cantrips(level: number) {
    const count = Math.max(1, this.klassId === 'vanguard' ? Math.ceil(level / 8) : Math.ceil(level / 4))
    const options = this.classPowers.filter(p => p.level === 0).map((power) => {
      const d = powerDamage(power)
      return { power, dmg: { type: 'power', damage: d ? averageDice(d.dieType, d.dieCount) : 0, uses: 5 } satisfies DamageUse }
    })
    const list: string[] = []
    for (let i = 0; i < count; i++) {
      const chosen = this.pick(options.filter(o => !list.includes(o.power.id) && this.isDamageAddable(o.dmg)))
      if (!chosen) continue
      list.push(chosen.power.id)
      this.addDamage(chosen.dmg)
    }
    return list
  }

  setPowercasting() {
    if (this.klassId === 'soldier') return
    const levels = Array.from({ length: this.metaLevel }, (_, i) => i).reverse().slice(0, this.focus === 'powers' ? 3 : 7)
    const level = (this.pick(levels) ?? 0) + 1
    const name = this.lcName
    let list: string[]
    let resources: string
    let ability: Ability
    switch (this.klassId) {
      case 'engineer':
      case 'infiltrator': {
        const points = Number(progressionValue(this.klass, 'tech_points', level)) || 0
        const limit = Number(progressionValue(this.klass, 'tech_point_limit', level)) || 1
        const uses = Math.floor(points / limit)
        const options = this.classPowers.map((power) => {
          const d = powerDamage(power, limit - power.level)
          return { power, dmg: { type: 'power', damage: d ? averageDice(d.dieType, d.dieCount) : 0, uses } satisfies DamageUse }
        })
        list = this.choosePowers(options, this.numPowers(level), p => p.level <= limit)
        resources = `It has ${points} tech points and can spend up to ${limit} on one power. It knows the following powers:`
        ability = 'int'
        break
      }
      case 'adept':
      case 'vanguard': {
        const slots = progressionRows(this.klass, 'power_slots_by_power_level').map(row => row[level - 1] ?? 0).filter(n => n > 0)
        const maxLevel = slots.length
        const options = this.classPowers.map((power) => {
          let damage = 0
          if (powerDamage(power)) {
            // The average of its first five casts, highest slots first.
            let casts = 0
            let total = 0
            for (let slotLevel = maxLevel; slotLevel >= 1 && casts < 5; slotLevel--) {
              const n = Math.min(slots[slotLevel - 1]!, 5 - casts)
              const d = powerDamage(power, slotLevel - power.level)
              total += n * (d ? averageDice(d.dieType, d.dieCount) : 0)
              casts += n
            }
            damage = Math.floor(total / 5)
          }
          return { power, dmg: { type: 'power', damage, uses: 5 } satisfies DamageUse }
        })
        list = this.choosePowers(options, this.numPowers(level), p => p.level > 0 && p.level <= maxLevel).concat(this.cantrips(level))
        resources = `It has ${levelCounts(slots)} power slots and knows the following powers:`
        ability = this.speciesId === 'asari' ? 'cha' : 'wis'
        break
      }
      case 'sentinel': {
        const slots = Number(progressionValue(this.klass, 'power_slots', level)) || 1
        const maxLevel = Number(progressionValue(this.klass, 'power_level', level)) || 1
        const options = this.classPowers.map((power) => {
          const d = powerDamage(power, maxLevel - power.level)
          return { power, dmg: { type: 'power', damage: d ? averageDice(d.dieType, d.dieCount) : 0, uses: Math.ceil(slots / 2) } satisfies DamageUse }
        })
        list = this.choosePowers(options, this.numPowers(level), p => p.level > 0 && p.level <= maxLevel).concat(this.cantrips(level))
        resources = `It has ${slots} ${ordinal(maxLevel)}-level power slot${slots === 1 ? '' : 's'}, which it regains when it finishes a short or long rest, and knows the following powers:`
        ability = 'cha'
        break
      }
      default:
        return
    }
    if (!list.length) return
    const hit = this.mod(ability) + this.npc.profBonus
    this.feature({
      name: 'Powercasting',
      casterLevel: level,
      mod: ability,
      ref: 'power',
      text: `The ${name} is ${[8, 11, 18].includes(level) ? 'an' : 'a'} ${ordinal(level)}-level powercaster. Its powercasting ability is ${abilityTitle(ability)} (power save DC ${8 + hit}, ${hit < 0 ? hit : `+${hit}`} to hit with powers). ${resources}`,
      id: 'powercasting',
      list,
    })
  }

  // Combat powers (CombatPowers.js).
  setCombatPowers() {
    const max = this.klassId === 'soldier' ? Math.ceil(this.metaLevel / 4) : Math.ceil(this.metaLevel / 8)
    const num = this.pick(Array.from({ length: max + 1 }, (_, i) => i)) ?? 0
    const options = this.data.powers.filter(p => p.powerType === 'combat' && p.classes?.includes(this.klassId) && combatPower(this, p.id))
    const taken: string[] = []
    for (let i = 0; i < num; i++) {
      const left = options.map(p => combatPower(this, p.id)!).filter((cp: CombatPowerEntry) => !taken.includes(cp.id) && this.isDamageAddable(cp.dmg))
      const chosen = this.pick(left)
      if (!chosen) continue
      this.npc.entries[chosen.group]!.push(chosen.entry)
      this.addDamage(chosen.dmg)
      taken.push(chosen.id)
    }
  }

  // Weapons (Weapons.js).
  attackOptions(): WeaponAttack[] {
    const str = this.mod('str')
    const dex = this.mod('dex')
    const weapons = this.data.weapons
      .filter(w => TIER_RARITY[this.metaTier]!.includes(w.rarity ?? '') && w.damage && (this.speciesId !== 'hanar' || propertyIds(w).includes('light')))
      .map((w) => {
        const props = propertyIds(w)
        const bonus = props.some(p => ['finesse', 'recoil'].includes(p)) ? Math.max(str, dex) : w.weaponType === 'melee' ? str : dex
        return { ...w, average: averageDice(w.damage!.dieType || 0, w.damage!.dieCount) + bonus }
      })
    const attacks: WeaponAttack[] = []
    for (const w of weapons) for (let i = 1; i <= 3; i++) attacks.push({ damage: w.average * i, numAttacks: i, weapons: [w] })
    // Two-weapon fighting: light, one-handed weapons; melee pairs only with hip-fire guns.
    const dual = weapons.filter(w => propertyIds(w).includes('light') && !propertyIds(w).includes('two-handed'))
    const seen = new Set<string>()
    for (const main of dual) {
      for (const off of dual) {
        const melee = (w: NpcWeapon) => w.weaponType === 'melee'
        const hipFire = (w: NpcWeapon) => propertyIds(w).includes('hip-fire')
        if ((melee(main) && !melee(off) && !hipFire(off)) || (melee(off) && !melee(main) && !hipFire(main)) || (melee(main) && main.id === off.id)) continue
        if (seen.has(`${main.id}/${off.id}`) || seen.has(`${off.id}/${main.id}`)) continue
        attacks.push({ damage: main.average + off.average, numAttacks: 2, weapons: [main, off] })
        seen.add(`${main.id}/${off.id}`)
      }
    }
    return attacks.sort((a, b) => b.damage - a.damage)
  }

  setWeaponActions() {
    const all = this.attackOptions()
    let options = all.filter(a => this.isDamageAddable({ type: 'weapon', damage: a.damage, uses: 5 }))
    if (!options.length) {
      // Nothing fits the budget: the weakest attacks.
      options = all.slice(-5)
      this.fallback = true
    }
    const strong = options.filter(a => a.damage >= this.minDmg)
    const attack = this.pick(strong.length ? strong : options.slice(0, 20))
    if (!attack) return
    this.addDamage({ type: 'weapon', damage: attack.damage, uses: 5 })
    if (attack.numAttacks > 1) this.action({ name: 'Multiattack', text: this.multiattackText(attack), id: 'multiattack' })
    attack.weapons.forEach((w, i) => this.action({ ref: 'weapon', proficient: true, weaponId: w.id, id: `${w.id}-${i}`, ...(this.speciesId === 'elcor' ? { mod: 'int' as const } : {}) }))
  }

  multiattackText(attack: WeaponAttack) {
    const [a, b] = attack.weapons
    const n = NUMBER_WORDS[attack.numAttacks]
    const s = attack.numAttacks > 1 ? 's' : ''
    let text = `The ${this.lcName} makes`
    if (b) {
      if (a!.weaponType === 'melee' && b.weaponType === 'melee') text += ` ${n} melee attack${s}`
      else if (a!.id === b.id) text += ` ${n} ${a!.name} attack${s}, one in each hand`
      else {
        const half = NUMBER_WORDS[attack.numAttacks / 2]
        text += ` ${n} attacks: ${half} with its ${a!.name} and ${half} with its ${b.name}`
      }
    }
    else text += ` ${n} ${a!.name} attack${s}`
    return `${text}.`
  }

  // Grenades (Grenades.js).
  grenadeOptions() {
    const marks = MARKS.slice(0, Math.floor(this.metaLevel / 2) + 1)
    const out: { id: string, entry: NpcListItem, damage: number }[] = []
    for (const g of this.data.gear.filter(i => i.gearType === 'grenade')) {
      for (let uses = 1; uses <= this.metaTier; uses++) {
        if (!g.marks?.length) {
          out.push({ id: g.id, entry: { id: g.id, uses }, damage: 0 })
          continue
        }
        for (const m of g.marks.filter(m => marks.includes(m.mark))) {
          const [count, sides] = (m.damage ?? '').split('d').map(Number)
          out.push({ id: `${g.id}-${m.mark}`, entry: { id: g.id, mark: m.mark.toLowerCase(), uses }, damage: m.damage ? Math.floor(averageDice(sides, count) * uses) : 0 })
        }
      }
    }
    return out
  }

  setGrenades() {
    if (!this.grenades) return
    const n = this.pick(Array.from({ length: this.metaTier }, (_, i) => i + 1)) ?? 1
    const all = this.grenadeOptions()
    const list: NpcListItem[] = []
    for (let i = 0; i < n; i++) {
      const fits = all
        .filter(o => this.isDamageAddable({ type: 'grenade', damage: o.damage, uses: o.entry.uses! }) && !list.some(l => l.id === o.entry.id))
        .sort((a, b) => b.damage - a.damage)
        .slice(0, 10)
      const chosen = this.pick(fits)
      if (!chosen) continue
      list.push(chosen.entry)
      this.addDamage({ type: 'grenade', damage: chosen.damage, uses: chosen.entry.uses! })
    }
    if (!list.length) return
    this.feature({ list, name: 'Grenades', text: `The ${this.lcName} has the following grenades equipped. It can use a grenade as an action.`, id: 'grenades' })
  }

  // Hit points and shields (Hp.js).
  get hitDie(): 6 | 8 { return this.speciesId === 'volus' ? 6 : 8 }

  setHp() {
    const base = BASE_SHIELDS[Math.min(10, this.defensiveCrMeta)]!
    const capacity = this.pick(base.shields) ?? 0
    if (capacity > 0) {
      const regen = this.pick(base.regen.filter(r => r <= capacity)) ?? 0
      if (this.isHpBonusAddable(capacity + regen)) {
        this.npc.shields = regen ? { capacity, regen } : { capacity }
        this.healthBonus += capacity + regen
      }
    }
    const perDie = (this.hitDie + 1) / 2 + this.mod('con')
    if (perDie <= 0) {
      this.npc.hp = { dieCount: 1, dieType: this.hitDie }
      return
    }
    // Enough dice to reach the minimum; a defensive NPC keeps adding until just past the maximum.
    let dice = Math.max(1, Math.ceil(this.minHp / perDie))
    if (this.scale < 0) {
      while (dice * perDie < this.maxHp) dice++
    }
    this.npc.hp = { dieCount: dice, dieType: this.hitDie }
  }

  // Legendary actions (Legendary.js), for tiers 3 and 4.
  setLegendary() {
    const order: LegendaryUse['type'][] = this.focus === 'powers'
      ? ['power', 'weapon', ...(this.grenades ? ['grenade' as const] : [])]
      : this.focus === 'weapons'
        ? ['weapon', 'power', ...(this.grenades ? ['grenade' as const] : [])]
        : this.grenades ? ['grenade', 'weapon', 'power'] : ['weapon', 'power']
    const actions: NpcEntry[] = []
    for (const type of order.filter(t => !(t === 'power' && this.klassId === 'soldier'))) {
      if (averageDamage(this.damage, this.legendary) >= this.minDmg) continue
      for (let cost = 1; cost < 4; cost++) {
        const use = { type, cost }
        if (!this.isLegendaryAddable(use)) continue
        const multiattack = this.npc.entries.actions!.find(a => a.id === 'multiattack')
        const kinds = {
          power: { name: 'Cast a Power', text: `The ${this.lcName} casts one of its powers.`, id: 'cast-power' },
          weapon: { name: 'Attack', text: multiattack?.text ?? `The ${this.lcName} makes one weapon attack.`, id: 'attack' },
          grenade: { name: 'Use a Grenade', text: `The ${this.lcName} uses one of its grenades.`, id: 'grenade' },
        }
        actions.push({ ...kinds[type], cost })
        this.legendary.push(use)
        break
      }
    }
    if (!actions.length) return
    const extra: NpcEntry[] = [
      { id: 'detect', name: 'Detect', text: `The ${this.lcName} makes a Wisdom (Perception) check.` },
      { id: 'move', name: 'Move', text: `The ${this.lcName} moves up to its speed.` },
      { id: 'dodge', name: 'Dodge', text: `The ${this.lcName} takes the Dodge action.` },
      { id: 'hide', name: 'Hide', text: `The ${this.lcName} takes the Hide action.` },
      ...(['adept', 'vanguard', 'sentinel'].includes(this.klassId) ? [{ id: 'barrier', name: 'Barrier', text: `The ${this.lcName} uses its Barrier.` }] : []),
      ...(this.klassId === 'infiltrator' ? [{ id: 'tactical-cloak', name: 'Tactical Cloak', text: `The ${this.lcName} uses its Tactical Cloak.` }] : []),
    ]
    while (actions.length < 3) {
      const chosen = this.pick(extra.filter(e => !actions.some(a => a.id === e.id)))
      if (!chosen) break
      actions.push(chosen)
    }
    this.npc.entries.legendary = {
      text: `The ${this.lcName} can take 3 legendary actions, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature's turn. The ${this.lcName} regains spent legendary actions at the start of its turn.`,
      actions,
    }
  }

  /** Drops empty fields, so the NPC is a clean bestiary record. */
  finish() {
    const npc = this.npc
    for (const a of ABILITIES) npc.abilityScores[a] = Math.min(30, Math.max(1, npc.abilityScores[a]))
    const irv = Object.fromEntries(Object.entries(npc.irv ?? {}).filter(([, list]) => list?.length))
    if (Object.keys(irv).length) npc.irv = irv
    else delete npc.irv
    if (!npc.savingThrows?.length) delete npc.savingThrows
    if (!npc.skills?.length) delete npc.skills
    if (!Object.keys(npc.senses ?? {}).length) delete npc.senses
    npc.entries = Object.fromEntries(Object.entries(npc.entries).filter(([, list]) => !Array.isArray(list) || list.length))
  }
}

/**
 * The average damage per round (calcAvgDamage): the best five uses of actions, plus
 * legendary actions' share, plus bonus damage (sneak attack, drones).
 */
export function averageDamage(damage: DamageUse[], legendary: LegendaryUse[] = []): number {
  let total = 0
  let actionUses = 0
  let actionDamage = 0
  for (const a of damage.filter(d => d.type !== 'bonus' && d.damage > 0).sort((a, b) => b.damage - a.damage)) {
    if (actionUses >= 5) continue
    actionUses += a.uses
    actionDamage += a.damage * a.uses
  }
  total += actionDamage > 0 && actionUses > 0 ? Math.ceil(actionDamage / actionUses) : 0
  let legendaryDamage = 0
  let legendaryUses = 0
  for (const l of legendary) {
    for (const a of damage.filter(d => d.type === l.type && d.damage > 0)) {
      legendaryDamage += a.damage * a.uses
      legendaryUses += Math.ceil(a.uses / (4 - l.cost))
    }
  }
  total += legendaryDamage > 0 && legendaryUses > 0 ? Math.ceil(legendaryDamage / legendaryUses) : 0
  let bonusDamage = 0
  let bonusUses = 0
  for (const a of damage.filter(d => d.type === 'bonus' && d.damage > 0)) {
    bonusDamage += a.damage * a.uses
    bonusUses += a.uses
  }
  total += bonusDamage > 0 && bonusUses > 0 ? Math.ceil(bonusDamage / bonusUses) : 0
  return Math.ceil(total)
}

/** The NPC's average hit points (hit dice plus Constitution), as its stat block shows them. */
export function hitPointAverage(npc: Pick<GeneratedNpc, 'hp' | 'abilityScores'>): number {
  return Math.floor(averageDice(npc.hp.dieType, npc.hp.dieCount)) + abilityMod(npc.abilityScores.con) * npc.hp.dieCount
}

/** Rolls an NPC. Options left out are chosen at random (as the live generator did). */
export function generateNpc(data: NpcData, options: NpcOptions, random: Random): { npc: GeneratedNpc, budget: NpcBudget } {
  const cr = (options.cr ? data.stats.find(s => s.id === options.cr) : undefined) ?? pick(random, data.stats)
  const classes = npcClassOptions(data)
  const klass = (options.klass ? classes.find(c => c.id === options.klass) : undefined) ?? pick(random, classes)
  const species = npcSpeciesOptions(data)
  const sp = (options.species ? species.find(s => s.id === options.species) : undefined) ?? pick(random, species)
  if (!cr || !klass || !sp) throw new Error('the NPC generator needs challenge ratings, classes and species')
  const builder = new NpcBuilder(data, random, {
    cr,
    klass,
    species: sp,
    offensiveScale: Math.max(-2, Math.min(2, Math.round(options.offensiveScale ?? 0))),
    grenades: options.grenades ?? true,
    traits: options.traits ?? true,
    damageFocus: options.damageFocus ?? pick(random, DAMAGE_FOCUSES)!,
    now: options.now ?? Date.now(),
  })
  const budget = builder.build(options.traits ?? true)
  return { npc: builder.npc, budget }
}
