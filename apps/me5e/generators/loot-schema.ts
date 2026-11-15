import { flag, Id, type MechanicKit } from '@omnibrew/engine/schemas'
import { z } from 'zod'

/**
 * The loot generator's tables (content `loot-tables` and `loot-rewards`), as ME5e
 * collections: the Discord mods edit them in the content repo, the validator checks
 * them, and the generator reads them from the rules bundle.
 *
 * - `loot-tables/<id>.md`: an equipment table (A to H), a d100 table whose rows give
 *   an item of a rarity or a number of consumables.
 * - `loot-rewards/<id>.md`: one challenge rating band: the credits one creature
 *   carries, and a hoard (credits plus a d100 roll on the equipment tables).
 */

/** Dice as written in a table: `1d6`. */
export const DICE = /^[1-9]\d*d[1-9]\d*$/

/** What d100 rows must do: cover 1 to 100, each number once. Problems, in plain words. */
export function d100Problems(rows: readonly { min: number, max: number }[]): string[] {
  const problems: string[] = []
  const sorted = [...rows].sort((a, b) => a.min - b.min || a.max - b.max)
  let next = 1
  for (const row of sorted) {
    if (row.min > row.max) problems.push(`${row.min}-${row.max} ends before it starts`)
    else if (row.min > next) problems.push(`nothing on ${next === row.min - 1 ? next : `${next}-${row.min - 1}`}`)
    else if (row.min < next) problems.push(`${row.min}-${row.max} overlaps the row before it`)
    next = Math.max(next, row.max + 1)
  }
  if (next <= 100) problems.push(`nothing on ${next === 100 ? 100 : `${next}-100`}`)
  if (next > 101) problems.push('a row goes past 100')
  return problems
}

const d100 = { min: z.number().int().min(1).max(100), max: z.number().int().min(1).max(100) }

function d100Rows<T extends z.ZodType<{ min: number, max: number }>>(row: T) {
  return z.array(row).min(1).superRefine((rows, ctx) => {
    for (const problem of d100Problems(rows)) flag(ctx, 'error', `d100 rows: ${problem}`, [], 'd100-ranges')
  })
}

/** The kinds of item a table row can give. */
export const LOOT_ITEM_KINDS = ['weapons', 'armor', 'mods', 'gear'] as const

export const lootTableShape = (k: MechanicKit) => ({
  id: Id,
  body: z.string().optional(),
  name: z.string(),
  rows: d100Rows(z.union([
    // One random item of this rarity from the collection.
    z.strictObject({ ...d100, item: z.enum(LOOT_ITEM_KINDS), rarity: k.e('rarities') }),
    // `count` (dice) plus `bonus` of a consumable: a gear record or one of its subsets (`medi-gel-standard`).
    z.strictObject({ ...d100, consumable: Id, count: z.string().regex(DICE, 'dice like 1d4'), bonus: z.number().int().positive().optional() }),
  ])),
})

export const lootRewardShape = () => ({
  id: Id,
  body: z.string().optional(),
  /** The band as the generator lists it: `0-4`. */
  name: z.string(),
  /** Position in the list. */
  order: z.number().int(),
  /** Credits one creature carries: one value at random. */
  individual: z.array(z.number().int().nonnegative()).min(1),
  hoard: z.strictObject({
    credits: z.number().int().nonnegative(),
    /** Added to `credits`: one value at random. */
    additionalCredits: z.array(z.number().int().nonnegative()).min(1),
    /** A d100 roll: nothing more, or rolls on an equipment table (`times`: a number or dice, once if left out). */
    rolls: d100Rows(z.strictObject({
      ...d100,
      table: Id.optional(),
      times: z.union([z.number().int().positive(), z.string().regex(DICE, 'dice like 1d6')]).optional(),
    }).refine(r => r.table || r.times === undefined, { message: '`times` needs a `table`', path: ['times'] })),
  }),
})
