import { parseDocument, stringify } from 'yaml'

/**
 * Content file format: one markdown file per record, YAML front-matter for the
 * fields and the markdown body for the prose.
 *
 *   ---
 *   name: Charge
 *   level: 0
 *   ---
 *   Choose a creature or object within range...
 *
 * `stringifyRecord` is deterministic: the same record always gives the same
 * bytes, keys keep the order they come in, and the output parses back with
 * `parseFrontMatter` to an equal object. Tools that write content (the ME
 * migration, later the Git editor) go through it so diffs stay small.
 */

export interface FrontMatterResult {
  attributes: Record<string, unknown>
  body: string
  errors: string[]
  warnings: string[]
  /** The front-matter block was opened but never closed. */
  unterminated: boolean
}

const FRONT_MATTER = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)
}

/** Parses YAML the way the content repo reads it: unique keys, YAML timestamps as `Date`. */
export function parseYaml(source: string) {
  const doc = parseDocument(source, { customTags: ['timestamp'], uniqueKeys: true, prettyErrors: false })
  let value: unknown
  try {
    value = doc.toJS()
  }
  catch {
    value = undefined
  }
  return {
    value,
    errors: doc.errors.map(e => e.message.split('\n')[0]!),
    warnings: doc.warnings.map(w => w.message.split('\n')[0]!),
  }
}

/** Reads a record file. Line endings are normalized to LF (Windows checkouts hold CRLF). */
export function parseFrontMatter(raw: string): FrontMatterResult {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const match = text.match(FRONT_MATTER)
  if (!match) {
    return { attributes: {}, body: text, errors: [], warnings: [], unterminated: text.trim().startsWith('---') }
  }
  const { value, errors, warnings } = parseYaml(match[1] ?? '')
  return {
    attributes: isObject(value) ? value : value === undefined || value === null ? {} : { __value: value },
    body: text.slice(match[0].length),
    errors,
    warnings,
    unterminated: false,
  }
}

/** `2018-12-15T00:00:00Z` → `2018-12-15`; numeric keys (`1:`, progressive formulas) stay unquoted. */
function prepare(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (Array.isArray(value)) return value.map(prepare)
  if (isObject(value)) {
    const out = new Map<unknown, unknown>()
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue
      out.set(/^(?:0|[1-9]\d*)$/.test(k) ? Number(k) : k, prepare(v))
    }
    return out
  }
  return value
}

/** Deterministic block-style YAML: 2-space indent, no line folding, no anchors. */
export function stringifyYaml(value: unknown): string {
  return stringify(prepare(value), {
    indent: 2,
    indentSeq: true,
    lineWidth: 0,
    minContentWidth: 0,
    aliasDuplicateObjects: false,
  })
}

/** Writes a record file. `attributes` order is kept; a body, if any, follows the front-matter. */
export function stringifyRecord(attributes: Record<string, unknown>, body?: string): string {
  const yaml = Object.keys(attributes).length ? stringifyYaml(attributes) : ''
  const prose = body?.replace(/\s+$/, '') ?? ''
  return `---\n${yaml}---\n${prose ? `${prose}\n` : ''}`
}

/** Converts LF output to CRLF (Windows checkouts with `core.autocrlf=true`). */
export const toCrlf = (text: string) => text.replace(/\r?\n/g, '\r\n')
