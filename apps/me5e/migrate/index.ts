import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { parseFrontMatter, parseYaml, stringifyRecord, stringifyYaml, toCrlf } from '@omnibrew/engine/content'
import { createGame } from '@omnibrew/engine/schemas'
import type { Issue } from '@omnibrew/engine/validator'
import { me5e } from '../game'
import { loadLegacyCollection } from './legacy-load'
import { migrateRecord } from './record'

/**
 * Migrates masseffect-5e-data from its pre-2026 layout (data/ + text/en/) to the
 * engine layout (plan/04 R6, R7). Re-runnable: point `from` at any checkout of
 * the old layout and it regenerates the same files.
 *
 *   data/<c>/<id>.md + text/en/<c>/<id>.md  →  content/<c>/<id>.md
 *   data/manual-index.md, guides-index.md   →  content/navigation/manual.yml, guide.yml (`chapters:`)
 *   data/about.json                         →  content/site/about.yml
 *   text/en/messages/*.js                   →  messages/en.yml (UI strings, plan/04 D8)
 */
export interface MigrateOptions {
  /** Checkout in the old layout. */
  from: string
  /** Content repo to write into (may be `from`: data/ and text/ are then removed). */
  to: string
  eol?: 'lf' | 'crlf' | 'auto'
  /** Replace an existing content/ and messages/ in `to`. */
  force?: boolean
  /** Do everything except write. */
  dryRun?: boolean
  /** Only these collections (tests); the default is every collection in the game. */
  collections?: string[]
}

export interface MigrateResult {
  /** Relative path → file text (LF). */
  files: Map<string, string>
  records: Record<string, number>
  /** rule → message → count */
  notes: Map<string, Map<string, number>>
  issues: Issue[]
}

const OWNED = ['content', 'messages']
const LEGACY = ['data', 'text']

/** Template-literal indentation in the old JS messages: HTML collapsed it, so YAML doesn't need it. */
function collapse(value: unknown): unknown {
  if (typeof value === 'string') return value.includes('\n') ? value.replace(/\s*\n\s*/g, ' ').trim() : value
  if (Array.isArray(value)) return value.map(collapse)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, collapse(v)]))
  return value
}

/** Index files were front-matter-only markdown holding a YAML list. */
function readIndex(path: string): unknown {
  const raw = readFileSync(path, 'utf8')
  const block = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!block) throw new Error(`${path}: no front-matter`)
  const { value, errors } = parseYaml(block[1]!)
  if (errors.length) throw new Error(`${path}: ${errors.join('; ')}`)
  return value
}

export function migrateContent(opts: MigrateOptions): MigrateResult {
  const from = resolve(opts.from)
  const to = resolve(opts.to)
  if (!existsSync(join(from, 'data')) || !existsSync(join(from, 'text/en'))) {
    throw new Error(`${from} is not in the old layout (no data/ and text/en/)`)
  }
  const game = createGame(me5e)
  const issues: Issue[] = []
  const files = new Map<string, string>()
  const records: Record<string, number> = {}
  const notes = new Map<string, Map<string, number>>()
  const note = (rule: string, message: string) => {
    if (!notes.has(rule)) notes.set(rule, new Map())
    const byMessage = notes.get(rule)!
    byMessage.set(message, (byMessage.get(message) ?? 0) + 1)
  }

  for (const [collection, source] of Object.entries(me5e.sources)) {
    if (opts.collections && !opts.collections.includes(collection)) continue
    for (const legacy of loadLegacyCollection(from, collection, issues)) {
      let migrated
      try {
        migrated = migrateRecord(game, collection, legacy.attributes, legacy.body, note)
      }
      catch (err) {
        throw new Error(`${legacy.files.join(' + ')}: ${(err as Error).message}`, { cause: err })
      }
      const text = stringifyRecord(migrated.attributes, migrated.body)
      // The file must read back as exactly what was meant.
      const back = parseFrontMatter(text)
      if (JSON.stringify(back.attributes) !== JSON.stringify(migrated.attributes) || back.body.trimEnd() !== migrated.body || back.errors.length) {
        throw new Error(`${legacy.files[0]}: written file does not read back as the migrated record`)
      }
      files.set(`${source.dir}/${legacy.id}.md`, text)
      records[collection] = (records[collection] ?? 0) + 1
    }
  }
  const errors = issues.filter(i => i.severity === 'error')
  if (errors.length) throw new Error(`cannot read the old content:\n${errors.map(i => `  ${i.file}: ${i.message}`).join('\n')}`)

  files.set('content/navigation/manual.yml', stringifyYaml({ chapters: readIndex(join(from, 'data/manual-index.md')) }))
  files.set('content/navigation/guide.yml', stringifyYaml({ chapters: readIndex(join(from, 'data/guides-index.md')) }))
  files.set('content/site/about.yml', stringifyYaml(JSON.parse(readFileSync(join(from, 'data/about.json'), 'utf8'))))
  const messages = createRequire(import.meta.url)(join(from, 'text/en/messages/index.js'))
  files.set('messages/en.yml', stringifyYaml(collapse(messages)))

  if (!opts.dryRun) write(from, to, files, opts)
  return { files, records, notes, issues }
}

function write(from: string, to: string, files: Map<string, string>, opts: MigrateOptions) {
  const existing = OWNED.filter(d => existsSync(join(to, d)))
  if (existing.length && !opts.force) throw new Error(`${to} already has ${existing.join(', ')}; pass --force to replace`)
  for (const d of existing) rmSync(join(to, d), { recursive: true })

  let eol = opts.eol ?? 'auto'
  if (eol === 'auto') {
    // Windows checkouts with core.autocrlf=true hold CRLF files; match them so git shows real changes only.
    let autocrlf = ''
    try {
      autocrlf = execFileSync('git', ['-C', to, 'config', 'core.autocrlf'], { encoding: 'utf8' }).trim()
    }
    catch { /* not set */ }
    eol = autocrlf === 'true' ? 'crlf' : 'lf'
  }
  for (const [rel, text] of files) {
    const path = join(to, rel)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, eol === 'crlf' ? toCrlf(text) : text)
  }
  if (from === to) {
    for (const d of LEGACY) rmSync(join(to, d), { recursive: true })
  }
}
