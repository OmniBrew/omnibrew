import { z } from 'zod'
import type { Game } from '../schemas/game'

/**
 * Nuxt Content collection schemas derived from a game's content schemas, so
 * the site and the validator share one definition.
 *
 * Nuxt Content uses a schema only to store and type fields (one SQL column per
 * top-level field, converted with `z.toJSONSchema`); it does not validate, which
 * is the validator's job. So the derived schema:
 * - leaves out `id` and `body` (Nuxt Content's own) and `kind` (injected by the source);
 * - turns a union of object shapes (armor: suit | piece) into one object with the fields of both;
 * - stores a field whose JSON schema needs `$ref` (a recursive shape) as plain JSON;
 * - makes every field optional.
 */
const OWN_FIELDS = new Set(['id', 'body', 'kind'])

/** `class-features` → `classFeatures`: Nuxt Content collection names are identifiers. */
export const contentCollectionName = (name: string) => name.replace(/-([a-z\d])/g, (_, c: string) => c.toUpperCase())

function shapeOf(schema: z.ZodType): Record<string, z.ZodType> {
  if (schema instanceof z.ZodObject) return schema.shape as Record<string, z.ZodType>
  if (schema instanceof z.ZodUnion) {
    const shapes = (schema.options as z.ZodType[]).map(shapeOf)
    const keys = [...new Set(shapes.flatMap(s => Object.keys(s)))]
    return Object.fromEntries(keys.map((key) => {
      const variants = shapes.map(s => s[key]).filter((v): v is z.ZodType => !!v)
      return [key, variants.length === 1 ? variants[0]! : z.union(variants as [z.ZodType, z.ZodType, ...z.ZodType[]])]
    }))
  }
  throw new Error('collection schema is not an object or a union of objects')
}

const JSON_VALUE = z.union([z.string(), z.number(), z.boolean(), z.array(z.unknown()), z.record(z.string(), z.unknown())])

function storable(field: z.ZodType): z.ZodType {
  let json: Record<string, unknown>
  try {
    json = z.toJSONSchema(field, { unrepresentable: 'any', io: 'input' }) as Record<string, unknown>
  }
  catch {
    return JSON_VALUE
  }
  if (!JSON.stringify(json).includes('"$ref"')) return field
  if (json.type === 'array') return z.array(z.unknown())
  if (json.type === 'object') return z.record(z.string(), z.unknown())
  return JSON_VALUE
}

export function contentSchema(game: Game, collection: string) {
  const schema = game.schemas[collection]
  if (!schema) throw new Error(`no schema for collection "${collection}"`)
  const fields = Object.entries(shapeOf(schema))
    .filter(([key]) => !OWN_FIELDS.has(key))
    .map(([key, field]) => [key, storable(field).optional()])
  return z.object(Object.fromEntries(fields))
}
