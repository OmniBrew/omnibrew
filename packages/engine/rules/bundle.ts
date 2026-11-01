import type { Rec } from './types'

/**
 * The content the rules engine reads, as the browser gets it (plan/24 §1.2): one
 * JSON file of every record's rules fields, plus each collection's prose in a file
 * of its own, fetched when a card or tab shows it. Written at build by the engine's
 * `rules-bundle` module; file names carry a hash of the content, so they cache forever.
 */
export interface RulesBundle {
  game: string
  /** Hash of the records (the file names carry it). */
  hash: string
  collections: Record<string, Rec[]>
}

/** Prose of one collection: record id → markdown body. */
export type ProseFile = Record<string, string>

export interface BundleOptions {
  /** Collections the sheet never reads (changelog, manual...). */
  exclude?: string[]
  /** Collections whose `body` the rules read (weapon property tooltips). */
  keepBody?: string[]
}

/** Splits records into the rules file's collections and the prose files. */
export function splitBundle(records: Map<string, Map<string, Rec>>, options: BundleOptions = {}) {
  const collections: Record<string, Rec[]> = {}
  const prose: Record<string, ProseFile> = {}
  for (const [collection, recs] of [...records].sort(([a], [b]) => a.localeCompare(b))) {
    if (options.exclude?.includes(collection)) continue
    const keepBody = options.keepBody?.includes(collection)
    const out: Rec[] = []
    const bodies: ProseFile = {}
    for (const [id, rec] of recs) {
      const { body, ...fields } = rec
      out.push(keepBody ? { ...fields, id, ...(body ? { body } : {}) } : { ...fields, id })
      if (typeof body === 'string' && body) bodies[id] = body
    }
    collections[collection] = out
    if (Object.keys(bodies).length) prose[collection] = bodies
  }
  return { collections, prose }
}

/** The bundle's records, as `createRules` takes them. */
export function bundleRecords(bundle: Pick<RulesBundle, 'collections'>) {
  const out = new Map<string, Map<string, Rec>>()
  for (const [collection, recs] of Object.entries(bundle.collections)) out.set(collection, new Map(recs.map(r => [r.id as string, r])))
  return out
}

/** Published file names (under `/_rules/`). */
export const bundleFiles = {
  rules: (game: string, hash: string) => `${game}.${hash}.json`,
  prose: (game: string, hash: string, collection: string) => `${game}.${hash}.prose.${collection}.json`,
}
