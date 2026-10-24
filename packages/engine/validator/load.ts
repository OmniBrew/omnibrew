import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { parseFrontMatter } from '../content/format'
import type { CollectionSource, GameDefinition } from '../schemas/game'
import type { Issue } from './issues'

/**
 * Loads a content repo: one `<id>.md` file per record in each collection's
 * folder (`content/powers/charge.md`). The file name is the id; front-matter
 * holds the fields and the markdown body the prose.
 */
export interface LoadedRecord {
  collection: string
  id: string
  /** Path relative to the content root. */
  file: string
  record: Record<string, unknown>
}

export interface ParsedFile {
  attributes: Record<string, unknown>
  body: string
}

/** Reads one markdown file, reporting YAML problems as issues. */
export function parseMarkdown(file: string, root: string, issues: Issue[], collection: string): ParsedFile | undefined {
  const rel = relative(root, file).replaceAll('\\', '/')
  const id = basename(file).replace(/\.md$/, '')
  const parsed = parseFrontMatter(readFileSync(file, 'utf8'))
  if (parsed.unterminated) {
    issues.push({ severity: 'error', category: 'schema', collection, id, file: rel, rule: 'frontmatter-unterminated', message: 'front-matter is never closed with `---`' })
    return undefined
  }
  for (const message of parsed.errors) issues.push({ severity: 'error', category: 'schema', collection, id, file: rel, rule: 'yaml-error', message: `YAML: ${message}` })
  for (const message of parsed.warnings) issues.push({ severity: 'warning', category: 'schema', collection, id, file: rel, rule: 'yaml-warning', message: `YAML: ${message}` })
  return { attributes: parsed.attributes, body: parsed.body }
}

export const mdFiles = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.md') && statSync(join(dir, f)).isFile()).sort() : [])

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
  const dir = join(root, source.dir)
  if (!existsSync(dir)) {
    issues.push({ severity: 'error', category: 'schema', collection, file: source.dir, rule: 'source-missing', message: `folder ${source.dir} does not exist` })
    return []
  }
  const out: LoadedRecord[] = []
  for (const name of mdFiles(dir)) {
    const path = join(dir, name)
    const parsed = parseMarkdown(path, root, issues, collection)
    if (!parsed) continue
    const id = name.replace(/\.md$/, '')
    const file = relative(root, path).replaceAll('\\', '/')
    if ('id' in parsed.attributes) {
      issues.push({ severity: 'warning', category: 'schema', collection, id, file, rule: 'id-in-front-matter', message: 'the file name is the id; remove `id` from the front-matter' })
    }
    const record = { ...parsed.attributes, id, body: parsed.body.trim() || undefined }
    out.push({ collection, id, file, record })
  }
  return out
}
