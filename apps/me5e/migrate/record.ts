import type { Game } from '@omnibrew/engine/schemas'
import { walkMechanics } from '@omnibrew/engine/validator'
import { meLegacy } from './legacy'
import { legacyTagsToMdc } from './mdc'

/**
 * Turns one pre-2026 record (data/ and text/en/ already merged) into the engine
 * shape (plan/04 R6), in this order:
 * 1. field renames (`legacy.ts`: powerType, casting, *Type, coverage/slot, properties);
 * 2. mechanic types and enum values the game registry lists as renamed (`shields` → `me:shields`);
 * 3. legacy "none" markers dropped where the field is optional (`set: false`, `image: null`, `manufacturer: ""`);
 * 4. framework tags in prose rewritten as MDC components (`mdc.ts`);
 * 5. `name` / `title` moved to the top; every other key keeps its place.
 */
type Rec = Record<string, unknown>

export type Note = (rule: string, message: string) => void

const isObject = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)
const isNone = (v: unknown) => v === false || v === null || v === ''

/** Visits every plain object in `value`, with the key it sits under. */
function walkObjects(value: unknown, visit: (obj: Rec) => void) {
  if (Array.isArray(value)) value.forEach(v => walkObjects(v, visit))
  else if (isObject(value)) {
    visit(value)
    Object.values(value).forEach(v => walkObjects(v, visit))
  }
}

export function renameMechanics(game: Game, rec: Rec, note: Note) {
  walkMechanics(rec, (m) => {
    const to = game.legacyMechanicTypes.get(m.type as string)
    if (!to) return
    note('mechanic-type', `mechanic \`${m.type}\` is \`${to}\``)
    m.type = to
  })
}

/** Enum values the registry lists as renamed. ME renames formula kinds (`type`) and senses (`sense`, `senses` keys). */
export function renameEnumValues(game: Game, rec: Rec, note: Note) {
  const { formulaKinds = {}, senses = {}, ...other } = game.enums.aliases
  if (Object.keys(other).length) throw new Error(`no migration rule for renamed values in enums ${Object.keys(other).join(', ')}`)
  walkObjects(rec, (obj) => {
    if (typeof obj.type === 'string' && formulaKinds[obj.type]) {
      note('formula-kind', `formula \`${obj.type}\` is \`${formulaKinds[obj.type]}\``)
      obj.type = formulaKinds[obj.type]
    }
    if (typeof obj.sense === 'string' && senses[obj.sense]) {
      note('sense', `sense \`${obj.sense}\` is \`${senses[obj.sense]}\``)
      obj.sense = senses[obj.sense]
    }
    if (isObject(obj.senses) && Object.keys(obj.senses).some(k => senses[k])) {
      obj.senses = Object.fromEntries(Object.entries(obj.senses).map(([k, v]) => {
        if (senses[k]) note('sense', `sense \`${k}\` is \`${senses[k]}\``)
        return [senses[k] ?? k, v]
      }))
    }
  })
}

/** Record fields where `false` / `null` / `""` meant "none" (plan/08, plan/12): the key is dropped. */
const RECORD_NONES: Record<string, string[]> = {
  '*': ['image', 'manufacturer', 'subType'],
  'armor': ['set'],
  'bestiary': ['irv', 'savingThrows', 'senses', 'shields', 'skills'],
  'powers': ['reactionQualifier'],
  'tool-profs': ['type'],
  'vehicles': ['subtype', 'weapons'],
}
const BESTIARY_ENTRY_NONES = ['damage', 'dc', 'save']
/** Only the base casting entry: in later entries (upcasts) `false` turns a base value off. */
const CASTING_BASE_NONES = ['attack', 'conditions', 'damage', 'dc', 'primes']
const MECHANIC_NONES = ['prepared', 'notes']

function drop(obj: unknown, keys: string[], where: string, note: Note) {
  if (!isObject(obj)) return
  for (const key of keys) {
    if (key in obj && isNone(obj[key])) {
      note('none-marker', `\`${where}${key}: ${JSON.stringify(obj[key])}\` dropped`)
      Reflect.deleteProperty(obj, key)
    }
  }
}

export function dropNoneMarkers(collection: string, rec: Rec, note: Note) {
  drop(rec, [...RECORD_NONES['*']!, ...RECORD_NONES[collection] ?? []], '', note)
  if (collection === 'bestiary' && isObject(rec.entries)) {
    const { legendary, ...groups } = rec.entries
    const lists = [...Object.values(groups), isObject(legendary) ? legendary.actions : undefined]
    for (const list of lists) for (const entry of Array.isArray(list) ? list : []) drop(entry, BESTIARY_ENTRY_NONES, 'entries[].', note)
  }
  if (collection === 'powers' && Array.isArray(rec.casting)) {
    const base = rec.casting[0]
    drop(base, CASTING_BASE_NONES, 'casting[0].', note)
    if (isObject(base)) drop(base.range, ['aoe'], 'casting[0].range.', note)
  }
  walkMechanics(rec, (m, path) => {
    // Inside a `merge` the mechanic is a delta, where `false` / `null` overrides a value.
    if (/(?:^|\.)merge(?:[.[]|$)/.test(path)) return
    drop(m, MECHANIC_NONES, 'mechanic.', note)
    drop(m.value, ['notes'], 'mechanic.value.', note)
    for (const d of Array.isArray(m.damage) ? m.damage : []) drop(d, ['type'], 'mechanic.damage[].', note)
  })
}

/** Rewrites framework tags in every string. */
function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === 'string') return fn(value)
  if (Array.isArray(value)) return value.map(v => mapStrings(v, fn))
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]))
  return value
}

export function migrateRecord(game: Game, collection: string, attributes: Rec, body: string, note: Note): { attributes: Rec, body: string } {
  let rec = meLegacy(structuredClone(attributes), { collection, note })
  renameMechanics(game, rec, note)
  renameEnumValues(game, rec, note)
  dropNoneMarkers(collection, rec, note)

  const tags = (s: string) => {
    const out = legacyTagsToMdc(s)
    if (out !== s) note('mdc', 'framework tags rewritten as MDC components')
    return out
  }
  rec = mapStrings(rec, tags) as Rec
  const lead = ['name', 'title'].filter(k => k in rec)
  rec = { ...Object.fromEntries(lead.map(k => [k, rec[k]])), ...rec }
  return { attributes: rec, body: tags(body).trim() }
}
