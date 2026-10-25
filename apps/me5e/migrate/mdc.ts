import { findMdcComponents, formatMdcAttrs, FRAMEWORK_TAG, parseMdcAttrs, type MdcAttrs } from '@omnibrew/engine/content'
import { parse } from 'yaml'

/**
 * Rewrites the Vue tags embedded in pre-2026 ME5e prose as the engine's MDC
 * components (plan/04 B15), plus the few Vuetify utility classes in raw HTML:
 *
 *   <me-distance length="30" adj />                 →  :distance{length="30" adj}
 *   <me-condition id="primed" sub="necrotic"/>      →  :condition{id="primed" sub="necrotic"}
 *   <me-weight amount="55" />                       →  :weight{amount="55"}
 *   <v-chip color="info" small>new</v-chip>         →  :change-badge{type="new"}
 *   <v-icon>filter_center_focus</v-icon>            →  :icon{name="ic:baseline-filter-center-focus"}
 *   <me-source-reference pages="39"></…>            →  ::source-reference{pages="39"} + "::"
 *   <me-edge-list id="commands" />                  →  ::edge-list{type="commands"} + "::"
 *   <v-card max-width="300"> … </v-card>            →  ::figure{max-width="300"} … "::"
 *   :::alert … :::  (markdown-it-container)         →  ::note … "::"
 *   <div class="hr"></div>                          →  --- (markdown rule)
 *   <p>a</p><p>b</p>                                →  markdown paragraphs
 *   60/:distance{…}  (MDC can't read it there)      →  60/[:distance{…}]
 *
 * Attribute names become kebab-case (`numOnly` → `num-only`). Vue bindings become
 * plain props (`:length="60"` → `length="60"`), or MDC JSON props for arrays
 * (`:additional="[{source: 'wiki'}]"` → `:additional='[{"source":"wiki"}]'`).
 */
const kebab = (name: string) => name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)

/** HTML/Vue attributes → MDC attributes. */
function attrs(src: string, rename: Record<string, string> = {}): MdcAttrs {
  const out: MdcAttrs = {}
  for (const [name, value] of Object.entries(parseMdcAttrs(src.replace(/\/\s*$/, '')))) {
    const key = rename[name] ?? kebab(name)
    if (!key.startsWith(':') || typeof value !== 'string') {
      out[key] = value
      continue
    }
    // A Vue binding holds a JS literal. Scalars become plain props; MDC reads `:prop` values as JSON.
    const literal: unknown = parse(value)
    if (typeof literal === 'number' || typeof literal === 'string') out[key.slice(1)] = String(literal)
    else if (literal === true) out[key.slice(1)] = true
    else out[key] = JSON.stringify(literal)
  }
  return out
}

const block = (name: string, a: MdcAttrs, inner = '') => `::${name}${formatMdcAttrs(a)}\n${inner ? `${inner}\n` : ''}::`

const INLINE = /<me-(distance|weight|condition)\b([^>]*?)\/?>(?:\s*<\/me-\1>)?/g

export function legacyTagsToMdc(text: string): string {
  const out = text
    // Block components sit on their own line.
    .replace(/^<me-source-reference\b([^>]*?)\/?>(?:\s*<\/me-source-reference>)?[ \t]*$/gm, (_, a: string) => block('source-reference', attrs(a)))
    .replace(/^<me-edge-list\b([^>]*?)\/?>(?:\s*<\/me-edge-list>)?[ \t]*$/gm, (_, a: string) => block('edge-list', attrs(a, { id: 'type' })))
    .replace(/^<v-card\b([^>]*)>([\s\S]*?)<\/v-card>[ \t]*$/gm, (_, a: string, inner: string) => block('figure', attrs(a), inner.trim()))
    // markdown-it-container blocks, which the old build rendered as an info <v-alert>.
    .replace(/^:::[ \t]*alert[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm, (_, inner: string) => block('note', {}, inner.trim()))
    .replace(INLINE, (_, tag: string, a: string) => `:${tag}${formatMdcAttrs(attrs(a))}`)
    .replace(/<v-chip\b[^>]*>\s*(new|change)\s*<\/v-chip>/g, ':change-badge{type="$1"}')
    .replace(/<v-icon\b[^>]*>\s*([a-z_]+)\s*<\/v-icon>/g, (_, icon: string) => `:icon{name="ic:baseline-${icon.replaceAll('_', '-')}"}`)
    // Vuetify utility classes in raw HTML.
    .replace(/\n*^<div class="hr"><\/div>[ \t]*$\n*/gm, '\n\n---\n\n')
    .replace(/<div class="ma-3">/g, '<div>')
    .replace(/^<div class="text-subtitle-1">([^<]*)<\/div>[ \t]*\n?/gm, '**$1**\n\n')
  const left = [...out.matchAll(FRAMEWORK_TAG)].map(m => m[0])
  if (left.length) throw new Error(`no MDC conversion for ${left.join(', ')}`)
  const vuetify = out.match(/\bclass="(?:hr|ma-\d|text-subtitle-1)"|^:::.*$/m)
  if (vuetify) throw new Error(`no MDC conversion for ${vuetify[0]}`)
  return readableByMdc(paragraphsToMarkdown(out))
}

/**
 * `<p>a</p><p>b</p>` → `a` and `b` as markdown paragraphs. Markdown leaves a raw
 * HTML block unparsed, so components inside one would show as text.
 */
export function paragraphsToMarkdown(text: string): string {
  if (!/^\s*(?:<p>(?:(?!<\/?p>)[\s\S])*<\/p>\s*)+$/.test(text)) return text
  return [...text.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => m[1]!.trim()).join('\n\n')
}

/**
 * MDC reads an inline component only after a space, a line start or `( [ * _`.
 * Elsewhere (`60/:distance{…}`, `-by-:distance{…}`) it is wrapped in an MDC span:
 * `60/[:distance{…}]`.
 */
export function readableByMdc(text: string): string {
  let out = text
  for (const c of findMdcComponents(text).reverse()) {
    if (c.kind !== 'inline' || c.parsed || c.inHtml) continue
    const end = c.index + c.source.length
    if (/[([]/.test(out[end] ?? '')) throw new Error(`cannot wrap ${c.source}: a bracket follows it`)
    out = `${out.slice(0, c.index)}[${c.source}]${out.slice(end)}`
  }
  return out
}
