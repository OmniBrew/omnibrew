import { createGame, type GameDefinition } from '../schemas/game'
import { findBacklog } from './backlog'
import { fromZod, type Issue } from './issues'
import { groupRecords, loadContent, type LoadedRecord } from './load'
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
 * Validates a content repo against a game: schema, cross-references, prose
 * (framework tags and MDC components), then the game's own checks.
 */
export function validateContent(root: string, def: GameDefinition): ValidationResult {
  const game = createGame(def)
  const { records: loaded, issues } = loadContent(root, def)

  const records = new Map<string, Map<string, Record<string, unknown>>>()
  const files = new Map<string, string | undefined>()
  const counts: Record<string, number> = {}

  // Derived records join their collections and are validated like files.
  const derived: LoadedRecord[] = []
  if (def.derive) {
    const input = groupRecords(loaded.filter(r => def.derive!.from.includes(r.collection)))
    for (const [collection, recs] of Object.entries(def.derive.records(input))) {
      const taken = new Set(loaded.filter(r => r.collection === collection).map(r => r.id))
      for (const record of recs) {
        if (taken.has(record.id)) {
          issues.push({ severity: 'error', category: 'reference', collection, id: record.id, rule: 'derived-id-taken', message: `a derived ${collection} record reuses the id of content/${collection}/${record.id}.md` })
          continue
        }
        derived.push({ collection, id: record.id, file: `(derived) ${collection}/${record.id}`, record })
      }
    }
  }

  for (const item of [...loaded, ...derived]) {
    const { collection, id } = item
    const file = item.file
    files.set(`${collection}/${id}`, file)
    counts[collection] = (counts[collection] ?? 0) + 1

    let rec = item.record
    const kind = def.sources[collection]?.itemKind
    if (kind) rec = { ...rec, kind }

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
  issues.push(...checkProse(game, records, files))
  issues.push(...findBacklog(records, files))
  def.checks?.({
    root,
    records,
    report: i => issues.push({ ...i, file: i.file ?? (i.id ? files.get(`${i.collection}/${i.id}`) : undefined) }),
  })

  return { game: def.id, root, counts, issues }
}
