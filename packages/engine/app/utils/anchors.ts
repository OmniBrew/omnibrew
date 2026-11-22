/**
 * Anchors on a chapter page (the manual, the guides): every section is anchored
 * by its record id (search results and record URLs link to `#<id>`), and the
 * headings inside a section get ids from their text. When a heading's id repeats
 * a section id or an earlier heading ("Strength" in the skills list and the
 * Strength section), `#strength` would land on the first one in the page.
 * `uniqueAnchors` keeps every section id and puts the section's id in front of a
 * heading id that collides (`skills-strength`). Pure: works on Nuxt Content's
 * minimark bodies (`[tag, props, ...children]`) and on MDC element trees.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- content body trees, read node by node
type Rec = Record<string, any>

const HEADING = /^h[1-6]$/

export function uniqueAnchors<S extends { id: string, record?: Rec }>(sections: S[]): S[] {
  const taken = new Set(sections.map(s => s.id))
  return sections.map((section) => {
    const rename = (id: string) => {
      let next = id
      if (taken.has(next)) {
        next = `${section.id}-${id}`
        for (let n = 2; taken.has(next); n++) next = `${section.id}-${id}-${n}`
      }
      taken.add(next)
      return next
    }
    const props = (tag: unknown, p: Rec) => (typeof tag === 'string' && HEADING.test(tag) && typeof p.id === 'string' ? { ...p, id: rename(p.id) } : p)
    const walk = (node: unknown): unknown => {
      if (Array.isArray(node)) {
        // A minimark element: tag, props object, children.
        if (typeof node[0] === 'string' && node[1] && typeof node[1] === 'object' && !Array.isArray(node[1])) {
          const [tag, p, ...children] = node
          return [tag, props(tag, p as Rec), ...children.map(walk)]
        }
        return node.map(walk)
      }
      if (node && typeof node === 'object') {
        const n = node as Rec
        if (n.type === 'minimark' && Array.isArray(n.value)) return { ...n, value: walk(n.value) }
        if (Array.isArray(n.children)) return { ...n, ...(n.props ? { props: props(n.tag, n.props) } : {}), children: n.children.map(walk) }
      }
      return node
    }
    if (!section.record?.body) return section
    return { ...section, record: { ...section.record, body: walk(section.record.body) } }
  })
}
