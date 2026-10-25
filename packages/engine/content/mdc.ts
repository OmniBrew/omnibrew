/**
 * Just enough MDC (markdown components) syntax to find and write the
 * components content uses. Not a markdown parser: Nuxt Content renders the
 * files; this lets the validator check them and migrations write them.
 *
 *   inline  :name{key="value" flag}     (optionally :name[slot]{...})
 *   block   ::name{key="value"}          on its own line, closed by a `::` line
 */
export type MdcAttrs = Record<string, string | true>

export interface MdcComponent {
  name: string
  kind: 'inline' | 'block'
  attrs: MdcAttrs
  /** Offset of the leading colon in the scanned text. */
  index: number
  /** Raw source, for messages. */
  source: string
  /**
   * Whether the MDC parser reads it as a component. An inline component only
   * counts after a line start, whitespace or one of `( [ * _ |`; nothing counts
   * inside a raw HTML block (a paragraph that starts with `<p>`, `<div>`...).
   */
  parsed: boolean
  /** Not parsed because it sits inside a raw HTML block. */
  inHtml: boolean
}

/** Characters after which MDC reads `:name{...}` as a component (`|` starts a table cell). */
export const MDC_INLINE_AFTER = /[\s([*_|]/
const HTML_BLOCK = /^[ \t]*<(?:address|article|aside|blockquote|details|div|dl|fieldset|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|ul)\b/im

/**
 * Whether `index` sits in a raw HTML block, which markdown (and MDC) leaves
 * unparsed: a line opening with a block tag starts one, a blank line ends it.
 */
function inHtmlBlock(text: string, index: number): boolean {
  const start = text.lastIndexOf('\n\n', index)
  return HTML_BLOCK.test(text.slice(start === -1 ? 0 : start + 2, index))
}

/**
 * Reads `{...}` starting at `start` (which must be `{`), honouring quotes so
 * `override="extra {metric}"` stays one value. Returns the attributes and the
 * offset just past the closing brace, or undefined if it never closes.
 */
export function readMdcAttrs(text: string, start: number): { attrs: MdcAttrs, end: number } | undefined {
  if (text[start] !== '{') return undefined
  let i = start + 1
  let quote: string | undefined
  for (; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === quote) quote = undefined
    }
    else if (c === '"' || c === '\'') quote = c
    else if (c === '}') break
    else if (c === '\n') return undefined
  }
  if (i >= text.length) return undefined
  return { attrs: parseMdcAttrs(text.slice(start + 1, i)), end: i + 1 }
}

const ATTR = /([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g

export function parseMdcAttrs(src: string): MdcAttrs {
  const attrs: MdcAttrs = {}
  for (const m of src.matchAll(ATTR)) attrs[m[1]!] = m[2] ?? m[3] ?? m[4] ?? true
  return attrs
}

/** `{length="30" adj}`; a value holding a double quote is single-quoted. */
export function formatMdcAttrs(attrs: MdcAttrs): string {
  const parts = Object.entries(attrs).map(([k, v]) => {
    if (v === true) return k
    return v.includes('"') ? `${k}='${v}'` : `${k}="${v}"`
  })
  return parts.length ? `{${parts.join(' ')}}` : ''
}

const INLINE = /(?<![:\\]):([a-z][a-z\d-]*)(?=[{[])/g
const BLOCK = /^[ \t]*(:{2,})([a-z][a-z\d-]*)/gm

/**
 * Every MDC component opening in `text`, including inline ones MDC would not
 * read (see `parsed`). Closing `::` lines are skipped.
 */
export function findMdcComponents(text: string): MdcComponent[] {
  const out: MdcComponent[] = []
  for (const m of text.matchAll(BLOCK)) {
    const at = m.index! + m[0].length
    const read = text[at] === '{' ? readMdcAttrs(text, at) : undefined
    const inHtml = inHtmlBlock(text, m.index!)
    out.push({ name: m[2]!, kind: 'block', attrs: read?.attrs ?? {}, index: m.index! + m[0].indexOf(':'), source: text.slice(m.index!, read?.end ?? at).trim(), parsed: !inHtml, inHtml })
  }
  for (const m of text.matchAll(INLINE)) {
    let at = m.index! + m[0].length
    if (text[at] === '[') {
      const close = text.indexOf(']', at)
      if (close === -1) continue
      at = close + 1
    }
    const read = text[at] === '{' ? readMdcAttrs(text, at) : undefined
    const inHtml = inHtmlBlock(text, m.index!)
    const after = m.index === 0 || MDC_INLINE_AFTER.test(text[m.index! - 1]!)
    out.push({ name: m[1]!, kind: 'inline', attrs: read?.attrs ?? {}, index: m.index!, source: text.slice(m.index!, read?.end ?? at), parsed: after && !inHtml, inHtml })
  }
  return out.sort((a, b) => a.index - b.index)
}

/** Custom-element tags (`<me-distance>`, `<v-chip>`, `<nuxt-link>`): framework components, not HTML. */
export const FRAMEWORK_TAG = /<([a-z][a-z\d]*-[a-z\d-]+)\b[^>]*>/g
