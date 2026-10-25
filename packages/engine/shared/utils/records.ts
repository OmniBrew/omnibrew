/**
 * Record helpers shared by the app and the server (search index). Nuxt Content
 * gives each record a `stem` (`powers/charge`); the content repo's id is the
 * file name, its last segment.
 */
export const recordId = (record: { stem?: string }) => record.stem?.split('/').pop() ?? ''

function lookup(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], record)
}

/**
 * A record's page, from the game's `routes` config: `{field}` is filled from
 * the record (`{id}` is its id, `{species.0}` a path), `{chapter}` from the
 * navigation chapter that lists it. Undefined when the collection has no pages.
 */
export function recordPath(routes: Record<string, string | false>, collection: string, record: Record<string, unknown>, chapter?: string): string | undefined {
  const template = routes[collection] ?? `/${collection}/{id}`
  if (template === false) return undefined
  // A Nuxt Content record's own `id` is its storage key; the content id comes from its stem.
  const fields: Record<string, unknown> = { ...record, id: record.stem ? recordId(record) : record.id }
  return template.replace(/\{([\w.]+)\}/g, (_, path: string) => String((path === 'chapter' ? chapter : lookup(fields, path)) ?? ''))
}

/**
 * The plain text of an MDC string held in a field (not parsed by Nuxt Content):
 * `:distance{length=30}` becomes "30 ft", `:condition{id="primed"}` "primed",
 * other inline components and markdown marks are dropped.
 */
export function inlineText(mdc: string): string {
  return mdc
    .replace(/:([\w-]+)\{([^}]*)\}/g, (_, name: string, attrs: string) => {
      const props = Object.fromEntries([...attrs.matchAll(/([\w-]+)(?:="([^"]*)"|=(\S+))?/g)].map(m => [m[1], m[2] ?? m[3] ?? '']))
      if (name === 'distance' && props.length) return `${props.length} ft`
      if (name === 'weight' && props.amount) return `${props.amount} lb`
      if (name === 'condition' && props.id) return props.label || props.id
      return ''
    })
    .replace(/[*_`[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

type MinimarkNode = string | [string, Record<string, unknown>, ...MinimarkNode[]]

/**
 * The plain text of a Nuxt Content body (minimark). Inline prose components
 * keep a readable value: `:distance{length=30}` becomes "30 ft".
 */
export function bodyText(body: unknown): string {
  const value = (body as { value?: MinimarkNode[] } | undefined)?.value ?? []
  const parts: string[] = []
  const walk = (node: MinimarkNode) => {
    if (typeof node === 'string') {
      parts.push(node)
      return
    }
    const [tag, props, ...children] = node
    if (tag === 'distance' && props.length !== undefined) parts.push(`${props.length} ft`)
    else if (tag === 'weight' && props.amount !== undefined) parts.push(`${props.amount} lb`)
    else if (tag === 'condition' && typeof props.id === 'string') parts.push(String(props.label ?? props.id))
    children.forEach(walk)
    if (/^(?:p|h\d|li|td|th|tr|blockquote)$/.test(tag)) parts.push(' ')
  }
  value.forEach(walk)
  return parts.join('').replace(/\s+/g, ' ').trim()
}
