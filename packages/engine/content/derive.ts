import type { DerivedRecord, GameDefinition } from '../schemas/game'
import { groupRecords, loadContent } from '../validator/load'
import { stringifyRecord } from './format'

/**
 * A game's derived records (`GameDefinition.derive`), computed from a content
 * repo checkout. The validator checks the same records; see validateContent.
 */
export function deriveRecords(root: string, def: GameDefinition): Record<string, DerivedRecord[]> {
  if (!def.derive) return {}
  const { records } = loadContent(root, def, def.derive.from)
  return def.derive.records(groupRecords(records))
}

/**
 * Derived records as record files, for a Nuxt Content custom source
 * (`defineCollectionSource(recordFiles(records, '/edges'))`): keys are
 * `<id>.md`, and `prefix` is the path prefix the collection's file source uses.
 */
export function recordFiles(records: DerivedRecord[], prefix?: string) {
  const files = new Map(records.map(({ id, body, ...attributes }) => [`${id}.md`, stringifyRecord(attributes, body)]))
  return {
    ...(prefix ? { prefix } : {}),
    getKeys: async () => [...files.keys()],
    getItem: async (key: string) => files.get(key) ?? '',
  }
}
