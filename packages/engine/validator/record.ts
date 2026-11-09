import type { Game } from '../schemas/game'
import { fromZod, type Issue } from './issues'
import { checkProse } from './prose'
import { checkReferences } from './refs'

type Rec = Record<string, unknown>
type Records = Map<string, Map<string, Rec>>

/** Raw HTML in prose (framework tags, which have a hyphen, are the prose check's). */
const RAW_HTML = /<\/?[a-z][a-z\d]*(?:\s[^<>]*)?\/?>/gi

/**
 * Validates one record against the rest of the content (plan/26 §1.3): homebrew before it
 * is saved, and in the editor as the player types. The record's collection schema (the one
 * `validate:me5e` uses, item `kind` injected), its references (against `records`, which
 * holds content and any other homebrew it may name), and its prose (MDC components only,
 * and no raw HTML: live compiled homebrew HTML as a template). Errors only matter; warnings
 * are kept for the editor to show.
 */
export function validateRecord(game: Game, collection: string, record: Rec, records: Records): Issue[] {
  const id = typeof record.id === 'string' ? record.id : ''
  const kind = game.def.sources[collection]?.itemKind
  const rec = kind ? { ...record, kind } : record
  const issues: Issue[] = []
  const schema = game.schemas[collection]
  if (!schema) return [{ severity: 'error', category: 'schema', collection, id, rule: 'unknown-collection', message: `no collection "${collection}"` }]
  const parsed = schema.safeParse(rec)
  if (!parsed.success) issues.push(...fromZod(parsed.error.issues, { collection, id }))

  const all: Records = new Map(records)
  all.set(collection, new Map([...(records.get(collection) ?? []), [id, rec]]))
  const only = (c: string, i: string) => c === collection && i === id
  const files = new Map<string, string | undefined>()
  issues.push(...checkReferences(game, all, files, only))
  issues.push(...checkProse(game, all, files, only))

  const html = (value: unknown, path: string) => {
    if (typeof value === 'string') {
      for (const m of value.matchAll(RAW_HTML)) issues.push({ severity: 'error', category: 'prose', collection, id, rule: 'raw-html', message: `${m[0]}: write markdown instead of HTML`, path })
    }
    else if (Array.isArray(value)) value.forEach((v, i) => html(v, `${path}[${i}]`))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => html(v, path ? `${path}.${k}` : k))
  }
  html(rec, '')
  return issues
}
