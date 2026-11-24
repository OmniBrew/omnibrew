import { isMap, isScalar, parseDocument } from 'yaml'

/**
 * UI strings (`messages/<locale>.yml`, D8) edited in place (plan/33 §1.8). Re-writing the
 * whole file the way records are written would change 150 of ME's 2,110 lines (quoting
 * styles), so strings go through yaml's Document instead: only the changed values' lines
 * change, everything else (quotes, order, line endings) stays as it was.
 */

export interface MessageChange {
  /** Key path (`homebrew.kinds.weapons` → `['homebrew', 'kinds', 'weapons']`). */
  path: string[]
  value: string
}

/** Every string in a messages file, by dotted key. */
export function flattenMessages(text: string): Map<string, string> {
  const doc = parseDocument(text.replace(/\r\n?/g, '\n'))
  const out = new Map<string, string>()
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'string') out.set(path, v)
    else if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k)
  }
  walk(doc.toJS(), '')
  return out
}

export class MessageEditError extends Error {}

/**
 * Applies changes to a messages file's text. Only existing strings change, or new keys are
 * added under an existing map; a path through a string, or onto a map, is refused.
 */
export function editMessages(text: string, changes: MessageChange[]): string {
  const crlf = text.includes('\r\n')
  const doc = parseDocument(text.replace(/\r\n?/g, '\n'))
  if (doc.errors.length) throw new MessageEditError(doc.errors[0]!.message.split('\n')[0])
  for (const { path, value } of changes) {
    if (!path.length || path.some(k => !/^[\w-]+$/.test(k))) throw new MessageEditError(`bad key: ${path.join('.')}`)
    const parent = path.length > 1 ? doc.getIn(path.slice(0, -1), true) : doc.contents
    if (!isMap(parent)) throw new MessageEditError(`${path.slice(0, -1).join('.') || '(root)'} is not a group of strings`)
    const current = doc.getIn(path, true)
    if (current !== undefined && !(isScalar(current) && typeof current.value === 'string')) throw new MessageEditError(`${path.join('.')} is not a string`)
    doc.setIn(path, value)
  }
  const out = doc.toString({ lineWidth: 0 })
  return crlf ? out.replace(/\n/g, '\r\n') : out
}

/**
 * What would break vue-i18n in a string: braces are placeholders (`{name}`, `{0}`) or
 * literals (`{'{'}`); `@` starts a linked message (`@:key`, `@.capitalize:key`), so any other
 * `@` is a mistake. Returns the problems, empty when the string compiles.
 */
export function messageProblems(value: string): string[] {
  const out: string[] = []
  for (const m of value.matchAll(/\{('[^']*'|[^}]*)\}/g)) {
    if (!/^\s*(?:[a-z_]\w*|\d+|'[^']*')\s*$/i.test(m[1]!)) out.push(`${m[0]}: braces must hold a placeholder name or a quoted literal`)
  }
  const stripped = value.replace(/\{('[^']*'|[^}]*)\}/g, '')
  if (/[{}]/.test(stripped)) out.push('an unmatched brace: write {\'{\'} or {\'}\'} for a literal one')
  if (/@/.test(stripped.replace(/@(?:\.[a-z]+)?:[\w.-]+/gi, ''))) out.push('@ starts a linked message (@:key or @.modifier:key): write {\'@\'} for a literal @')
  return out
}
