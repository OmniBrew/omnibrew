import { z } from 'zod'
import type { EnumRegistry } from './enums'

/** Content ids: file-name slugs. Legacy ME ids carry upper-case family prefixes (`BG_`, `PA_`, `EXL_`). */
export const Id = z.string().regex(/^[a-z\d][\w-]*$/i, 'not a valid id slug')

/** Legacy "none" markers (`dc: false`, `image: null`). Accepted; the migration should drop the key instead. */
export function orNone<T extends z.ZodType>(schema: T) {
  return z.union([schema, z.literal(false), z.null()])
}

/** Custom issue that the validator reports with an explicit severity. */
export function flag(ctx: z.RefinementCtx, severity: 'error' | 'warning' | 'info', message: string, path: (string | number)[] = [], rule?: string) {
  ctx.addIssue({ code: 'custom', message, path, params: { severity, rule } })
}

export const DIE_TYPES = [1, 2, 3, 4, 6, 8, 10, 12, 20, 100] as const

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)

/** lodash `merge`: objects merge by key, arrays by index, `undefined` never overwrites. */
export function mergeDeep(a: unknown, b: unknown): unknown {
  if (b === undefined) return a
  if (Array.isArray(a) && Array.isArray(b)) {
    const out = [...a]
    b.forEach((v, i) => { out[i] = mergeDeep(a[i], v) })
    return out
  }
  if (isPlain(a) && isPlain(b)) {
    const out: Record<string, unknown> = { ...a }
    for (const [k, v] of Object.entries(b)) out[k] = mergeDeep(a[k], v)
    return out
  }
  return b
}

/**
 * Builds the primitive schemas that depend on a game's enum registry.
 * Everything that checks a closed list goes through `e()`.
 */
export function createPrimitives(enums: EnumRegistry) {
  const cache = new Map<string, z.ZodType<string>>()
  const e = (name: string): z.ZodType<string> => {
    const values = enums.values[name]
    if (!values) throw new Error(`unknown enum "${name}"`)
    if (!values.length) return z.string()
    const aliases = enums.aliases[name] ?? {}
    if (!Object.keys(aliases).length) return z.enum(values as [string, ...string[]])
    if (!cache.has(name)) {
      const allowed = new Set(values)
      cache.set(name, z.string().superRefine((v, ctx) => {
        if (allowed.has(v)) return
        if (aliases[v]) flag(ctx, 'info', `legacy ${name} value "${v}" is "${aliases[v]}"`, [], 'enum-legacy-value')
        else ctx.addIssue({ code: 'custom', message: `Invalid option: expected one of ${values.map(x => `"${x}"`).join('|')}`, params: { severity: 'error', rule: 'invalid_value' } })
      }))
    }
    return cache.get(name)!
  }
  const Ability = e('abilities')
  const OneOrMany = <T extends z.ZodType>(s: T) => z.union([s, z.array(s)])

  /** Value expressions: `{ type: 'flat', value: 2 }`, `{ type: 'mod', value: 'con' }`, `{ type: 'progressive', value: { 1: 4, 5: 6 } }`... */
  const Formula: z.ZodType = z.lazy(() => z.strictObject({
    type: e('formulaKinds'),
    value: z.union([
      z.number(),
      z.string(),
      z.array(z.union([z.string(), Formula])),
      z.record(z.string().regex(/^\d+$/, 'progressive keys are levels'), z.number()),
    ]).optional(),
    multiplier: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    ceil: z.boolean().optional(),
    useMax: z.boolean().optional(),
    /** Class id whose levels count (multiclass-aware formulas). */
    limit: z.string().optional(),
    bonus: z.lazy(() => Formula).optional(),
  }))

  const DieCount = z.union([z.number().int().nonnegative(), Formula])
  /** `false` = no dice, the roll is `bonus` alone. */
  const DieType = z.union([z.literal(DIE_TYPES), z.literal(false), Formula])

  /** A record keyed by enum values (`senses: { darkvision: 60 }`), keys checked with aliases like `e()`. */
  const keyedBy = (name: string, value: z.ZodType) => z.record(z.string(), value).superRefine((obj, ctx) => {
    for (const key of Object.keys(obj)) {
      const r = e(name).safeParse(key)
      if (r.success) continue
      for (const iss of r.error.issues) {
        const params = (iss as { params?: Record<string, unknown> }).params ?? {}
        ctx.addIssue({ code: 'custom', message: `key "${key}": ${iss.message}`, path: [key], params: { severity: 'error', rule: 'invalid_key', ...params } })
      }
    }
  })

  const Damage = z.strictObject({
    dieCount: DieCount.optional(),
    dieType: DieType.optional(),
    type: orNone(z.union([e('damageTypes'), e('healingTypes')])).optional(),
    bonus: Formula.optional(),
    /** Ability (or `pc` = powercasting ability) added to the roll; `true`/`false` on bestiary attacks. */
    mod: z.union([Ability, z.literal('pc'), z.boolean()]).optional(),
    addTo: z.enum(['base', 'all']).optional(),
    label: z.string().optional(),
  })

  const Aoe = z.strictObject({ type: e('aoeShapes').optional(), size: z.number().nonnegative() })
  const Range = z.strictObject({
    short: z.number().nonnegative().optional(),
    long: z.number().nonnegative().optional(),
    aoe: orNone(Aoe).optional(),
    /** Splash damage bound to the area (ME Dirty Bomb). */
    damage: z.array(Damage).optional(),
  })

  const Dc = z.strictObject({
    save: Ability.optional(),
    base: z.number().optional(),
    proficient: z.boolean().optional(),
    mod: Ability.optional(),
    bonus: Formula.optional(),
    note: z.string().optional(),
  })

  const Attack = z.strictObject({
    type: z.enum(['melee', 'ranged']).optional(),
    /** `power` or `weapon` attack. */
    wp: z.enum(['power', 'weapon']).optional(),
    proficient: z.boolean().optional(),
    mod: z.union([Ability, z.literal(false)]).optional(),
    bonus: Formula.optional(),
  })

  const Duration = z.strictObject({ length: z.number().nonnegative(), unit: e('timeUnits').optional() })
  const CastingTime = z.strictObject({
    length: z.number().positive().optional(),
    unit: e('timeUnits'),
    /** Trigger text for reactions. */
    reaction: z.string().optional(),
  })

  // `model` stays a plain string here: the reference checker resolves it (collection, edge family, class).
  const Ref = () => z.strictObject({
    model: z.string(),
    id: Id,
    name: z.string().optional(),
    value: z.string().optional(),
  })
  const MoreInfo = z.union([
    z.strictObject({
      model: z.string().optional(),
      id: Id.optional(),
      additional: OneOrMany(Ref()).optional(),
    }),
    z.array(Ref()),
  ])

  const Note = z.union([
    z.string(),
    z.strictObject({
      type: z.enum(['text', 'tooltip']).optional(),
      text: z.string().optional(),
      tooltipText: z.string().optional(),
      html: z.boolean().optional(),
      isHtml: z.boolean().optional(),
    }),
  ])

  const Resource: z.ZodType = z.lazy(() => z.strictObject({
    id: z.string().optional(),
    label: z.union([z.string(), z.literal(false)]).optional(),
    max: Formula.optional(),
    min: z.number().optional(),
    reset: e('resets').optional(),
    resetTo: z.enum(['max', 'min']).optional(),
    displayType: e('resourceDisplays').optional(),
    increment: z.number().optional(),
    shortDesc: z.string().optional(),
    /** Legacy: a resource nested inside a resource (feats/biotic-prodigy, fake-it-til-you-make-it). */
    resource: Resource.optional(),
  }))

  const ProgressionColumn = z.strictObject({
    label: z.string(),
    order: z.number().optional(),
    values: z.array(z.union([z.number(), z.string(), z.null()])).length(20, 'needs one value per level (20)'),
  })

  const Dice = z.strictObject({ dieCount: z.number().int().nonnegative(), dieType: z.literal(DIE_TYPES) })

  return { e, keyedBy, Ability, OneOrMany, Formula, Damage, Aoe, Range, Dc, Attack, Duration, CastingTime, Ref, MoreInfo, Note, Resource, ProgressionColumn, Dice }
}

export type Primitives = ReturnType<typeof createPrimitives>
