import { z } from 'zod'
import { flag, Id, mergeDeep, type Primitives } from '../primitives'

/**
 * Mechanics registry.
 *
 * A mechanic is one rules effect on a record (`{ type: 'asi', ability: 'dex', amount: 1 }`).
 * Core 5e types use bare names (`asi`, `resistance`). Game types are namespaced
 * (`me:shields`, `sw:force-points`). A definition can list `legacy` names it was
 * renamed from: content that still uses one gets an error naming the new type,
 * and content migrations read their renames from here.
 */
export interface MechanicKit extends Primitives {
  /** Any registered mechanic (recursive: toggles and augments hold mechanics). */
  mechanic: z.ZodType
  mechanics: z.ZodType
  /** Fields every `*-choice` mechanic shares. */
  choice: typeof choiceShape
  /** Fields shared by action-like mechanics (action, bonus-action, reaction, other, attack). */
  action: ReturnType<typeof actionShape>
}

export interface MechanicDefinition {
  type: string
  legacy?: string[]
  description?: string
  fields: (k: MechanicKit) => z.ZodRawShape
}

export const defineMechanic = (def: MechanicDefinition) => def

const choiceShape = {
  options: z.literal(true).optional(),
  selections: z.number().int().positive().optional(),
  limit: z.union([z.string(), z.array(z.string())]).optional(),
  label: z.string().optional(),
  profType: z.string().optional(),
  /** Grant only if the character doesn't already have this proficiency. */
  newIf: z.string().optional(),
}

function actionShape(p: Primitives, mechanics: z.ZodType) {
  const Toggle: z.ZodType = z.strictObject({
    id: z.string().optional(),
    whenOn: mechanics.optional(),
    whenOff: mechanics.optional(),
    options: z.array(z.strictObject({ id: z.string().optional(), name: z.string().optional(), whenOn: mechanics.optional() })).optional(),
  })
  return {
    name: z.string().optional(),
    shortDesc: z.string().optional(),
    notes: z.array(p.Note).optional(),
    resource: p.Resource.optional(),
    toggle: Toggle.optional(),
    damage: z.array(p.Damage).optional(),
    dc: p.Dc.optional(),
    range: p.Range.optional(),
    attack: p.Attack.optional(),
    moreInfo: p.MoreInfo.optional(),
    layout: z.enum(['attack', 'simple', 'stats-right']).optional(),
    group: z.string().optional(),
    baseGroup: z.boolean().optional(),
    progressionColumn: p.ProgressionColumn.optional(),
    properties: z.array(z.string()).optional(),
    value: z.string().optional(),
  }
}

export interface MechanicNote { type: string, canonical: string }

/**
 * Builds the mechanic dispatcher for a set of definitions.
 * Unknown types, untyped entries and renamed (legacy) types become flagged issues
 * (see `flag()`), so one bad mechanic never hides the rest of the record.
 */
export function buildMechanics(p: Primitives, defs: MechanicDefinition[]) {
  let dispatcher: z.ZodType = z.any()
  const mechanic = z.lazy(() => dispatcher)
  const mechanics = z.array(mechanic)
  const kit: MechanicKit = { ...p, mechanic, mechanics, choice: choiceShape, action: actionShape(p, mechanics) }

  const byType = new Map<string, z.ZodType>()
  const legacy = new Map<string, string>()
  for (const def of defs) {
    if (byType.has(def.type)) throw new Error(`mechanic "${def.type}" registered twice`)
    byType.set(def.type, z.strictObject({ type: z.string(), ...def.fields(kit) }))
    for (const old of def.legacy ?? []) legacy.set(old, def.type)
  }

  dispatcher = z.looseObject({}).superRefine((m: Record<string, unknown>, ctx) => {
    const raw = m.type
    if (typeof raw !== 'string') {
      flag(ctx, 'error', raw === undefined ? 'mechanic has no `type`' : `mechanic \`type\` must be a string, got ${JSON.stringify(raw)}`, ['type'], 'mechanic-type-missing')
      return
    }
    let type = raw
    if (!byType.has(type) && legacy.has(type)) {
      type = legacy.get(type)!
      flag(ctx, 'error', `mechanic type "${raw}" was renamed to "${type}"`, ['type'], 'mechanic-legacy-type')
    }
    const schema = byType.get(type)
    if (!schema) {
      flag(ctx, 'error', `unknown mechanic type "${raw}"`, ['type'], 'mechanic-type-unknown')
      return
    }
    const result = schema.safeParse(m)
    if (!result.success) forwardIssues(result.error.issues, ctx)
  })

  return { mechanic, mechanics, kit, types: [...byType.keys()], legacy }
}

/**
 * A list where the first entry is complete and each later entry is a delta
 * deep-merged onto it (lodash `merge`): power upcasts, primer tiers. Deltas are
 * checked as merged, and only issues inside keys the delta sets are reported.
 */
export function tiered(entry: z.ZodType) {
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
  })
}

/** Re-emits nested issues as custom issues, keeping their severity and original code. */
export function forwardIssues(issues: z.core.$ZodIssue[], ctx: z.RefinementCtx, prefix: (string | number)[] = []) {
  for (const iss of issues) {
    const params = (iss as { params?: Record<string, unknown> }).params ?? {}
    const severity = params.severity ?? (iss.code === 'unrecognized_keys' ? 'warning' : 'error')
    // Keep union branches so the validator can still pick the closest one.
    const errors = (iss as { errors?: unknown }).errors
    ctx.addIssue({ code: 'custom', message: iss.message, path: [...prefix, ...iss.path as (string | number)[]], params: { ...params, severity, rule: params.rule ?? iss.code, errors } })
  }
}

export { Id }
