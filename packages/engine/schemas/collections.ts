import { z } from 'zod'
import { armorFields, gearFields, itemBase, weaponFields } from './items'
import type { MechanicKit } from './mechanics/registry'
import { powerSchema, type PowerSystemConfig } from './power-system'
import { Id, orNone } from './primitives'

/**
 * Core collection shapes. Every record also gets `id` (the file name) and
 * `body` (markdown) from the loader. A game adds fields per collection with
 * `GameDefinition.fields`, and whole collections with `GameDefinition.collections`.
 */
export type ShapeFn = (k: MechanicKit) => z.ZodRawShape

const record = {
  id: Id,
  body: z.string().optional(),
}
const authored = {
  author: z.string().optional(),
  homebrew: z.boolean().optional(),
}

function prof() {
  return z.strictObject({
    has: z.array(z.string()).optional(),
    choices: z.strictObject({ count: z.number().int().positive(), items: z.array(z.string()) }).optional(),
    text: z.string().optional(),
  })
}

export function coreCollections(power: PowerSystemConfig): Record<string, ShapeFn> {
  return {
    'powers': k => ({ ...record, ...authored, name: z.string(), ...powerSchema(k, power) }),

    'classes': k => ({
      ...record,
      ...authored,
      name: z.string(),
      snippet: z.string().optional(),
      hitDie: z.literal([6, 8, 10, 12]),
      primaryAbility: z.array(k.Ability).min(1),
      profs: z.strictObject({
        'armor': orNone(prof()).optional(),
        'weapon': orNone(prof()).optional(),
        'tool': orNone(prof()).optional(),
        'skill': prof(),
        'saving-throw': prof(),
      }),
      startingEquipment: z.array(z.strictObject({
        has: z.array(Id).optional(),
        choices: z.strictObject({ count: z.number().int().positive(), items: z.array(Id) }).optional(),
        text: z.string().optional(),
      })),
      startingWealth: z.strictObject({ text: z.string().optional(), value: z.string() }).optional(),
      subclassLabel: z.string().optional(),
      progression: z.strictObject({
        subclass: z.array(z.number().int().min(1).max(20)),
        abi: z.array(z.number().int().min(1).max(20)),
        columns: z.array(z.strictObject({
          label: z.string(),
          values: z.array(z.union([z.number(), z.string(), z.array(z.number())])).optional(),
        })).optional(),
      }),
    }),

    'subclasses': () => ({ ...record, ...authored, name: z.string(), klass: Id }),

    'class-features': k => ({
      ...record,
      name: z.string(),
      klass: Id,
      subclass: Id.optional(),
      level: z.number().int().min(1).max(20),
      mechanics: k.mechanics.optional(),
      noFeatureDisplay: z.boolean().optional(),
    }),

    'species': k => ({
      ...record,
      ...authored,
      name: z.string(),
      /** Variants and subspecies point at their parent with `species`. */
      type: z.enum(['variant', 'subspecies']).optional(),
      species: Id.optional(),
      subspecies: Id.optional(),
      mechanics: k.mechanics.optional(),
      img: z.string().optional(),
      snippet: z.string().optional(),
      age: z.string().optional(),
      alignment: z.string().optional(),
      size: z.string().optional(),
      speedColor: z.string().optional(),
      homeworld: z.string().optional(),
      language: z.string().optional(),
      abilityScoreIncrease: z.string().optional(),
      randomDimensions: z.partialRecord(z.enum(['height', 'weight', 'length']), z.strictObject({
        base: z.strictObject({ imperial: z.number(), metric: z.number() }),
        mod: z.strictObject({
          imperial: k.Dice,
          metric: k.Dice.extend({ divisor: z.number().optional() }),
        }),
      })).optional(),
    }),

    'subspecies': () => ({ ...record, name: z.string(), species: Id.optional() }),

    'traits': k => ({ ...record, name: z.string(), species: z.array(Id).min(1), mechanics: k.mechanics }),

    'backgrounds': k => ({ ...record, name: z.string(), mechanics: k.mechanics, startingCredits: z.number().int().nonnegative().optional() }),

    'feats': k => ({
      ...record,
      name: z.string(),
      note: z.string().optional(),
      prerequisite: z.string().optional(),
      prereq: z.array(z.strictObject({
        type: z.enum(['species', 'mod', 'ability', 'proficiency', 'power']),
        limit: z.array(z.string()).optional(),
        value: z.number().optional(),
      })).optional(),
      new: z.boolean().optional(),
      mechanics: k.mechanics,
    }),

    'edges': k => ({ ...record, ...authored, name: z.string(), type: k.e('edgeTypes'), mechanics: k.mechanics }),

    'skills': k => ({ ...record, name: z.string(), link: k.Ability, is_new: z.boolean().optional() }),

    'tool-profs': k => ({ ...record, name: z.string(), type: orNone(k.e('toolTypes')).optional() }),

    'weapon-properties': () => ({ ...record, name: z.string(), is_new: z.boolean().optional(), takesValue: z.boolean().optional() }),
    'armor-properties': () => ({ ...record, name: z.string(), takesValue: z.boolean().optional() }),

    'weapons': k => ({ ...record, ...itemBase(k), ...weaponFields(k) }),
    'armor': k => ({ ...record, ...itemBase(k), ...armorFields(k).suit }),
    'gear': k => ({
      ...record,
      ...itemBase(k),
      ...gearFields(k),
      marks: z.array(z.strictObject({ mark: z.string(), rarity: z.string(), damage: z.string().optional(), dc: z.number().optional() })).optional(),
      subsets: z.array(z.strictObject({
        id: Id,
        name: z.string(),
        cost: z.union([z.number(), z.string()]).optional(),
        rarity: k.e('rarities').optional(),
        html: z.string().optional(),
        mechanics: k.mechanics.optional(),
      })).optional(),
    }),

    'set-bonuses': k => ({
      ...record,
      name: z.string().optional(),
      max: z.number().int().positive(),
      bonuses: z.array(z.strictObject({
        threshold: z.number().int().positive(),
        text: z.string(),
        mechanics: k.mechanics,
        showNote: z.boolean().optional(),
      })).min(1),
    }),

    'bestiary': k => {
      const entry = z.strictObject({
        id: Id.optional(),
        name: z.string().optional(),
        text: z.string().optional(),
        hit: z.string().optional(),
        miss: z.string().optional(),
        target: z.string().optional(),
        attack: z.enum(['melee', 'ranged']).optional(),
        mod: k.Ability.optional(),
        proficient: z.boolean().optional(),
        range: z.number().optional(),
        damage: orNone(z.array(k.Damage)).optional(),
        dc: orNone(k.Dc).optional(),
        save: orNone(k.Ability).optional(),
        recharge: z.union([z.literal('short'), z.literal('long'), z.array(z.string())]).optional(),
        perDay: z.union([z.boolean(), z.number(), z.string()]).optional(),
        uses: z.number().int().optional(),
        cost: z.number().int().optional(),
        ref: z.enum(['weapon', 'power']).optional(),
        weaponId: Id.optional(),
        casterLevel: z.union([z.number(), z.string()]).optional(),
        list: z.array(z.union([Id, z.strictObject({
          id: Id,
          level: z.number().int().optional(),
          mark: z.string().optional(),
          perDay: z.union([z.number(), z.string()]).optional(),
          uses: z.number().int().optional(),
        })])).optional(),
      })
      return {
        ...record,
        ...authored,
        name: z.string(),
        size: k.e('sizes'),
        type: k.e('creatureTypes'),
        alignment: k.e('alignments'),
        ac: z.number().int(),
        hp: k.Dice,
        speed: z.strictObject({ walk: z.number().optional(), fly: z.number().optional(), swim: z.number().optional(), climb: z.number().optional(), burrow: z.number().optional(), note: z.string().optional() }),
        abilityScores: z.strictObject(Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map(a => [a, z.number().int().min(1).max(30)]))),
        savingThrows: orNone(z.array(k.Ability)).optional(),
        skills: orNone(z.array(Id)).optional(),
        senses: orNone(k.keyedBy('senses', z.number())).optional(),
        irv: orNone(z.strictObject({
          res: z.array(k.e('damageTypes')).optional(),
          imm: z.array(k.e('damageTypes')).optional(),
          damImm: z.array(k.e('damageTypes')).optional(),
          vul: z.array(k.e('damageTypes')).optional(),
          conImm: z.array(Id).optional(),
        })).optional(),
        cr: z.string(),
        profBonus: z.number().int(),
        image: orNone(z.string()).optional(),
        entries: z.strictObject({
          features: z.array(entry).optional(),
          actions: z.array(entry).optional(),
          reactions: z.array(entry).optional(),
          legendary: z.strictObject({ text: z.string().optional(), actions: z.array(entry) }).optional(),
        }),
      }
    },

    'vehicles': k => ({
      ...record,
      name: z.string(),
      type: z.string(),
      subtype: orNone(z.string()).optional(),
      size: k.e('vehicleSizes'),
      ac: z.number().int(),
      hp: z.number().int(),
      speed: z.number(),
      crew: z.strictObject({ min: z.number().int(), max: z.union([z.number().int(), z.string()]) }),
      cargo: z.union([z.number(), z.string()]).optional(),
      cost: z.union([z.number(), z.string()]).optional(),
      cr: z.union([z.number(), z.string()]).optional(),
      range: z.strictObject({ distance: z.number(), units: z.string() }).optional(),
      image: z.string().optional(),
      createdBy: z.string().optional(),
      weapons: orNone(z.array(z.strictObject({ name: z.string(), damage: z.string() }))).optional(),
      systems: z.array(z.strictObject({
        type: z.string(),
        crew: z.union([z.number().int(), z.string()]),
        systems: z.array(z.string()).optional(),
      })).optional(),
    }),

    'actions': () => ({ ...record, name: z.string(), type: z.enum(['action', 'bonus_action', 'reaction']), shortDesc: z.string().optional() }),
    'conditions': () => ({ ...record, name: z.string(), children: z.string().optional() }),
    'manual': () => ({ ...record, title: z.string() }),
    'guide': () => ({ ...record, title: z.string() }),
    'changelog': () => ({
      ...record,
      title: z.string(),
      date: z.date({ error: 'not a valid date (YYYY-MM-DD)' }),
      description: z.string(),
      excerpt: z.string().optional(),
      image: z.string().optional(),
      layout: z.string().optional(),
    }),
    'attributions': () => ({ ...record, title: z.string(), attribution: z.string(), path: z.string(), source: z.string() }),
    'character-progression': () => ({ ...record, level: z.number().int().min(1).max(20), profBonus: z.number().int(), xp: z.number().int() }),
    'npc-stats': () => ({
      ...record,
      cr: z.string(),
      profBonus: z.number().int(),
      ac: z.number().int(),
      hp: z.number().int(),
      attack: z.number().int(),
      damage: z.number().int(),
      save: z.number().int(),
      dc: z.number().int(),
      xp: z.number().int(),
      normalized: z.number(),
    }),
  }
}

/** Armor is a union on `coverage`; the collection schema is built separately. */
export function armorSchema(k: MechanicKit, extra: z.ZodRawShape = {}) {
  const f = armorFields(k)
  const base = { ...record, ...itemBase(k), ...extra }
  return z.discriminatedUnion('coverage', [
    z.strictObject({ ...base, ...f.suit }),
    z.strictObject({ ...base, ...f.piece }),
  ])
}
