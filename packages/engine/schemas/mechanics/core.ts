import { z } from 'zod'
import { Id } from '../primitives'
import { defineMechanic, type MechanicDefinition } from './registry'

/**
 * Core 5e mechanics shared by every game. Field lists come from the ME5e data
 * as it exists today (surveyed 2026-10-24); game-only effects live in the game's
 * own registry under its namespace.
 */

const flagOnly = (type: string, description: string) => defineMechanic({ type, description, fields: () => ({}) })

const actionLike = (type: string, description: string) => defineMechanic({
  type,
  description,
  fields: k => ({
    ...k.action,
    /** Weapon this attack counts as (`attack` mechanics). */
    modelType: z.strictObject({ model: z.string(), type: z.string() }).optional(),
  }),
})

export const coreMechanics: MechanicDefinition[] = [
  // --- actions ---
  actionLike('action', 'An action the character can take'),
  actionLike('bonus-action', 'A bonus action'),
  actionLike('reaction', 'A reaction'),
  actionLike('other', 'Any other usable or toggled feature'),
  actionLike('attack', 'An attack that is not a weapon or power (unarmed, omni-shield...)'),
  defineMechanic({
    type: 'global-note',
    description: 'A note shown on the sheet (defenses, actions, powers)',
    fields: k => ({
      value: z.string(),
      subType: z.string().optional(),
      moreInfo: k.MoreInfo.optional(),
      attack: z.enum(['melee', 'ranged']).optional(),
      progressionColumn: k.ProgressionColumn.optional(),
    }),
  }),

  // --- abilities ---
  defineMechanic({ type: 'asi', fields: k => ({ ability: k.Ability, amount: z.number().int() }) }),
  defineMechanic({ type: 'asi-choice', fields: k => ({ ...k.choice, amount: z.number().optional(), max: z.number().optional(), total: z.number().optional() }) }),
  defineMechanic({ type: 'asi-maximum', fields: k => ({ abilities: z.array(k.Ability), max: z.number().int() }) }),
  defineMechanic({ type: 'asi-minimum', fields: k => ({ ability: k.Ability, minimum: z.number().int() }) }),

  // --- defenses ---
  defineMechanic({ type: 'ac', fields: k => ({ bonus: k.Formula, condition: z.string().optional(), limit: z.array(k.e('armorTypes')).optional() }) }),
  defineMechanic({ type: 'natural-armor', fields: k => ({ base: z.number().int(), mod: k.Ability }) }),
  defineMechanic({ type: 'hp', fields: k => ({ bonus: k.Formula }) }),
  defineMechanic({ type: 'resistance', fields: k => ({ value: k.e('damageTypes'), note: z.string().optional(), label: z.string().optional() }) }),
  defineMechanic({ type: 'vulnerability', fields: k => ({ value: k.e('damageTypes') }) }),
  defineMechanic({ type: 'immunity', fields: k => ({ value: k.e('damageTypes').optional(), id: z.string().optional(), label: z.string().optional() }) }),
  defineMechanic({ type: 'condition-immunity', fields: () => ({ value: Id, note: z.string().optional() }) }),
  defineMechanic({
    type: 'saving-throw',
    fields: k => ({
      value: k.OneOrMany(k.Ability).optional(),
      against: k.OneOrMany(Id).optional(),
      /** No effect = proficiency in these saves. */
      effect: z.strictObject({ type: k.e('advantageEffects'), bonus: k.Formula.optional(), note: z.string().optional() }).optional(),
      note: z.string().optional(),
      valueLookup: z.strictObject({ model: z.string(), id: Id, limit: z.array(z.string()).optional() }).optional(),
    }),
  }),
  defineMechanic({
    type: 'fall-damage',
    description: 'Halves falling damage, or reduces it by dice and/or a formula',
    fields: k => ({
      resistance: z.boolean().optional(),
      reduce: z.strictObject({ dieCount: z.number().int().positive().optional(), dieType: z.number().int().positive().optional(), bonus: k.Formula.optional() }).optional(),
      note: z.string().optional(),
    }),
  }),
  defineMechanic({ type: 'regain-all-hit-dice', fields: () => ({}) }),
  defineMechanic({ type: 'min-hit-die-roll', fields: k => ({ bonus: k.Formula }) }),
  defineMechanic({ type: 'nullify-armor-str-restriction', fields: () => ({}) }),

  // --- movement and senses ---
  defineMechanic({ type: 'speed', fields: k => ({ speed: k.e('speeds'), distance: z.number().nonnegative(), note: z.string().optional() }) }),
  defineMechanic({
    type: 'speed-bonus',
    fields: k => ({
      value: z.array(k.e('speeds')),
      bonus: k.Formula.optional(),
      /** Conditional bonus (only if the speed exists), with a fallback. */
      ifExists: z.strictObject({ bonus: k.Formula }).optional(),
      else: z.strictObject({ bonus: k.Formula }).optional(),
    }),
  }),
  defineMechanic({ type: 'speed-note', fields: () => ({ note: z.string() }) }),
  // No distance = range set by the note ("truesight until your Search action resolves").
  defineMechanic({ type: 'sense', fields: k => ({ sense: k.OneOrMany(k.e('senses')), distance: z.number().nonnegative().optional(), note: z.string().optional() }) }),
  defineMechanic({
    type: 'initiative',
    fields: k => ({
      effect: z.union([
        z.literal('bonus'),
        z.strictObject({ type: k.e('advantageEffects'), bonus: k.Formula.optional(), value: k.Formula.optional() }),
      ]).optional(),
      bonus: k.Formula.optional(),
    }),
  }),

  // --- proficiencies ---
  defineMechanic({ type: 'skill', fields: k => ({ ...k.choice, value: Id.optional(), expertise: z.boolean().optional() }) }),
  defineMechanic({ type: 'skill-choice', fields: k => ({ ...k.choice }) }),
  defineMechanic({ type: 'skill-or-expertise', fields: () => ({ value: z.array(Id) }) }),
  defineMechanic({ type: 'expertise-choice', fields: k => ({ ...k.choice }) }),
  defineMechanic({ type: 'prof-choice', fields: k => ({ ...k.choice }) }),
  defineMechanic({ type: 'half-proficiency', fields: () => ({}) }),
  defineMechanic({
    type: 'skill-check',
    fields: k => ({
      value: k.OneOrMany(z.string()).optional(),
      effect: z.strictObject({
        type: z.union([k.e('advantageEffects'), z.strictObject({ bonus: k.Formula })]).nullable(),
        bonus: k.Formula.optional(),
        dieType: z.number().optional(),
        note: z.string().optional(),
      }).optional(),
      note: z.string().optional(),
      valueLookup: z.strictObject({ model: z.string(), id: Id, limit: z.array(z.string()).optional() }).optional(),
    }),
  }),
  defineMechanic({ type: 'passive', fields: k => ({ value: z.array(Id), bonus: k.Formula }) }),
  defineMechanic({ type: 'tool', fields: () => ({ value: Id }) }),
  defineMechanic({ type: 'tool-choice', fields: k => ({ ...k.choice }) }),
  defineMechanic({ type: 'armor', fields: k => ({ value: k.e('armorTypes') }) }),
  defineMechanic({ type: 'weapon', fields: k => ({ value: k.e('weaponTypes') }) }),
  defineMechanic({ type: 'weapon-choice', fields: k => ({ ...k.choice }) }),

  // --- combat ---
  defineMechanic({ type: 'extra-attack', fields: () => ({ value: z.number().int().min(2) }) }),
  flagOnly('extra-attack-add', 'One more attack when taking the Attack action (feat)'),
  flagOnly('dual-wielder', 'Dual Wielder feat'),
  defineMechanic({
    type: 'attack-augment',
    description: 'Bonus to hit, damage, DC or range of matching attacks',
    fields: k => ({
      attackLimit: z.strictObject({
        model: z.enum(['weapon', 'power']).optional(),
        models: z.array(z.enum(['weapon', 'power'])).optional(),
        modelTypes: z.array(z.string()).optional(),
        weaponTypes: z.array(z.string()).optional(),
        type: z.enum(['melee', 'ranged']).optional(),
        special: z.string().optional(),
      }).optional(), // absent = every attack
      augmentTypes: z.array(z.enum(['hit', 'damage', 'dc', 'notes', 'range'])),
      bonus: k.Formula.optional(),
      rerollIfLessThan: z.number().int().optional(),
      crit: z.number().int().optional(),
      dieIncrease: z.number().int().optional(),
      addCritDie: z.number().int().optional(),
      abilityMod: z.boolean().optional(),
      notes: z.array(k.Note).optional(),
    }),
  }),
  defineMechanic({
    type: 'adjust-weapon-props',
    fields: () => ({ add: z.array(Id).optional(), remove: z.array(Id).optional(), limit: z.array(z.string()).optional() }),
  }),
  defineMechanic({ type: 'override-weapon-attack-mod', fields: k => ({ klass: Id, mod: z.union([k.Ability, z.literal('pc')]) }) }),
  defineMechanic({
    type: 'natural-weapon',
    fields: k => ({
      value: z.strictObject({
        name: z.string().optional(),
        type: z.enum(['natural-melee', 'natural-ranged']),
        damage: k.Damage,
        range: k.Range,
        properties: z.array(Id).optional(),
        notes: z.array(k.Note).optional(),
        moreInfo: k.MoreInfo.optional(),
        html: z.string().optional(),
        versatile: k.Damage.optional(),
        damageModOverride: z.string().optional(),
        noMod: z.boolean().optional(),
      }),
      replacesUnarmedStrike: z.boolean().optional(),
    }),
  }),
  flagOnly('companion', 'Grants a companion creature'),

  // --- resources and composition ---
  defineMechanic({ type: 'resource', description: 'Sets or adds to a tracked resource', fields: k => ({ id: z.string(), method: z.enum(['set', 'add']), value: k.Formula }) }),
  defineMechanic({
    type: 'augment',
    description: 'Deep-merges `merge` into another mechanic, found by its source',
    fields: () => ({
      value: z.strictObject({
        model: z.string(),
        id: Id,
        limit: z.union([z.string(), z.array(z.string())]).optional(),
        instances: z.array(z.number().int().nonnegative()).optional(),
      }),
      merge: z.looseObject({}),
      limit: z.array(z.string()).optional(),
    }),
  }),
  defineMechanic({
    type: 'model-choice',
    description: 'Pick records from a collection (or an edge family)',
    fields: k => ({
      ...k.choice,
      model: z.string(),
      limits: z.array(z.strictObject({ attr: z.string(), value: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]) })).optional(),
      set: z.array(Id).optional(),
      hide: z.boolean().optional(),
      known: z.boolean().optional(),
      isolated: z.boolean().optional(),
      append: z.looseObject({}).optional(),
      progressionColumn: k.ProgressionColumn.optional(),
    }),
  }),

  // --- power system (shared by every powercasting game) ---
  defineMechanic({
    type: 'powers',
    description: 'Grants a specific power',
    fields: k => ({
      value: Id,
      klass: Id.optional(),
      castAt: z.number().int().optional(),
      mod: k.Ability.optional(),
      alwaysCastable: z.boolean().optional(),
      provider: z.strictObject({ model: z.string(), id: Id }).optional(),
      resource: k.Resource.optional(),
      merge: z.looseObject({}).optional(),
    }),
  }),
  defineMechanic({ type: 'cantrips', fields: () => ({ known: z.array(z.number().int()).length(20), columnName: z.string().optional() }) }),
  defineMechanic({ type: 'additional-cantrips', fields: k => ({ bonus: k.Formula }) }),
  defineMechanic({ type: 'use-class-for-power-list', fields: () => ({ klass: Id }) }),
  defineMechanic({ type: 'use-class-for-cantrip-list', fields: () => ({ klass: Id }) }),
  defineMechanic({
    type: 'power-resource-recovery',
    description: 'Recover slots or points (Arcane Recovery style)',
    fields: k => ({
      dieCount: z.number().int().optional(),
      dieType: z.number().int().optional(),
      bonus: k.Formula.optional(),
      label: z.string().optional(),
      limit: z.enum(['slots', 'points']).optional(),
      maxSlot: z.number().int().optional(),
    }),
  }),
]
