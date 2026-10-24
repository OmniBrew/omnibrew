import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { parseDocument } from 'yaml'
import type { CollectionSource, GameDefinition } from '../schemas/game'
import type { Issue } from './issues'

/**
 * Loads a content repo the way the legacy ME build does:
 * - `data/<dir>/<id>.md` holds mechanics, `text/en/<dir>/<id>.md` prose;
 * - text front-matter is deep-merged over data (arrays of `{ id }` merge by id,
 *   other arrays by index), and the text body replaces the data body;
 * - text-only collections are read from the text folder alone.
 */
export interface LoadedRecord {
  collection: string
  id: string
  dataFile?: string
  textFile?: string
  record: Record<string, unknown>
}

export interface ParsedFile {
  attributes: Record<string, unknown>
  body: string
}

export function parseMarkdown(file: string, root: string, issues: Issue[], collection: string): ParsedFile | undefined {
  const raw = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const rel = relative(root, file).replaceAll('\\', '/')
  const id = basename(file).replace(/\.md$/, '')
  const match = raw.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!match) {
    if (raw.trim().startsWith('---')) {
      issues.push({ severity: 'error', category: 'schema', collection, id, file: rel, rule: 'frontmatter-unterminated', message: 'front-matter is never closed with `---`' })
      return undefined
    }
    return { attributes: {}, body: raw }
  }
  // js-yaml 4 (used by the legacy build) reads YAML timestamps as dates; match that.
  const doc = parseDocument(match[1]!, { customTags: ['timestamp'], uniqueKeys: true, prettyErrors: false })
  for (const err of doc.errors) {
    issues.push({ severity: 'error', category: 'schema', collection, id, file: rel, rule: 'yaml-error', message: `YAML: ${err.message.split('\n')[0]}` })
  }
  for (const warn of doc.warnings) {
    issues.push({ severity: 'warning', category: 'schema', collection, id, file: rel, rule: 'yaml-warning', message: `YAML: ${warn.message.split('\n')[0]}` })
  }
  let attributes: unknown
  try {
    // Keep what parsed, so one bad line doesn't turn into missing-reference errors elsewhere.
    attributes = doc.toJS() ?? {}
  }
  catch {
    return undefined
  }
  return { attributes: isObject(attributes) ? attributes : { __value: attributes }, body: raw.slice(match[0].length) }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)
}

/** lodash `mergeWith` as configured in build-data.js `combineItem`. */
export function legacyMerge(a: unknown, b: unknown): unknown {
  if (b === undefined) return a
  if (Array.isArray(a) && Array.isArray(b)) {
    if (isObject(a[0]) && a[0].id) {
      const merged = a.map((item) => {
        const match = isObject(item) && item.id ? b.find(x => isObject(x) && x.id === item.id) : undefined
        return match ? legacyMerge(item, match) : item
      })
      const ids = new Set(merged.map(x => (isObject(x) ? x.id : undefined)))
      return [...merged, ...b.filter(x => !(isObject(x) && ids.has(x.id)))]
    }
    const out = [...a]
    b.forEach((x, i) => { out[i] = legacyMerge(a[i], x) })
    return out
  }
  if (isObject(a) && isObject(b)) {
    const out: Record<string, unknown> = { ...a }
    for (const [k, v] of Object.entries(b)) out[k] = legacyMerge(a[k], v)
    return out
  }
  return b
}

const mdFiles = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.md') && statSync(join(dir, f)).isFile()).sort() : [])

export interface LoadResult {
  records: LoadedRecord[]
  issues: Issue[]
}

export function loadContent(root: string, game: GameDefinition): LoadResult {
  const issues: Issue[] = []
  const records: LoadedRecord[] = []
  for (const [collection, source] of Object.entries(game.sources)) {
    records.push(...loadCollection(root, collection, source, issues))
  }
  return { records, issues }
}

function loadCollection(root: string, collection: string, source: CollectionSource, issues: Issue[]): LoadedRecord[] {
  const out: LoadedRecord[] = []
  const dataDir = source.data ? join(root, source.data) : undefined
  const textDir = source.text ? join(root, source.text) : undefined
  const dataFiles = dataDir ? mdFiles(dataDir) : []
  const textFiles = new Set(textDir ? mdFiles(textDir) : [])
  const rel = (f: string) => relative(root, f).replaceAll('\\', '/')

  if (dataDir && !existsSync(dataDir)) {
    issues.push({ severity: 'error', category: 'pairing', collection, file: source.data, rule: 'source-missing', message: `folder ${source.data} does not exist` })
  }

  const primary = dataDir ? dataFiles : [...textFiles]
  for (const file of primary) {
    const id = file.replace(/\.md$/, '')
    const primaryPath = join(dataDir ?? textDir!, file)
    const parsed = parseMarkdown(primaryPath, root, issues, collection)
    if (!parsed) continue
    let attributes: unknown = parsed.attributes
    let body = parsed.body
    let textFile: string | undefined
    if (dataDir && textDir && textFiles.has(file)) {
      const t = parseMarkdown(join(textDir, file), root, issues, collection)
      textFile = rel(join(textDir, file))
      if (t) {
        // Objects and arrays merge by design (bestiary entries, class profs); a scalar in both is overwritten.
        const both = Object.keys(t.attributes).filter(k => k in parsed.attributes && typeof parsed.attributes[k] !== 'object')
        if (both.length) {
          issues.push({ severity: 'info', category: 'pairing', collection, id, file: textFile, rule: 'field-in-both-files', message: `${both.join(', ')} set in both data and text; text wins` })
        }
        if (parsed.body.trim() && t.body.trim()) {
          issues.push({ severity: 'warning', category: 'pairing', collection, id, file: textFile, rule: 'body-in-both-files', message: 'data and text both have a body; the data body is never shown' })
        }
        attributes = legacyMerge(attributes, t.attributes)
        body = t.body
      }
    }
    else if (dataDir && textDir) {
      // The collection has a text folder, but this record keeps its prose in data/.
      const prose = ['name', 'snippet'].filter(k => k in parsed.attributes)
      issues.push({ severity: 'info', category: 'pairing', collection, id, file: rel(primaryPath), rule: 'prose-in-data', message: `no text/en file; ${[...prose, ...(body.trim() ? ['body'] : [])].join(', ') || 'no prose at all'} kept in data` })
    }
    const record = { ...(attributes as Record<string, unknown>), id, body: body.trim() || undefined }
    out.push({ collection, id, dataFile: dataDir ? rel(primaryPath) : undefined, textFile: textFile ?? (dataDir ? undefined : rel(primaryPath)), record })
  }

  // Text files with no data file are never built.
  if (dataDir && textDir) {
    const dataSet = new Set(dataFiles)
    for (const file of textFiles) {
      if (!dataSet.has(file)) {
        issues.push({ severity: 'warning', category: 'pairing', collection, id: file.replace(/\.md$/, ''), file: rel(join(textDir, file)), rule: 'text-without-data', message: 'text file has no matching data file, so the build ignores it' })
      }
    }
  }
  return out
}
