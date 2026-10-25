import type { Character } from '../character/schema'
import type { Sheet } from './sheet'

/**
 * Content and mechanics as the engine reads them. Records were validated
 * against the game's zod schemas when the content was loaded (the validator
 * keeps the content repo at 0 errors), so the rules read their fields loosely,
 * the way the live site's Vuex getters did.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- validated content, read field by field
export type Rec = Record<string, any>

/** A mechanic after collection: its content fields plus where it came from. */
export interface Mech extends Rec {
  type: string
  /** Path of the record that granted it (`species/asari/traits/biotic-heritage`). */
  source?: string
  /** Equipment uuid, for mechanics of an owned item. */
  equipmentId?: string
  /** Set bonus (`<set>-<threshold>`), for armor set mechanics. */
  setBonusId?: string
  /** Toggle that switched it on. */
  toggleId?: string
}

/** A value expression (`{ type: 'mod', value: 'con' }`). */
export interface Formula {
  type: string
  value?: unknown
  multiplier?: number
  min?: number
  ceil?: boolean
  useMax?: boolean
  limit?: string
}

/** How a game's formula kinds are evaluated (`me:barrier-ticks`). */
export type FormulaKind = (formula: Formula, sheet: Sheet) => number

/** Group of mechanics granted together, as the live site's getters built them. */
export interface MechanicSource {
  path: string
  mechanics: Rec[]
}

/**
 * What one mechanic type does. Every registered type has a handler, so a type
 * no sheet section reads is a visible decision, not an oversight
 * (`describe` says where it shows). Sections ask for mechanics by `role`, never
 * by a game's type names: ME's `me:cantrip-boost` declares the flag
 * `cantrip-upcast-early`, which the power section reads.
 */
export interface MechanicHandler {
  type: string
  /** How the sheet uses it, for the coverage test and docs. */
  describe: string
  /** Engine flags this mechanic raises while present. */
  flags?: string[]
  /** A choice: the key its selections are stored under (`asi`, `skill`, the model of a model-choice). */
  choiceKey?: (m: Mech) => string
}

export interface ArmorRules {
  /** AC without armor. */
  base: number
  /** AC added by armor, per armor type, for a suit (`suit`) and each piece slot. */
  bonus: Record<string, Record<string, number>>
  /** Pieces a suit counts as (strength and proficiency checks count pieces). */
  suitPieces: number
  /** Highest Dex bonus allowed by the heaviest type worn (absent = no cap). */
  maxDex: Record<string, number>
  /** Strength needed by the armor worn: first matching rule wins. */
  strength: Array<{ type: string, pieces: number, str: number }>
  /** Speed lost when strength is too low. */
  strengthPenalty: number
  /** Unproficient pieces before attacks get disadvantage, and before powers can't be cast. */
  proficiencyPenalty: { disadvantage: number, noPowercasting: number }
}

export interface MulticlassPowerRules {
  /** Slots per slot level (index 0 = level 1) per multiclass caster level. */
  slots: number[][]
  /** Points and per-cast limit per multiclass caster level, per points pool kind. */
  points: number[]
  pointLimit: number[]
  pactSlotLevel: number[]
  pactSlots: number[]
}

export interface PowerRules {
  /** Casting ability of a class without a powercasting choice, or false (no casting stat). */
  classAbility: Record<string, string | false>
  /** Casting ability by power type, for powers not tied to a class. */
  typeAbility: Record<string, string>
  multiclass: MulticlassPowerRules
  /** Character levels where cantrips upcast; `early` when the flag `cantrip-upcast-early` is raised. */
  cantripLevels: { normal: number[], early: number[] }
  /** Highest level a leveled power upcasts to. */
  maxLevel: number
}

/** A card the sheet shows: an action, attack, power or feature with rolls. */
export interface SheetCard extends Rec {
  name?: string
}

export interface WeaponContext {
  /** The owned item (character equipment entry) and its record, overrides applied. */
  entry: Rec
  data: Rec
  properties: string[]
  /** Mod mechanics on the weapon. */
  mechanics: Mech[]
}

/**
 * Game hooks. Everything here is data or a function of the sheet; the engine
 * calls them without knowing which game it runs.
 */
export interface GameRules {
  handlers: MechanicHandler[]
  formulas?: Record<string, FormulaKind>
  armor: ArmorRules
  powers: PowerRules
  /** Proficiencies a class grants when taken as a second (or later) class. */
  multiclassProfs: Record<string, Rec>
  /** Records the game provides without a content file (`custom` species, `custom-background`). */
  builtins?: Record<string, Rec[]>
  /** Collections where `model` values that name no collection are looked up by `familyField` (ME edge families). */
  families?: { collection: string, field: string }
  /** Mechanic sources only this game has (ME reputation benefits). */
  sources?: (sheet: Sheet) => MechanicSource[]
  /** Conditions an `ac` mechanic can name (`barrier-active`). */
  conditions?: Record<string, (sheet: Sheet) => boolean>
  /** Extra `{{ key }}` placeholders for card texts. */
  placeholders?: (sheet: Sheet, card: Rec) => Record<string, string | number | undefined>
  /** Game-only sheet sections (ME shields, barrier, reputation, capacities). */
  sections?: Record<string, (sheet: Sheet) => unknown>
  /** Extra actions on the sheet (ME barrier). */
  actions?: (sheet: Sheet) => SheetCard[]
  weapons: WeaponRules
}

export interface WeaponRules {
  /** Weapon types (and natural/strike types) that make melee attacks. */
  meleeTypes: string[]
  /** Weapon types always used proficiently (natural weapons, ME gun strike). */
  alwaysProficient?: string[]
  /** Properties that let an attack use the better of Str and Dex. */
  finesse: string[]
  /** Item mechanics applied inside the weapon attack, not added to the sheet. */
  weaponOnly: string[]
  /** Mod slots of a weapon, by weapon type. */
  modSlots: (weaponType: string) => string[]
  /** Built-in attacks every character has (unarmed strike); natural weapons replace or add to them. */
  unarmed: Rec
  /** Attacks added from the equipped weapons (ME gun strike). */
  extraAttacks?: (sheet: Sheet) => Rec[]
  /** Ability override for one weapon (ME shoulder mounts use Int). */
  ability?: (weapon: WeaponContext, sheet: Sheet) => string | undefined
  /** A mode the weapon attacks in (ME ammo mods): a save instead of an attack roll, a hit bonus, another damage type, more dice or damage. */
  mode?: (weapon: WeaponContext, sheet: Sheet) => WeaponMode | undefined
  /** Changes one weapon's attack card after it is built (ME heat, mode range and notes). */
  attack?: (card: SheetCard, weapon: WeaponContext, sheet: Sheet) => SheetCard
  /** Special attacks a weapon property unlocks (ME burst fire, double tap), by group. */
  special?: Record<string, { property: string, build: (card: SheetCard, weapon: WeaponContext, augments: AttackAugments, sheet: Sheet) => SheetCard | null }>
}

export interface WeaponMode {
  dc?: Rec
  hitBonus?: number
  damageType?: string
  damageMultiplier?: number
  addDamage?: Rec[]
}

export interface AttackAugments {
  hit: number
  damage: number
  dc: number
  range: number
  reroll: number
  crit: number
  dieIncrease: number
  addCritDie: number
  notes: unknown[]
  /** Extra damage rolls on a hit (`addDamage`), merged into every damage roll of the attack. */
  addDamage: Rec[]
}

export interface RulesOptions {
  /** The game's rules (handlers, tables, hooks). */
  rules: GameRules
}

export type { Character }
