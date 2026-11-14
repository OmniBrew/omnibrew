import { slugify } from '@omnibrew/engine/data'
import type { Game } from '@omnibrew/engine/schemas'
import type { Issue } from '@omnibrew/engine/validator'
import { validateRecord } from '@omnibrew/engine/validator/record'
import type { Gen1Homebrew } from './gen1'
import { htmlToMarkdown } from './html'
import { migrateRecord } from './record'

/**
 * One live homebrew row → a new Homebrew row (plan/28 §1.3, decision 1: every row at
 * cutover, by `homebrew-cli.ts`). Pure: the CLI reads and writes the tables.
 *
 * - The old record shape goes through the content migration (`migrateRecord`: the
 *   legacy adapter, renamed mechanics and enum values, none markers, MDC); its `html`
 *   becomes the markdown body; HTML in any other text becomes markdown too.
 * - `validateRecord` against the content. A record with errors is kept **private** (the
 *   status it had is in `migration.status`), so it can't reach other players until its
 *   owner fixes it; their characters keep working through their copies (B120).
 * - Id, counts, `official` and dates are kept. `owner` stays the Gen 1 username until the
 *   owner's first sign-in claims it (`migrateMyData`); the owner rules accept it meanwhile.
 */
type Rec = Record<string, unknown>
type Records = Map<string, Map<string, Rec>>

export type HomebrewStatus = 'private' | 'development' | 'published'

/** What `migration` holds on a converted Homebrew row. */
export interface HomebrewMigration {
  /** The Gen 1 row's `updatedAt`. */
  from: string | null
  /** The live status, when it was lowered to private. */
  status?: HomebrewStatus
  /** What blocks sharing (`validateRecord` errors), for the owner. */
  issues?: Array<{ path?: string, message: string }>
  /** What the conversion changed or dropped. */
  notes?: string[]
}

export interface NewHomebrewRow {
  id: string
  owner: string
  kind: string
  title: string
  slug: string
  data: Rec
  status: HomebrewStatus
  official: boolean
  usageCount: number
  voteCount: number
  createdAt: string
  updatedAt: string
  migration: HomebrewMigration
}

/** The live kinds the new site has homebrew for (live had powers and weapons only). */
const KINDS = new Set(['powers', 'weapons'])

function parseData(data: Gen1Homebrew['data']): Rec | null {
  let value: unknown = data
  for (let i = 0; i < 2 && typeof value === 'string'; i++) {
    try {
      value = JSON.parse(value)
    }
    catch {
      return null
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Rec : null
}

/** HTML in every string of a record (advancement texts...) → markdown. */
function stringsToMarkdown(value: unknown, dropped: (tag: string) => void): unknown {
  if (typeof value === 'string') return /<\/?[a-z][^<>]*>/i.test(value) ? htmlToMarkdown(value, dropped) : value
  if (Array.isArray(value)) return value.map(v => stringsToMarkdown(v, dropped))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stringsToMarkdown(v, dropped)]))
  return value
}

const liveStatus = (row: Gen1Homebrew): HomebrewStatus => (row.published ? 'published' : row.development ? 'development' : 'private')

export function convertHomebrew(game: Game, records: Records, row: Gen1Homebrew): NewHomebrewRow {
  const notes = new Set<string>()
  const issues: Array<{ path?: string, message: string }> = []
  const kind = row.model
  const title = (row.title ?? '').trim() || 'Untitled'
  let data: Rec = { name: title }

  const raw = parseData(row.data)
  if (!raw) issues.push({ message: 'the record could not be read; only its title came across' })
  else if (!KINDS.has(kind)) issues.push({ message: `no homebrew kind "${kind}"` })
  else {
    const { id: _id, html, ...rest } = raw
    const dropped = (tag: string) => notes.add(`<${tag}> dropped (no markdown for it)`)
    const body = typeof html === 'string' ? htmlToMarkdown(html, dropped) : ''
    try {
      const migrated = migrateRecord(game, kind, stringsToMarkdown(rest, dropped) as Rec, body, (rule, message) => notes.add(`${rule}: ${message}`))
      data = { ...migrated.attributes, ...(migrated.body ? { body: migrated.body } : {}) }
    }
    catch (e) {
      issues.push({ message: `could not convert: ${(e as Error).message}` })
      data = { ...rest, ...(body ? { body } : {}) }
    }
    if (typeof data.name !== 'string' || !data.name.trim()) data.name = title
  }

  if (!issues.length) {
    const { body, ...rest } = data
    const record = { ...rest, ...(typeof body === 'string' && body ? { body } : {}), id: row.id }
    const errors = validateRecord(game, kind, record, records).filter((i: Issue) => i.severity === 'error')
    issues.push(...errors.map(i => ({ ...(i.path ? { path: i.path } : {}), message: i.message })))
  }

  const status = liveStatus(row)
  const now = row.updatedAt ?? row.createdAt ?? new Date(0).toISOString()
  const lowered = issues.length > 0 && status !== 'private'
  return {
    id: row.id,
    owner: row.owner,
    kind,
    title,
    slug: slugify(title) || 'homebrew',
    data,
    status: lowered ? 'private' : status,
    official: !!row.official,
    usageCount: Math.max(0, row.usageCount ?? 0),
    voteCount: Math.max(0, row.voteCount ?? 0),
    createdAt: row.createdAt ?? now,
    updatedAt: now,
    migration: {
      from: row.updatedAt ?? null,
      ...(lowered ? { status } : {}),
      ...(issues.length ? { issues } : {}),
      ...(notes.size ? { notes: [...notes] } : {}),
    },
  }
}
