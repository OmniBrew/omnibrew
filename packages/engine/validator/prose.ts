import { findMdcComponents, FRAMEWORK_TAG } from '../content/mdc'
import type { Game } from '../schemas/game'
import { PROSE_COMPONENTS } from '../schemas/prose'
import type { Issue } from './issues'

/**
 * Prose checks over every string in a record (bodies and text fields):
 * - framework tags (`<me-distance>`, `<v-chip>`): content must stay framework-neutral;
 * - MDC components: known name, inline vs block, placement MDC can read, props,
 *   and the ids they point at.
 */
type Rec = Record<string, unknown>

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach(v => strings(v, out))
  else if (value && typeof value === 'object' && !(value instanceof Date)) Object.values(value).forEach(v => strings(v, out))
  return out
}

export function checkProse(game: Game, records: Map<string, Map<string, Rec>>, files: Map<string, string | undefined>): Issue[] {
  const issues: Issue[] = []
  for (const [collection, recs] of records) {
    for (const [id, rec] of recs) {
      const report = (severity: Issue['severity'], rule: string, message: string) =>
        issues.push({ severity, category: 'prose', collection, id, file: files.get(`${collection}/${id}`), rule, message })

      for (const text of strings(rec)) {
        for (const m of text.matchAll(FRAMEWORK_TAG)) {
          const tag = m[1]!
          const guess = tag.slice(tag.indexOf('-') + 1)
          const hint = PROSE_COMPONENTS[guess] ? `; use ${PROSE_COMPONENTS[guess].kind === 'block' ? '::' : ':'}${guess}` : ''
          report('error', 'framework-tag', `<${tag}> is a framework tag; content uses MDC components${hint}`)
        }

        for (const c of findMdcComponents(text)) {
          const def = PROSE_COMPONENTS[c.name]
          if (!def) {
            // Text like `ratio:value{` that MDC wouldn't read isn't a component at all.
            if (c.parsed) report('error', 'mdc-unknown-component', `${c.source}: no MDC component "${c.name}" (known: ${Object.keys(PROSE_COMPONENTS).join(', ')})`)
            continue
          }
          if (c.inHtml) {
            report('error', 'mdc-in-html', `${c.source}: MDC components don't render inside a raw HTML block (<p>, <div>...); use markdown paragraphs`)
          }
          else if (!c.parsed) {
            report('error', 'mdc-not-parsed', `${c.source}: MDC only reads an inline component after a space, a line start or one of ( [ * _; wrap it: [${c.source}]`)
          }
          if (def.kind !== c.kind) {
            report('error', 'mdc-component-kind', `${c.source}: "${c.name}" is a ${def.kind} component (${def.kind === 'block' ? `::${c.name}{…} on its own line, closed by ::` : `:${c.name}{…}`})`)
          }
          for (const [name, value] of Object.entries(c.attrs)) {
            const prop = def.props[name]
            if (!prop) {
              report('warning', 'mdc-unknown-prop', `${c.source}: "${c.name}" has no prop "${name}" (props: ${Object.keys(def.props).join(', ')})`)
              continue
            }
            if (typeof value !== 'string') continue
            if (prop.values && !prop.values.includes(value)) report('error', 'mdc-invalid-prop', `${c.source}: ${name} must be one of ${prop.values.join(', ')}`)
            if (prop.ref && records.has(prop.ref) && !records.get(prop.ref)!.has(value)) report('error', 'ref-missing', `${c.source}: "${value}" is not a ${prop.ref} id`)
            if (prop.enum && !game.enums.values[prop.enum]?.includes(value)) report('error', 'mdc-invalid-prop', `${c.source}: "${value}" is not one of ${prop.enum}`)
          }
          for (const [name, prop] of Object.entries(def.props)) {
            if (prop.required && !(name in c.attrs)) report('error', 'mdc-missing-prop', `${c.source}: "${c.name}" needs ${name}`)
          }
        }
      }
    }
  }
  return issues
}
