import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { mdFiles, parseMarkdown, type Issue } from '@omnibrew/engine/validator'

/**
 * Reads masseffect-5e-data in its pre-2026 layout, the way its build-data.js did:
 * - `data/<dir>/<id>.md` holds mechanics, `text/en/<dir>/<id>.md` prose;
 * - text front-matter is deep-merged over data (arrays of `{ id }` merge by id,
 *   other arrays by index), and the text body replaces the data body;
 * - text-only collections are read from the text folder alone.
 */
export interface LegacyRecord {
  collection: string
  id: string
  /** Front-matter of data/ and text/en/ merged. */
  attributes: Record<string, unknown>
  body: string
  files: string[]
}

/** Collections whose prose sat in text/en/ next to their data/ file. */
const WITH_TEXT = new Set(['backgrounds', 'bestiary', 'classes', 'feats', 'skills', 'species', 'subclasses', 'tool-profs', 'traits', 'vehicles', 'weapon-properties'])
/** Collections that only had text/en/ files. */
const TEXT_ONLY = new Set(['conditions', 'guide', 'manual', 'ship-upgrades'])

export function legacySource(collection: string): { data?: string, text?: string } {
  if (TEXT_ONLY.has(collection)) return { text: `text/en/${collection}` }
  return { data: `data/${collection}`, text: WITH_TEXT.has(collection) ? `text/en/${collection}` : undefined }
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

export function loadLegacyCollection(root: string, collection: string, issues: Issue[]): LegacyRecord[] {
  const source = legacySource(collection)
  const dataDir = source.data ? join(root, source.data) : undefined
  const textDir = source.text ? join(root, source.text) : undefined
  const rel = (f: string) => relative(root, f).replaceAll('\\', '/')
  const report = (severity: Issue['severity'], rule: string, file: string, message: string, id?: string) =>
    issues.push({ severity, category: 'schema', collection, id, file, rule, message })

  if (dataDir && !existsSync(dataDir)) report('error', 'source-missing', source.data!, `folder ${source.data} does not exist`)
  if (!dataDir && textDir && !existsSync(textDir)) report('error', 'source-missing', source.text!, `folder ${source.text} does not exist`)

  const dataFiles = dataDir ? mdFiles(dataDir) : []
  const textFiles = new Set(textDir ? mdFiles(textDir) : [])
  const out: LegacyRecord[] = []
  for (const file of dataDir ? dataFiles : [...textFiles]) {
    const id = file.replace(/\.md$/, '')
    const primary = join(dataDir ?? textDir!, file)
    const parsed = parseMarkdown(primary, root, issues, collection)
    if (!parsed) continue
    let attributes = parsed.attributes
    let body = parsed.body
    const files = [rel(primary)]
    if (dataDir && textDir && textFiles.has(file)) {
      const text = parseMarkdown(join(textDir, file), root, issues, collection)
      files.push(rel(join(textDir, file)))
      if (text) {
        if (parsed.body.trim() && text.body.trim()) report('warning', 'body-in-both-files', files[1]!, 'data and text both have a body; the text body is kept, as the old build did', id)
        attributes = legacyMerge(attributes, text.attributes) as Record<string, unknown>
        body = text.body
      }
    }
    out.push({ collection, id, attributes, body, files })
  }
  if (dataDir && textDir) {
    const data = new Set(dataFiles)
    for (const file of textFiles) {
      if (!data.has(file)) report('warning', 'text-without-data', rel(join(textDir, file)), 'text file has no data file; the old build ignored it, and so does the migration', file.replace(/\.md$/, ''))
    }
  }
  return out
}
