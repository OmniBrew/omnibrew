import { z } from 'zod'
import { defineMechanic, forwardIssues, type MechanicDefinition, type MechanicKit } from './mechanics/registry'
import type { Primitives } from './primitives'
import { flag, Id, mergeDeep } from './primitives'

/**
 * Power system: how a game's powers (spells) are cast and paid for.
 *
 * - ME5e: power levels 0–5, one slot pool (biotic/combat) plus tech points.
 * - SW5e: power levels 0–9, force points and tech points, force casting ability
 *   chosen by the power's alignment, 6th+ level powers once per long rest.
 *
 * Both shapes fit `PowerSystemConfig`; nothing below checks which game it is.
 */
export interface PowerPool {
  /** e.g. `slots`, `points:tech`, `points:force` */
  id: string
  kind: 'slots' | 'points' | 'pact'
  /** Power types paid from this pool. */
  powerTypes: string[]
}

export interface PowerSystemConfig {
  maxLevel: number
  pools: PowerPool[]
  /** Extra fields on power records (SW `alignment`, ME `advancements`). */
  powerFields?: (k: MechanicKit) => z.ZodRawShape
  /** Extra fields on casting entries (ME `primes`, `detonates`). */
  castingFields?: (k: MechanicKit) => z.ZodRawShape
}

/** Which ability powers a caster: fixed, the player's choice, or by the power's alignment. */
function castingAbility(p: Primitives) {
  return z.union([
    p.Ability,
    z.array(p.Ability).min(1),
    z.strictObject({ byAlignment: z.record(z.string(), z.union([p.Ability, z.array(p.Ability).min(1)])) }),
  ])
}

const perLevel = (s: z.ZodType = z.number().int().nonnegative()) => z.array(s).length(20, 'needs one value per character level (20)')

export function powerSystemMechanics(config: PowerSystemConfig): MechanicDefinition[] {
  const poolIds = config.pools.map(p => p.id) as [string, ...string[]]
  const pool = poolIds.length ? z.enum(poolIds) : z.string()
  const prepared = z.union([z.literal(false), z.strictObject({ levelMultiplier: z.number(), modBonus: z.boolean().optional() })])
  const limitedLevels = z.strictObject({ from: z.number().int().min(1).max(config.maxLevel), uses: z.number().int().positive(), reset: z.enum(['short', 'long']) })
  return [
    defineMechanic({
      type: 'powercasting-slots',
      fields: k => ({
        pool: pool.optional(),
        mod: castingAbility(k),
        known: z.union([perLevel(), z.literal(false)]),
        prepared: prepared.optional(),
        slots: z.record(z.string().regex(/^\d+$/), perLevel()).superRefine((slots, ctx) => {
          for (const lvl of Object.keys(slots)) {
            if (Number(lvl) < 1 || Number(lvl) > config.maxLevel) flag(ctx, 'error', `slot level ${lvl} is outside 1–${config.maxLevel}`, [lvl], 'power-level-range')
          }
        }),
        multiclassConversion: z.number().nonnegative(),
        options: z.literal(true).optional(),
        limitedLevels: limitedLevels.optional(),
      }),
    }),
    defineMechanic({
      type: 'powercasting-points',
      fields: k => ({
        pool: pool.optional(),
        mod: castingAbility(k),
        known: z.union([perLevel(), z.literal(false)]),
        prepared: prepared.optional(),
        points: perLevel(),
        /** Most points one casting may spend, per character level (ME "tech point limit"). */
        limit: perLevel().optional(),
        /** Highest power level castable, per character level (SW "max power level"). */
        maxPowerLevel: perLevel(z.number().int().min(0).max(config.maxLevel)).optional(),
        multiclassConversion: z.number().nonnegative(),
        options: z.literal(true).optional(),
        limitedLevels: limitedLevels.optional(),
      }),
    }),
    defineMechanic({
      type: 'powercasting-pact',
      fields: k => ({
        pool: pool.optional(),
        mod: castingAbility(k),
        known: perLevel(),
        numSlots: perLevel(),
        slotLevel: perLevel(z.number().int().min(1).max(config.maxLevel)),
        multiclassConversion: z.number().nonnegative(),
        options: z.literal(true).optional(),
      }),
    }),
  ]
}

/** A casting entry: index 0 is the base power, later entries are upcast deltas. */
export function castingEntry(k: MechanicKit, config: PowerSystemConfig) {
  return z.strictObject({
    castingTime: k.CastingTime,
    altCasting: z.array(k.CastingTime).optional(),
    duration: k.Duration,
    concentration: z.boolean(),
    range: k.Range,
    attack: z.union([k.Attack, z.literal(false)]).optional(),
    dc: z.union([k.Dc, z.literal(false)]).optional(),
    damage: z.union([z.array(k.Damage), z.literal(false)]).optional(),
    conditions: z.union([z.array(Id), z.literal(false)]).optional(),
    notes: z.array(k.Note).optional(),
    resource: k.Resource.optional(),
    shortDesc: z.string().optional(),
    moreInfo: k.MoreInfo.optional(),
    merge: z.looseObject({}).optional(),
    ...config.castingFields?.(k),
  })
}

/**
 * Casting entries: the first is the whole power; each later one is an upcast
 * delta deep-merged onto the first (lodash `merge`, as the legacy site does), so
 * `- damage: [{}, { dieCount: 3 }]` changes only the second damage roll. Deltas
 * are checked as merged, and only issues inside keys the delta sets are reported.
 */
function castingList(entry: z.ZodType, config: PowerSystemConfig) {
  return z.array(z.looseObject({})).min(1).superRefine((entries, ctx) => {
    const [base, ...deltas] = entries as Record<string, unknown>[]
    const first = entry.safeParse(base)
    if (!first.success) forwardIssues(first.error.issues, ctx, [0])
    deltas.forEach((delta, i) => {
      const merged = entry.safeParse(mergeDeep(base, delta))
      if (merged.success) return
      const own = merged.error.issues.filter(iss => typeof iss.path[0] === 'string' && iss.path[0] in delta)
      forwardIssues(own, ctx, [i + 1])
    })
    if (entries.length > config.maxLevel + 1) flag(ctx, 'error', `more casting entries (${entries.length}) than power levels`, [], 'power-upcast-count')
  })
}

export function powerSchema(k: MechanicKit, config: PowerSystemConfig) {
  const entry = castingEntry(k, config)
  return {
    level: z.number().int().min(0).max(config.maxLevel),
    powerType: k.e('powerTypes'),
    classes: z.array(Id).optional(),
    tags: z.array(k.e('powerTags')).optional(),
    prerequisite: z.string().optional(),
    version: z.number().int().optional(),
    reactionQualifier: z.union([z.string(), z.literal(false)]).optional(),
    casting: castingList(entry, config),
    ...config.powerFields?.(k),
  }
}
