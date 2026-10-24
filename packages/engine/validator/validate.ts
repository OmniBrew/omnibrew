import { createGame, type GameDefinition } from '../schemas/game'
import { findBacklog } from './backlog'
import { fromZod, type Issue } from './issues'
import { loadContent } from './load'
import { checkProse } from './prose'
import { checkReferences } from './refs'

export interface ValidationResult {
  game: string
  root: string
  /** Records per collection. */
  counts: Record<string, number>
  issues: Issue[]
}

/**
 * Validates a content repo against a game: schema, cross-references,
 * data/text pairing, prose tags, then the game's own checks.
 * Content is read only; the legacy adapter works on in-memory copies.
 */
export function validateContent(root: string, def: GameDefinition): ValidationResult {
  const game = createGame(def)
  const { records: loaded, issues } = loadContent(root, def)

  const records = new Map<string, Map<string, Record<string, unknown>>>()
  const files = new Map<string, string | undefined>()
  const counts: Record<string, number> = {}

  for (const item of loaded) {
    const { collection, id } = item
    const file = item.dataFile ?? item.textFile
    files.set(`${collection}/${id}`, file)
    counts[collection] = (counts[collection] ?? 0) + 1

    let rec = item.record
    const kind = def.sources[collection]?.itemKind
    if (kind) rec = { ...rec, kind }
    if (def.legacy) {
      rec = def.legacy(rec, {
        collection,
        note: (rule, message, path) => issues.push({ severity: 'info', category: 'legacy', collection, id, file, rule, message, path: path?.join('.') }),
      })
    }

    const schema = game.schemas[collection]
    if (schema) {
      const result = schema.safeParse(rec)
      if (!result.success) issues.push(...fromZod(result.error.issues, { collection, id, file }))
    }

    if (!records.has(collection)) records.set(collection, new Map())
    records.get(collection)!.set(id, rec)
  }

  // A level-n power has one casting entry per level it can be cast at (n..max).
  for (const [id, p] of records.get('powers') ?? []) {
    const max = def.powerSystem.maxLevel
    if (typeof p.level === 'number' && p.level > 0 && Array.isArray(p.casting) && p.casting.length > max - p.level + 1) {
      issues.push({ severity: 'warning', category: 'schema', collection: 'powers', id, file: files.get(`powers/${id}`), rule: 'power-upcast-count', message: `${p.casting.length} casting entries for a level-${p.level} power; levels ${p.level}–${max} need at most ${max - p.level + 1}` })
    }
  }

  issues.push(...checkReferences(game, records, files))
  issues.push(...checkProse(records, files))
  issues.push(...findBacklog(records, files))
  def.checks?.({
    root,
    records,
    report: i => issues.push({ ...i, file: i.file ?? (i.id ? files.get(`${i.collection}/${i.id}`) : undefined) }),
  })

  return { game: def.id, root, counts, issues }
}
