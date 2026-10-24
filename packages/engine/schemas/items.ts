import { z } from 'zod'
import type { MechanicKit } from './mechanics/registry'
import { Id } from './primitives'

/**
 * Items are one discriminated union on `kind`. Core kinds are weapon, armor
 * and gear; a game adds its own (ME `mod`, later SW `enhanced`).
 *
 * Armor is itself a union on `coverage`:
 * - `suit`: one piece covers the body (5e, SW5e, ME "body armor"); may set a base AC.
 * - `piece`: ME piecewise armor: one slot (head/chest/arms/legs) adding bonuses.
 */

/** A property reference with an optional value: `{ id: 'reload', value: 16 }`, `{ id: 'versatile', value: { dieCount: 1, dieType: 10 } }`. */
export function propertyRef(k: MechanicKit) {
  return z.strictObject({
    id: Id,
    value: z.union([z.number(), z.string(), k.Damage, k.Range]).optional(),
  })
}

export function itemBase(k: MechanicKit) {
  return {
    name: z.string(),
    cost: z.union([z.number().nonnegative(), z.string()]).optional(),
    weight: z.number().nonnegative().optional(),
    rarity: k.e('rarities').optional(),
    image: z.string().optional(),
    flavor: z.string().optional(),
    manufacturer: z.string().optional(),
    author: z.string().optional(),
    homebrew: z.boolean().optional(),
    tags: z.array(k.e('itemTags')).optional(),
    mechanics: k.mechanics.optional(),
  }
}

export function weaponFields(k: MechanicKit) {
  return {
    kind: z.literal('weapon'),
    weaponType: k.e('weaponTypes'),
    damage: k.Damage.required({ dieCount: true, dieType: true, type: true }),
    /** Extra damage dice always added (ME stun baton). */
    additionalDamage: z.array(k.Damage).optional(),
    properties: z.array(propertyRef(k)),
    range: z.strictObject({ short: z.number().nonnegative(), long: z.number().nonnegative().optional() }),
  }
}

export function armorFields(k: MechanicKit) {
  const common = {
    kind: z.literal('armor'),
    armorType: k.e('armorTypes'),
    properties: z.array(propertyRef(k)).optional(),
    /** Set-bonus id (ME armor sets). */
    set: Id.optional(),
    stealthDisadvantage: z.boolean().optional(),
  }
  return {
    suit: {
      ...common,
      coverage: z.literal('suit'),
      ac: z.strictObject({ base: z.number().int(), addDex: z.boolean().optional(), maxDex: z.number().int().optional() }).optional(),
    },
    piece: {
      ...common,
      coverage: z.literal('piece'),
      slot: k.e('armorSlots'),
    },
  }
}

export function gearFields(k: MechanicKit) {
  return {
    kind: z.literal('gear'),
    gearType: k.e('gearTypes'),
    subType: z.string().optional(),
    consumable: z.boolean().optional(),
    equippable: z.boolean().optional(),
    installation: z.boolean().optional(),
    charges: z.number().int().optional(),
  }
}
