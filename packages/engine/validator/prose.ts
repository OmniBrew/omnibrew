import type { Issue } from './issues'

/**
 * Prose checks: framework tags embedded in content (the Phase 1 MDC conversion
 * worklist) and the ids those tags point at.
 */
type Rec = Record<string, unknown>

const TAG = /<((?:me|v)-[a-z-]+|nuxt-link)\b([^>]*)>/g

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach(v => strings(v, out))
  else if (value && typeof value === 'object' && !(value instanceof Date)) Object.values(value).forEach(v => strings(v, out))
  return out
}

export function checkProse(records: Map<string, Map<string, Rec>>, files: Map<string, string | undefined>): Issue[] {
  const issues: Issue[] = []
  const conditions = records.get('conditions')
  for (const [collection, recs] of records) {
    for (const [id, rec] of recs) {
      const tags = new Map<string, number>()
      for (const text of strings(rec)) {
        for (const m of text.matchAll(TAG)) {
          const tag = m[1]!
          tags.set(tag, (tags.get(tag) ?? 0) + 1)
          if (tag === 'me-condition' && conditions) {
            const cond = m[2]!.match(/\bid=["']([^"']+)["']/)?.[1]
            if (cond && !conditions.has(cond)) {
              issues.push({ severity: 'error', category: 'reference', collection, id, file: files.get(`${collection}/${id}`), rule: 'ref-missing', message: `<me-condition id="${cond}"> is not a conditions id` })
            }
          }
        }
      }
      for (const [tag, n] of tags) {
        issues.push({ severity: 'info', category: 'prose', collection, id, file: files.get(`${collection}/${id}`), rule: `tag:${tag}`, message: `${n}× <${tag}> in prose (convert to an MDC component)` })
      }
    }
  }
  return issues
}
