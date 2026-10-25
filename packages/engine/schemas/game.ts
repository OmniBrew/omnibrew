import { z } from 'zod'
import { armorSchema, coreCollections, type ShapeFn } from './collections'
import { buildEnums, type EnumOverrides, type EnumRegistry } from './enums'
import { gearFields, itemBase, weaponFields } from './items'
import { coreMechanics } from './mechanics/core'
import { buildMechanics, type MechanicDefinition, type MechanicKit } from './mechanics/registry'
import { powerSystemMechanics, type PowerSystemConfig } from './power-system'
import { createPrimitives, Id } from './primitives'

export type Ruleset = '5e-2014' | '5e-2024'

/** Where a collection's files live in a content repo. */
export interface CollectionSource {
  /** Folder holding one `<id>.md` file per record (`content/powers`). */
  dir: string
  /** Item kind injected into every record of an item collection. */
  itemKind?: string
}

export interface GameCheckIssue {
  severity: 'error' | 'warning' | 'info'
  category: 'schema' | 'reference' | 'legacy' | 'prose' | 'backlog'
  collection: string
  id?: string
  file?: string
  rule: string
  message: string
}

export interface GameCheckContext {
  /** Content repo root. */
  root: string
  /** Normalized records: collection → id → record. */
  records: Map<string, Map<string, Record<string, unknown>>>
  report: (issue: GameCheckIssue) => void
}

export interface GameDefinition {
  id: string
  name: string
  /** Prefix for this game's mechanics and formula kinds (`me` → `me:shields`). */
  namespace: string
  ruleset: Ruleset
  enums?: EnumOverrides
  mechanics?: MechanicDefinition[]
  powerSystem: PowerSystemConfig
  /** Extra fields per core collection. */
  fields?: Record<string, ShapeFn>
  /** Collections that exist only in this game. */
  collections?: Record<string, ShapeFn>
  /** Item kinds beyond weapon/armor/gear. Each shape must include `kind: z.literal(...)`. */
  itemKinds?: Record<string, ShapeFn>
  /** Content repo layout: collection name → folder. */
  sources: Record<string, CollectionSource>
  /** Game-specific checks that need the whole content set (indexes, generated records...). */
  checks?: (ctx: GameCheckContext) => void
}

export const defineGame = (def: GameDefinition) => def

export interface Game {
  def: GameDefinition
  enums: EnumRegistry
  kit: MechanicKit
  mechanicTypes: string[]
  /** Renamed mechanic types: old name → current name. */
  legacyMechanicTypes: Map<string, string>
  /** One schema per collection named in `def.sources`. */
  schemas: Record<string, z.ZodType>
  /** Every item kind in one discriminated union (homebrew forms, runtime merging). */
  Item: z.ZodType
}

export function createGame(def: GameDefinition): Game {
  for (const m of def.mechanics ?? []) {
    if (!m.type.startsWith(`${def.namespace}:`)) throw new Error(`game mechanic "${m.type}" must be namespaced "${def.namespace}:"`)
  }
  const enums = buildEnums({
    ...def.enums,
    extend: {
      ...def.enums?.extend,
      models: [...new Set([...(def.enums?.extend?.models ?? []), ...Object.keys(def.sources)])],
      powerTypes: [...new Set([...(def.enums?.extend?.powerTypes ?? []), ...def.powerSystem.pools.flatMap(p => p.powerTypes)])],
    },
  })
  const prims = createPrimitives(enums)
  const { kit, types, legacy } = buildMechanics(prims, [
    ...coreMechanics,
    ...powerSystemMechanics(def.powerSystem),
    ...(def.mechanics ?? []),
  ])

  const shapes: Record<string, ShapeFn> = { ...coreCollections(def.powerSystem), ...def.collections }
  const schemas: Record<string, z.ZodType> = {}
  for (const [name, source] of Object.entries(def.sources)) {
    const extra = def.fields?.[name]?.(kit) ?? {}
    if (source.itemKind === 'armor') {
      schemas[name] = armorSchema(kit, extra)
      continue
    }
    if (source.itemKind && def.itemKinds?.[source.itemKind]) {
      schemas[name] = z.strictObject({ id: Id, body: z.string().optional(), ...itemBase(kit), ...def.itemKinds[source.itemKind]!(kit), ...extra })
      continue
    }
    const shape = shapes[name]
    if (!shape) throw new Error(`no schema for collection "${name}"`)
    schemas[name] = z.strictObject({ ...shape(kit), ...extra })
  }

  const itemOptions = [
    z.strictObject({ id: Id, ...itemBase(kit), ...weaponFields(kit) }),
    z.strictObject({ id: Id, ...itemBase(kit), ...gearFields(kit) }),
    ...Object.values(def.itemKinds ?? {}).map(fn => z.strictObject({ id: Id, ...itemBase(kit), ...fn(kit) })),
  ]
  const Item = z.union([z.discriminatedUnion('kind', itemOptions as [typeof itemOptions[0], ...typeof itemOptions]), armorSchema(kit)])

  return { def, enums, kit, mechanicTypes: types, legacyMechanicTypes: legacy, schemas, Item }
}
