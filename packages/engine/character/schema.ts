import { z } from 'zod'
import { Id } from '../schemas/primitives'

/**
 * The character model: what a player saved, never what the rules compute
 * (`rules/` turns a character plus content into a sheet).
 *
 * Game-neutral: every choice points at content by record id, and a choice is
 * stored under the path of the mechanic that offered it (`class/adept/4/asi`,
 * `species/asari/traits/asi/asi`, `background/artisan/subgrounds`). The parts
 * only one game has (ME reputation, shields, thermal clips) are `game` objects
 * whose shapes come from the game definition (`GameDefinition.character`).
 *
 * `version` is the model version. Later changes add a step to `MIGRATIONS`
 * (`migrations.ts`), so a saved character is always read at the current version.
 */
export const CHARACTER_VERSION = 1

export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

/** Shapes a game adds to a character (`GameDefinition.character`). */
export interface CharacterExtension {
  /** Live play state: ME paragon/renegade, shields lost, barrier used... */
  state?: () => z.ZodRawShape
  /** Optional rules a player turns on or off. */
  options?: () => z.ZodRawShape
  /** Values a player typed over the computed ones. */
  overrides?: () => z.ZodRawShape
}

const int = () => z.number().int()
const score = () => z.number().int().nullable()
const abilityRecord = <T extends z.ZodType>(v: T) => z.strictObject(Object.fromEntries(ABILITY_KEYS.map(a => [a, v])) as Record<(typeof ABILITY_KEYS)[number], T>)

/** One pick of a choice: a record id (or skill, tool, weapon type, ability), an ability increase, or a power advancement. */
export const ChoiceValue = z.union([
  z.string().min(1),
  z.strictObject({ ability: z.string(), amount: int() }),
  z.strictObject({ power: Id, advancement: Id }),
])
export type ChoiceValue = z.infer<typeof ChoiceValue>

export const Choice = z.strictObject({
  /** `<source path>/<choice key>`: the key is the mechanic type without namespace and `-choice`, or a model-choice's model. */
  path: z.string().min(1),
  /** Two choices on one path differ by their `limits` (serialized), as on the live site. */
  limit: z.string().optional(),
  values: z.array(ChoiceValue),
})
export type Choice = z.infer<typeof Choice>

export const ClassEntry = z.strictObject({
  id: Id,
  levels: int().min(1).max(20),
  subclass: Id.nullable(),
  /** Hit points gained at each level of this class (index 0 = its first level). */
  hitPoints: z.array(int().nonnegative()),
  /** The player rolled (or typed) hit points instead of taking the average. */
  rolledHitPoints: z.boolean(),
  /** Per ability-score-improvement level of the class: an ability increase or a feat, unpicked = null. */
  asi: z.record(z.string().regex(/^\d+$/), z.enum(['asi', 'feat']).nullable()),
})
export type ClassEntry = z.infer<typeof ClassEntry>

export const LearnedPower = z.strictObject({
  id: Id,
  /** Class whose list and casting ability the power uses; null for a power learned without one (older live characters). */
  class: Id.nullable(),
  advancement: Id.nullable(),
})
export type LearnedPower = z.infer<typeof LearnedPower>

export const EquipmentEntry = z.strictObject({
  /** Unique per owned item: resources and toggles of the item are keyed by it. */
  uuid: z.string().min(1),
  id: Id,
  kind: z.string(),
  equipped: z.boolean(),
  /** Installed item mods; `slot` names the weapon mod slot (barrel, grip...). */
  mods: z.array(z.strictObject({ id: Id, slot: z.string().optional() })).optional(),
  /** Weapon stats typed over the record's. */
  overrides: z.looseObject({}).optional(),
  bonusHit: int().optional(),
  bonusDamage: int().optional(),
  /** Charges or count (consumables). */
  uses: z.number().optional(),
  /** How many of `uses` are carried ready (thermal clips). */
  equippedAmount: z.number().optional(),
  notes: z.string().optional(),
  /** A custom item that is not a content record (the live site's custom armor). */
  custom: z.looseObject({}).optional(),
})
export type EquipmentEntry = z.infer<typeof EquipmentEntry>

/** A feature the player wrote on the sheet. */
export const CustomFeature = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  type: z.string(),
  /** HTML, as the old sheet's editor wrote it. */
  html: z.string().optional(),
  uses: int().nonnegative().optional(),
  recharge: z.string().optional(),
})

const defenseOverrides = z.strictObject({
  resistance: z.array(z.string()),
  immunity: z.array(z.string()),
  vulnerability: z.array(z.string()),
  conditionImmunity: z.array(z.string()),
})

const rollOverrides = z.strictObject({ all: int(), melee: int(), ranged: int(), power: int() })

export function characterSchema(ext: CharacterExtension = {}) {
  return z.strictObject({
    version: z.literal(CHARACTER_VERSION),
    /** Game id (`me5e`). */
    game: z.string(),
    name: z.string(),
    image: z.string().optional(),
    experience: z.strictObject({ points: int().nonnegative(), milestone: int().nonnegative(), useMilestone: z.boolean() }),
    /** Species, variant or subspecies id, or a built-in species of the game (`custom`). */
    species: Id.nullable(),
    background: Id.nullable(),
    classes: z.array(ClassEntry),
    abilityScores: z.strictObject({
      method: z.enum(['standard', 'buy', 'manual']),
      base: abilityRecord(score()),
      /** Bonus typed on the sheet. */
      bonus: abilityRecord(score()),
      override: abilityRecord(score()),
    }),
    choices: z.array(Choice),
    powers: z.array(LearnedPower),
    equipment: z.array(EquipmentEntry),
    /** Companions are free-form stat blocks the player fills in. */
    companions: z.array(z.looseObject({})),
    customFeatures: z.array(CustomFeature),
    details: z.strictObject({
      characteristics: z.record(z.string(), z.string()),
      notes: z.string(),
    }),
    state: z.strictObject({
      hitPointsLost: int(),
      tempHp: z.strictObject({ max: int(), value: int() }),
      hitDiceUsed: z.record(z.string(), int()),
      deathSaves: z.strictObject({ successes: int(), failures: int() }),
      inspiration: z.boolean(),
      conditions: z.array(z.string()),
      exhaustion: int(),
      credits: z.number(),
      /** Points spent per pool (`points:tech`). */
      pointsUsed: z.record(z.string(), int()),
      /** Slots spent per power level (`"1"`..). */
      slotsUsed: z.record(z.string(), int()),
      /** Uses spent (or charges, counters) per resource id. */
      resources: z.record(z.string(), z.number()),
      /** On/off per toggle id; `<id>-selection` holds a toggle's picked option. */
      toggles: z.record(z.string(), z.union([z.boolean(), z.string()])),
      game: z.strictObject(ext.state?.() ?? {}),
    }),
    overrides: z.strictObject({
      hp: int().nullable(),
      ac: int().nullable(),
      acBonus: int(),
      speeds: z.record(z.string(), z.number()),
      senses: z.record(z.string(), z.number()),
      attack: rollOverrides,
      damage: rollOverrides,
      defenses: defenseOverrides,
      profs: z.strictObject({
        skill: z.array(z.string()),
        expertise: z.array(z.string()),
        savingThrow: z.array(z.string()),
        armor: z.array(z.string()),
        weapon: z.array(z.string()),
        tool: z.array(z.string()),
      }),
      /** Casting ability per class id. */
      powercasting: z.record(z.string(), z.string()),
      game: z.strictObject(ext.overrides?.() ?? {}),
    }),
    options: z.strictObject({
      /** Tasha's "customizing your origin": species ability increases become free picks. */
      tashas: z.boolean(),
      armorSpeedPenalty: z.boolean(),
      armorProficiencyPenalty: z.boolean(),
      abilityScoreOnTop: z.boolean(),
      game: z.strictObject(ext.options?.() ?? {}),
    }),
    meta: z.strictObject({
      /** Where the character came from (`me5e-legacy 1.0.2`), for migrated ones. */
      migratedFrom: z.string().optional(),
    }),
  })
}

export type Character = z.infer<ReturnType<typeof characterSchema>>
